<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApkInstallation;
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

        $allowedRoles = ['admin_apk', 'apk_koordinator'];
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
