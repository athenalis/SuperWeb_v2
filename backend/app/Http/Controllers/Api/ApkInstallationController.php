<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApkInstallation;
use App\Models\CoordinatorApk;
use App\Models\Relawan;
use App\Models\CourierApk;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class ApkInstallationController extends Controller
{
    private function resolveApkActor($user): array
    {
        $relawan = Relawan::where('user_id', $user->id)->first();
        if ($relawan) {
            if ((int) $relawan->is_apk !== 1) {
                // abort(response()->json(['message' => 'Relawan tidak punya tugas APK'], 403));
                // Optional: allow if needed, or strictly follow logic
            }
            return [
                'paslon_id' => $relawan->paslon_id,
                'relawan_id' => $relawan->id,
                'apk_kurir_id' => null,
                'actor' => 'relawan',
            ];
        }

        $kurir = CourierApk::where('user_id', $user->id)->first();
        if ($kurir) {
            return [
                'paslon_id' => $kurir->paslon_id,
                'relawan_id' => null,
                'apk_kurir_id' => $kurir->id,
                'actor' => 'apk_kurir',
            ];
        }

        abort(response()->json(['message' => 'Akses ditolak: bukan relawan APK / kurir APK'], 403));
    }

    public function index(Request $request)
    {
        $user = $request->user();

        // Hanya admin_apk boleh akses
        $isAdminApk = method_exists($user, 'hasRole') && $user->hasRole('apk_koordinator');
        if (!$isAdminApk) {
            abort(response()->json(['message' => 'Akses ditolak: hanya apk_koordinator'], 403));
        }

        $koor = CoordinatorApk::where('user_id', $user->id)->first();

        if (!$koor || !$koor->paslon_id) {
            abort(response()->json(['message' => 'Paslon koordinator tidak ditemukan'], 403));
        }

        $koorPaslonId = (int) $koor->paslon_id;


        $validated = $request->validate([
            'paslon_id' => 'nullable|integer',
            'user_id' => 'nullable|integer',
            'relawan_id' => 'nullable|integer',
            'apk_kurir_id' => 'nullable|integer',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $perPage = (int)($validated['per_page'] ?? 15);

        $q = ApkInstallation::query()
            ->with([
                'relawan:id,nama',
                'apkKurir:id,nama',
            ])
            ->where('paslon_id', $koorPaslonId);

        if (!empty($validated['paslon_id'])) {
            $q->where('paslon_id', $validated['paslon_id']);
        }
        if (!empty($validated['user_id'])) {
            $q->where('user_id', $validated['user_id']);
        }
        if (!empty($validated['relawan_id'])) {
            $q->where('relawan_id', $validated['relawan_id']);
        }
        if (!empty($validated['apk_kurir_id'])) {
            $q->where('apk_kurir_id', $validated['apk_kurir_id']);
        }

        if (!empty($validated['date_from'])) {
            $q->whereDate('taken_at', '>=', $validated['date_from']);
        }
        if (!empty($validated['date_to'])) {
            $q->whereDate('taken_at', '<=', $validated['date_to']);
        }

        // urutkan terbaru
        $rows = $q->orderByDesc('taken_at')->orderByDesc('id')->paginate($perPage);

        // Siapkan photo_url agar FE gampang panggil foto
        $rows->getCollection()->transform(function ($row) use ($request) {
            return [
                'id' => $row->id,
                'user_id' => $row->user_id,
                'paslon_id' => $row->paslon_id,
                'relawan_id' => $row->relawan_id,
                'apk_kurir_id' => $row->apk_kurir_id,
                'relawan_nama' => $row->relawan?->nama,
                'apk_kurir_nama' => $row->apkKurir?->nama,
                'latitude' => $row->latitude,
                'longitude' => $row->longitude,
                'taken_at' => $row->taken_at,
                'photo_path' => $row->photo_path,
                'photo_size' => $row->photo_size,
                'photo_hash' => $row->photo_hash,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,

                // sesuaikan path ini dengan route kamu
                'photo_url' => url("/api/apk-installations/{$row->id}/photo"),
            ];
        });

        return response()->json($rows);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $actor = $this->resolveApkActor($user);

        $data = $request->validate([
            'photo' => 'required|image|mimes:jpg,jpeg,png,webp|max:2048',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'taken_at' => 'required|date',
        ]);

        $file = $request->file('photo');
        $hash = hash_file('sha256', $file->getRealPath());

        $dir = "apk_installations/{$user->id}/" . now()->format('Y/m/d');
        $filename = Str::uuid() . '_' . substr($hash, 0, 10) . '.' . $file->extension();

        $path = $file->storeAs($dir, $filename);

        $row = ApkInstallation::create([
            'user_id' => $user->id,
            'paslon_id' => $actor['paslon_id'],
            'relawan_id' => $actor['relawan_id'],
            'apk_kurir_id' => $actor['apk_kurir_id'],
            'latitude' => $data['latitude'],
            'longitude' => $data['longitude'],
            'taken_at' => $data['taken_at'],
            'photo_path' => $path,
            'photo_size' => $file->getSize(),
            'photo_hash' => $hash,
        ]);

        return response()->json([
            'id' => $row->id,
            'actor' => $actor['actor'],
            'message' => 'Bukti pemasangan berhasil disimpan'
        ], 201);
    }

    public function photo(Request $request, $id)
    {
        $user = $request->user();
        $row = ApkInstallation::findOrFail($id);

        $allowedRoles = ['apk_koordinator'];
        $hasRole = false;

        if (method_exists($user, 'hasRole')) {
            foreach ($allowedRoles as $r) {
                if ($user->hasRole($r)) {
                    $hasRole = true;
                    break;
                }
            }
        }

        if ($row->user_id !== $user->id && !$hasRole) {
            abort(response()->json(['message' => 'Tidak boleh mengakses foto ini'], 403));
        }

        $relative = ltrim($row->photo_path ?? '', '/');

        $candidates = [
            ['disk' => 'local',  'path' => $relative],
            ['disk' => 'local',  'path' => "private/{$relative}"],
            ['disk' => 'public', 'path' => $relative],
            ['disk' => 'public', 'path' => "private/{$relative}"],
        ];

        foreach ($candidates as $c) {
            if (Storage::disk($c['disk'])->exists($c['path'])) {
                $fullPath = Storage::disk($c['disk'])->path($c['path']);
                return response()->file($fullPath);
            }
        }
        abort(response()->json([
            'message' => 'File foto tidak ditemukan',
            'photo_path_db' => $row->photo_path,
            'tried' => array_map(fn($x) => $x['disk'] . ':' . $x['path'], $candidates),
        ], 404));
    }
}
