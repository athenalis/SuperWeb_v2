<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoordinatorApk;
use App\Models\User;
use App\Models\AdminPaslon; // <- asumsi ada model ini
use App\Helpers\PhoneHelper; // kalau kamu memang pakai helper ini
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CoordinatorApkController extends Controller
{
    /**
     * Ambil paslon_id berdasarkan admin_paslon yang login.
     * Asumsi: tabel admin_paslons punya kolom user_id & paslon_id
     */
    private function currentAdminPaslonId(): int
    {
        $userId = Auth::id();

        $admin = AdminPaslon::where('user_id', $userId)->first();

        if (!$admin || !$admin->paslon_id) {
            abort(response()->json([
                'status' => false,
                'message' => 'Admin paslon tidak memiliki paslon_id'
            ], 403));
        }

        return (int) $admin->paslon_id;
    }

    public function index(Request $request)
    {
        $paslonId = $this->currentAdminPaslonId();

        $query = CoordinatorApk::with([
            'province:province_code,province',
            'city:city_code,city',
            'district:district_code,district',
            'village:village_code,village',
            'user:id,name,email,nik',
        ])->where('paslon_id', $paslonId);

        if ($request->filled('search')) {
            $keyword = $request->search;
            $query->where(function ($q) use ($keyword) {
                $q->where('nama', 'like', "%{$keyword}%")
                    ->orWhere('nik', 'like', "%{$keyword}%")
                    ->orWhere('no_hp', 'like', "%{$keyword}%")
                    ->orWhereHas('province', fn($qq) => $qq->where('province', 'like', "%{$keyword}%"))
                    ->orWhereHas('city', fn($qq) => $qq->where('city', 'like', "%{$keyword}%"))
                    ->orWhereHas('district', fn($qq) => $qq->where('district', 'like', "%{$keyword}%"))
                    ->orWhereHas('village', fn($qq) => $qq->where('village', 'like', "%{$keyword}%"));
            });
        }

        if ($request->filled('city_code')) $query->where('city_code', $request->city_code);
        if ($request->filled('district_code')) $query->where('district_code', $request->district_code);
        if ($request->filled('village_code')) $query->where('village_code', $request->village_code);

        $query->orderByDesc('id');

        if ($request->filled('per_page')) {
            $data = $query->paginate((int) $request->per_page);
        } else {
            $data = $query->get();
        }

        return response()->json([
            'status' => true,
            'data' => $data
        ]);
    }

    public function show($id)
    {
        $paslonId = $this->currentAdminPaslonId();

        $data = CoordinatorApk::with([
            'province',
            'city',
            'district',
            'village',
            'user'
        ])->where('paslon_id', $paslonId)
            ->find($id);

        if (!$data) {
            return response()->json([
                'status' => false,
                'message' => 'Koordinator APK tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'status' => true,
            'data' => $data
        ]);
    }

    /**
     * FE panggil ini dulu sebelum create, biar bisa munculin popup:
     * - jika nik belum pernah ada: exists=false
     * - jika nik ada tapi soft-deleted: exists=true, deleted=true (boleh restore)
     * - jika nik ada dan aktif: exists=true, deleted=false
     */
    public function checkNik(Request $request)
    {
        $request->validate([
            'nik' => 'required|digits:16'
        ]);

        $paslonId = $this->currentAdminPaslonId();

        $row = CoordinatorApk::withTrashed()
            ->where('paslon_id', $paslonId) // ✅ scope per paslon admin
            ->where('nik', $request->nik)
            ->first();

        if (!$row) {
            return response()->json([
                'exists' => false,
            ]);
        }

        return response()->json([
            'exists' => true,
            'deleted' => (bool) $row->trashed(),
            'message' => $row->trashed()
                ? 'NIK pernah terdaftar dan saat ini nonaktif (soft delete). Bisa direstore.'
                : 'NIK sudah terdaftar dan masih aktif.',
            'data' => [
                'id' => $row->id,
                'nama' => $row->nama,
                'nik' => $row->nik,
            ]
        ]);
    }

    public function store(Request $request)
    {
        $paslonId = $this->currentAdminPaslonId();

        if (class_exists(\App\Helpers\PhoneHelper::class) && $request->filled('no_hp')) {
            $request->merge([
                'no_hp' => \App\Helpers\PhoneHelper::normalize($request->no_hp),
            ]);
        }

        $validator = Validator::make($request->all(), [
            'nama' => ['required', 'string', 'max:255', 'regex:/^[^0-9]+$/'],
            'nik'  => ['required', 'digits:16'],
            'no_hp' => ['required', 'digits_between:10,13'],
            'alamat'        => 'required|string|max:255',
            'province_code' => 'required|exists:provinces,province_code',
            'city_code'     => 'required|exists:cities,city_code',
            'district_code' => 'required|exists:districts,district_code',
            'village_code'  => 'required|exists:villages,village_code',
            'status'        => 'nullable|in:inactive,active',
        ], [
            'nama.regex' => 'Nama tidak boleh mengandung angka'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $existingUserNik = User::withTrashed()
            ->where('nik', $request->nik)
            ->first();

        if ($existingUserNik) {
            return response()->json([
                'status' => false,
                'message' => 'NIK sudah terdaftar'
            ], 422);
        }

        $existingCoordinator = CoordinatorApk::withTrashed()
            ->where('paslon_id', $paslonId)
            ->where('nik', $request->nik)
            ->first();

        if ($existingCoordinator && $existingCoordinator->trashed()) {
            return response()->json([
                'status' => false,
                'code' => 'NIK_SOFT_DELETED',
                'message' => 'NIK pernah terdaftar dan saat ini nonaktif. Setujui restore?',
                'data' => [
                    'id' => $existingCoordinator->id,
                    'nama' => $existingCoordinator->nama,
                    'nik' => $existingCoordinator->nik,
                ]
            ], 409);
        }

        if ($existingCoordinator && !$existingCoordinator->trashed()) {
            return response()->json([
                'status' => false,
                'message' => 'NIK sudah terdaftar'
            ], 422);
        }

        $result = DB::transaction(function () use ($request, $paslonId) {

            $nameClean = strtolower(preg_replace('/\s+/', '', $request->nama));
            $email = $nameClean . rand(1000, 9999) . '@gmail.com';
            $passwordPlain = $nameClean . rand(1000, 9999);

            $user = User::create([
                'name'     => $request->nama,
                'nik'      => $request->nik,
                'email'    => $email,
                'password' => Hash::make($passwordPlain),
            ]);

            $row = CoordinatorApk::create([
                'user_id' => $user->id,
                'paslon_id' => $paslonId,
                'province_code' => $request->province_code,
                'city_code' => $request->city_code,
                'district_code' => $request->district_code,
                'village_code' => $request->village_code,
                'nama' => $request->nama,
                'nik' => $request->nik,
                'no_hp' => $request->no_hp,
                'alamat' => $request->alamat,
                'status' => $request->input('status', 'inactive'),
            ]);

            $row->load(['province', 'city', 'district', 'village', 'user']);

            return [
                'row' => $row,
                'email' => $email,
                'password' => $passwordPlain,
            ];
        });

        return response()->json([
            'status' => true,
            'message' => 'Koordinator APK berhasil dibuat',
            'data' => [
                'coordinator' => $result['row'],
                'user' => [
                    'email' => $result['email'],
                    'password' => $result['password'],
                ]
            ]
        ], 201);
    }

    public function restoreByNik(Request $request)
    {
        $request->validate([
            'nik' => 'required|digits:16'
        ]);

        $adminPaslon = AdminPaslon::where('user_id', Auth::id())->first();
        if (!$adminPaslon) {
            return response()->json([
                'status' => false,
                'message' => 'Admin paslon tidak ditemukan / tidak valid'
            ], 403);
        }

        $targetPaslonId = (int) $adminPaslon->paslon_id;

        // 1) Pastikan di paslon target belum ada NIK aktif
        $alreadyActiveInTarget = CoordinatorApk::where('paslon_id', $targetPaslonId)
            ->where('nik', $request->nik)
            ->whereNull('deleted_at')
            ->exists();

        if ($alreadyActiveInTarget) {
            return response()->json([
                'status' => false,
                'message' => 'NIK sudah terdaftar dan aktif di paslon ini'
            ], 422);
        }

        // 2) Ambil data soft-deleted NIK ini (dari paslon manapun)
        $row = CoordinatorApk::withTrashed()
            ->with(['user' => fn($q) => $q->withTrashed()])
            ->where('nik', $request->nik)
            ->whereNotNull('deleted_at')
            ->orderByDesc('deleted_at')
            ->first();

        if (!$row) {
            return response()->json([
                'status' => false,
                'message' => 'Data NIK tidak ditemukan / tidak ada yang soft delete'
            ], 404);
        }

        DB::transaction(function () use ($row, $targetPaslonId, $adminPaslon) {

            // ✅ restore row
            $row->restore();

            // ✅ pindahkan ke paslon admin yang melakukan restore
            $row->paslon_id = $targetPaslonId;

            // Kalau tabel kamu punya admin_paslon_id, aktifkan ini:
            if (isset($row->admin_paslon_id)) {
                $row->admin_paslon_id = $adminPaslon->id;
            }

            $row->save();

            // optional: restore user kalau user ikut soft delete
            if ($row->user && method_exists($row->user, 'restore') && $row->user->trashed()) {
                $row->user->restore();
            }
        });

        $row->load(['province', 'city', 'district', 'village', 'user']);

        return response()->json([
            'status' => true,
            'message' => 'Koordinator APK berhasil direstore',
            'data' => $row
        ]);
    }

    public function update(Request $request, $id)
    {
        $paslonId = $this->currentAdminPaslonId();

        $row = CoordinatorApk::where('paslon_id', $paslonId)->find($id);
        if (!$row) {
            return response()->json([
                'status' => false,
                'message' => 'Koordinator APK tidak ditemukan'
            ], 404);
        }

        if (class_exists(PhoneHelper::class) && $request->filled('no_hp')) {
            $request->merge([
                'no_hp' => PhoneHelper::normalize($request->no_hp),
            ]);
        }

        $validator = Validator::make($request->all(), [
            'nama' => ['required', 'string', 'max:255', 'regex:/^[^0-9]+$/'],
            'nik'  => ['required', 'digits:16'],
            'no_hp' => ['required', 'digits_between:10,13'],
            'alamat'        => 'required|string|max:255',
            'province_code' => 'required|exists:provinces,province_code',
            'city_code'     => 'required|exists:cities,city_code',
            'district_code' => 'required|exists:districts,district_code',
            'village_code'  => 'required|exists:villages,village_code',
            'status'        => 'nullable|string',
        ], [
            'nama.regex' => 'Nama tidak boleh mengandung angka'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $nikClash = CoordinatorApk::withTrashed()
            ->where('paslon_id', $paslonId)
            ->where('nik', $request->nik)
            ->where('id', '!=', $row->id)
            ->exists();

        if ($nikClash) {
            return response()->json([
                'status' => false,
                'message' => 'NIK sudah terdaftar (di data lain)'
            ], 422);
        }

        $row->update([
            'province_code' => $request->province_code,
            'city_code' => $request->city_code,
            'district_code' => $request->district_code,
            'village_code' => $request->village_code,
            'nama' => $request->nama,
            'nik' => $request->nik,
            'no_hp' => $request->no_hp,
            'alamat' => $request->alamat,
            'status' => $request->input('status', $row->status),
        ]);

        if ($row->user) {
            $row->user->update([
                'name' => $request->nama,
                'nik'  => $request->nik,
            ]);
        }

        $row->load(['province', 'city', 'district', 'village', 'user']);

        return response()->json([
            'status' => true,
            'message' => 'Koordinator APK berhasil diperbarui',
            'data' => $row
        ]);
    }

    public function destroy($id)
    {
        $paslonId = $this->currentAdminPaslonId();

        $row = CoordinatorApk::with(['user'])
            ->where('paslon_id', $paslonId)
            ->find($id);

        if (!$row) {
            return response()->json([
                'status' => false,
                'message' => 'Koordinator APK tidak ditemukan'
            ], 404);
        }

        DB::transaction(function () use ($row) {
            $row->delete();
            if ($row->user && method_exists($row->user, 'delete')) {
                $row->user->delete();
            }
        });

        return response()->json([
            'status' => true,
            'message' => 'Koordinator APK berhasil dihapus'
        ]);
    }
}
