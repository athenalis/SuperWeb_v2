<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\AdminApk;
use App\Models\AdminPaslon;
use App\Helpers\PhoneHelper;
use Illuminate\Http\Request;
use App\Models\CoordinatorApk;
use App\Models\UserCredential;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\KoordinatorApkExport;
use App\Imports\KoordinatorApkImport;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Validator;

class CoordinatorApkController extends Controller
{
    private function currentAdminApk(): AdminApk
    {
        $adminApk = AdminApk::where('user_id', Auth::id())->first();

        if (!$adminApk || !$adminApk->paslon_id) {
            abort(response()->json([
                'status' => false,
                'message' => 'Admin APK tidak ditemukan / tidak valid'
            ], 403));
        }

        return $adminApk;
    }

    private function currentPaslonId(): int
    {
        return (int) $this->currentAdminApk()->paslon_id;
    }

    private function currentPaslonIdUniversal(): int
    {
        $user = Auth::user();
        if (!$user) {
            abort(401, 'Unauthorized');
        }

        $roleSlug = $this->roleSlug($user);

        if ($roleSlug === 'admin_apk') {
            $admin = AdminApk::where('user_id', $user->id)
                ->whereNull('deleted_at')
                ->first();
        } elseif ($roleSlug === 'admin_paslon') {
            $admin = AdminPaslon::where('user_id', $user->id)
                ->whereNull('deleted_at')
                ->first();
        } else {
            abort(403, 'Role tidak diizinkan');
        }

        if (!$admin || !$admin->paslon_id) {
            abort(403, 'Paslon tidak ditemukan');
        }

        return (int) $admin->paslon_id;
    }

    private function roleSlug($user): ?string
    {
        return DB::table('roles')->where('id', $user->role_id)->value('role');
    }

    private function paslonSuffix(int $paslonId): string
    {
        $nomorUrut = (int) (DB::table('paslons')->where('id', $paslonId)->value('nomor_urut') ?? 0);
        return $nomorUrut ? str_pad((string)$nomorUrut, 2, '0', STR_PAD_LEFT) : (string)$paslonId;
    }

    public function index(Request $request)
    {
        $paslonId = $this->currentPaslonIdUniversal();

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

        $data = $request->filled('per_page')
            ? $query->paginate((int) $request->per_page)
            : $query->get();

        return response()->json([
            'status' => true,
            'data' => $data
        ]);
    }

    public function show($id)
    {
        $paslonId = $this->currentPaslonIdUniversal();

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

    public function checkNik(Request $request)
    {
        $request->validate([
            'nik' => 'required|digits:16'
        ]);

        $paslonId = $this->currentPaslonIdUniversal();


        $activeHere = CoordinatorApk::where('paslon_id', $paslonId)
            ->where('nik', $request->nik)
            ->whereNull('deleted_at')
            ->first();

        if ($activeHere) {
            return response()->json([
                'exists' => true,
                'deleted' => false,
                'message' => 'NIK sudah terdaftar dan masih aktif di paslon ini.',
                'data' => [
                    'id' => $activeHere->id,
                    'nama' => $activeHere->nama,
                    'nik' => $activeHere->nik,
                ]
            ]);
        }

        $softDeleted = CoordinatorApk::withTrashed()
            ->where('nik', $request->nik)
            ->whereNotNull('deleted_at')
            ->orderByDesc('deleted_at')
            ->first();

        if ($softDeleted) {
            return response()->json([
                'exists' => true,
                'deleted' => true,
                'message' => 'NIK pernah terdaftar dan saat ini nonaktif (soft delete). Bisa direstore ke paslon ini.',
                'data' => [
                    'id' => $softDeleted->id,
                    'nama' => $softDeleted->nama,
                    'nik' => $softDeleted->nik,

                    'no_hp' => $softDeleted->no_hp,
                    'alamat' => $softDeleted->alamat,
                    'province_code' => $softDeleted->province_code,
                    'city_code' => $softDeleted->city_code,
                    'district_code' => $softDeleted->district_code,
                    'village_code' => $softDeleted->village_code,

                    'old_paslon_id' => $softDeleted->paslon_id,
                ]
            ]);
        }

        return response()->json([
            'exists' => false
        ]);
    }

    public function store(Request $request)
    {
        $paslonId = $this->currentPaslonId();

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

        $existingCoordinatorHere = CoordinatorApk::where('paslon_id', $paslonId)
            ->where('nik', $request->nik)
            ->whereNull('deleted_at')
            ->first();

        if ($existingCoordinatorHere) {
            return response()->json([
                'status' => false,
                'message' => 'NIK sudah terdaftar'
            ], 422);
        }

        $softDeleted = CoordinatorApk::withTrashed()
            ->where('nik', $request->nik)
            ->whereNotNull('deleted_at')
            ->orderByDesc('deleted_at')
            ->first();

        if ($softDeleted) {
            return response()->json([
                'status' => false,
                'code' => 'NIK_SOFT_DELETED',
                'message' => 'NIK pernah terdaftar dan saat ini nonaktif. Setujui restore?',
                'data' => [
                    'id' => $softDeleted->id,
                    'nama' => $softDeleted->nama,
                    'nik' => $softDeleted->nik,

                    'no_hp' => $softDeleted->no_hp,
                    'alamat' => $softDeleted->alamat,
                    'province_code' => $softDeleted->province_code,
                    'city_code' => $softDeleted->city_code,
                    'district_code' => $softDeleted->district_code,
                    'village_code' => $softDeleted->village_code,

                    'old_paslon_id' => $softDeleted->paslon_id,
                ]
            ], 409);
        }

        $existingUserNik = User::withTrashed()->where('nik', $request->nik)->first();
        if ($existingUserNik) {
            return response()->json([
                'status' => false,
                'message' => 'NIK sudah terdaftar'
            ], 422);
        }

        $result = DB::transaction(function () use ($request, $paslonId) {

            $nameClean = strtolower(trim($request->nama));
            $nameClean = preg_replace('/\s+/', '', $nameClean);
            $nameClean = preg_replace('/[^a-z0-9]/', '', $nameClean);
            if ($nameClean === '') $nameClean = 'user';

            do {
                $email = $nameClean . rand(1000, 9999) . '@gmail.com';
            } while (User::where('email', $email)->exists());

            $passwordPlain = $nameClean . rand(1000, 9999);

            $user = User::create([
                'name'     => $request->nama,
                'nik'      => $request->nik,
                'email'    => $email,
                'password' => Hash::make($passwordPlain),
                'role_id'  => 5,
            ]);

            UserCredential::create([
                'user_id' => $user->id,
                'encrypted_password' => Crypt::encryptString($passwordPlain),
                'type' => 'initial',
                'is_active' => 1,
                'used_at' => null,
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
            'nik' => 'required|digits:16',
        ], [
            'nama.regex' => 'Nama tidak boleh mengandung angka'
        ]);

        $paslonId = $this->currentPaslonId();

        $alreadyActiveInTarget = CoordinatorApk::where('paslon_id', $paslonId)
            ->where('nik', $request->nik)
            ->whereNull('deleted_at')
            ->exists();

        if ($alreadyActiveInTarget) {
            return response()->json([
                'status' => false,
                'message' => 'NIK sudah terdaftar dan aktif di paslon ini'
            ], 422);
        }

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

        $newEmail = null;
        $newPasswordPlain = null;

        DB::transaction(function () use ($row, $paslonId, &$newEmail, &$newPasswordPlain) {
            $row->restore();

            $row->paslon_id = $paslonId;

            if (property_exists($row, 'status') || isset($row->status)) {
                $row->status = 'inactive';
            }

            $row->save();

            if ($row->user && method_exists($row->user, 'restore') && $row->user->trashed()) {
                $row->user->restore();
            }

            $nameClean = strtolower(trim((string) $row->nama));
            $nameClean = preg_replace('/\s+/', '', $nameClean);
            $nameClean = preg_replace('/[^a-z0-9]/', '', $nameClean);
            if ($nameClean === '') $nameClean = 'user';

            do {
                $newEmail = $nameClean . rand(1000, 9999) . '@gmail.com';
            } while (
                User::where('email', $newEmail)
                    ->when($row->user, fn($q) => $q->where('id', '!=', $row->user->id))
                    ->exists()
            );

            $newPasswordPlain = $nameClean . rand(1000, 9999);

            if ($row->user) {
                $row->user->update([
                    'name'     => $row->nama,
                    'nik'      => $row->nik,
                    'email'    => $newEmail,
                    'password' => Hash::make($newPasswordPlain),

                    'role_id'  => 5,
                ]);

                UserCredential::where('user_id', $row->user->id)
                    ->update([
                        'is_active' => 0,
                        'used_at'   => now(),
                    ]);

                UserCredential::create([
                    'user_id'            => $row->user->id,
                    'encrypted_password' => Crypt::encryptString($newPasswordPlain),
                    'type'               => 'reactive',
                    'is_active'          => 1,
                    'used_at'            => null,
                ]);
            }
        });

        $row->load(['province', 'city', 'district', 'village', 'user']);

        return response()->json([
            'status' => true,
            'message' => 'Koordinator APK berhasil direstore dan dipindahkan ke paslon ini',
            'data' => [
                'coordinator' => $row,
                'user' => [
                    'email' => $newEmail,
                    'password' => $newPasswordPlain,
                ],
            ]
        ]);
    }

    public function update(Request $request, $id)
    {
        $paslonId = $this->currentPaslonId();

        $row = CoordinatorApk::with('user')
            ->where('paslon_id', $paslonId)
            ->find($id);

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

        if ($row->user) {
            $nikUsedByOtherUser = User::withTrashed()
                ->where('nik', $request->nik)
                ->where('id', '!=', $row->user->id)
                ->exists();

            if ($nikUsedByOtherUser) {
                return response()->json([
                    'status' => false,
                    'message' => 'NIK sudah terdaftar'
                ], 422);
            }
        }

        $nameChanged = trim((string) $row->nama) !== trim((string) $request->nama);

        $newEmail = null;
        $newPasswordPlain = null;

        DB::transaction(function () use (
            $row,
            $request,
            $nameChanged,
            &$newEmail,
            &$newPasswordPlain
        ) {
            $row->update([
                'province_code' => $request->province_code,
                'city_code'     => $request->city_code,
                'district_code' => $request->district_code,
                'village_code'  => $request->village_code,
                'nama'          => $request->nama,
                'nik'           => $request->nik,
                'no_hp'         => $request->no_hp,
                'alamat'        => $request->alamat,
                'status'        => $request->input('status', $row->status),
            ]);

            if ($row->user) {
                $userUpdate = [
                    'name' => $request->nama,
                    'nik'  => $request->nik,
                ];

                if ($nameChanged) {
                    $base = strtolower(trim($request->nama));
                    $base = preg_replace('/\s+/', '', $base);
                    $base = preg_replace('/[^a-z0-9]/', '', $base);
                    if ($base === '') $base = 'user';

                    do {
                        $rand = rand(1000, 9999);
                        $newEmail = $base . $rand . '@gmail.com';
                    } while (
                        User::where('email', $newEmail)
                        ->where('id', '!=', $row->user->id)
                        ->exists()
                    );

                    $newPasswordPlain = $base . rand(1000, 9999);

                    $userUpdate['email'] = $newEmail;
                    $userUpdate['password'] = Hash::make($newPasswordPlain);
                }

                $row->user->update($userUpdate);

                if ($nameChanged && $newPasswordPlain) {
                    UserCredential::where('user_id', $row->user->id)
                        ->where('is_active', 1)
                        ->update([
                            'is_active' => 0,
                            'used_at' => now(),
                        ]);

                    UserCredential::create([
                        'user_id' => $row->user->id,
                        'encrypted_password' => Crypt::encryptString($newPasswordPlain),
                        'type' => 'reactive',
                        'is_active' => 1,
                        'used_at' => null,
                    ]);
                }
            }
        });

        $row->load(['province', 'city', 'district', 'village', 'user']);

        return response()->json([
            'status' => true,
            'message' => 'Koordinator APK berhasil diperbarui',
            'data' => [
                'coordinator' => $row,
                'user' => $nameChanged ? [
                    'email' => $newEmail,
                    'password' => $newPasswordPlain,
                ] : null
            ]
        ]);
    }

    public function destroy($id)
    {
        $paslonId = $this->currentPaslonId();

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

    public function import(Request $request)
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['status' => false, 'message' => 'Unauthorized'], 401);
        }

        $roleSlug = DB::table('roles')->where('id', $user->role_id)->value('role');
        if ($roleSlug !== 'admin_apk') {
            return response()->json([
                'status' => false,
                'message' => 'Hanya admin_apk yang boleh import koordinator APK'
            ], 403);
        }

        $request->validate([
            'file' => 'required|file|mimes:xls,xlsx,csv',
        ]);

        $adminApk = AdminApk::where('user_id', $user->id)->whereNull('deleted_at')->first();
        $paslonId = (int) ($adminApk?->paslon_id ?? 0);

        if (!$paslonId) {
            return response()->json([
                'status' => false,
                'message' => 'Admin APK tidak valid / tidak punya paslon.'
            ], 403);
        }

        $import = new \App\Imports\KoordinatorApkImport($paslonId);

        try {
            Excel::import($import, $request->file('file'));

            return response()->json([
                'status' => true,
                'message' => 'Import koordinator APK selesai',
                'data' => [
                    'successCount'     => $import->successCount,
                    'failed_rows'      => $import->failedRows,
                    'created_accounts' => $import->createdAccounts,
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'message' => 'Gagal import: ' . $e->getMessage()
            ], 500);
        }
    }

    public function export(Request $request)
    {
        $user = Auth::user();
        if (!$user) return response()->json(['message' => 'Unauthorized'], 401);

        $inputPassword = $request->input('password');
        if (!$inputPassword || !Hash::check($inputPassword, $user->password)) {
            return response()->json(['message' => 'Password salah'], 403);
        }

        $roleSlug = $this->roleSlug($user);

        if (!in_array($roleSlug, ['admin_paslon', 'admin_apk'], true)) {
            return response()->json([
                'status' => false,
                'message' => 'Hanya admin paslon atau admin apk yang dapat export koordinator apk'
            ], 403);
        }

        if ($roleSlug === 'admin_apk') {
            $adminApk = AdminApk::where('user_id', $user->id)->first();
            $paslonId = (int) ($adminApk?->paslon_id ?? 0);
        } else {
            $adminPaslon = AdminPaslon::where('user_id', $user->id)->whereNull('deleted_at')->first();
            $paslonId = (int) ($adminPaslon?->paslon_id ?? 0);
        }

        if (!$paslonId) {
            return response()->json(['status' => false, 'message' => 'Paslon tidak ditemukan'], 403);
        }

        $suffix = $this->paslonSuffix($paslonId);
        $filename = "KOORDINATOR_APK_{$suffix}.xlsx";

        $response = Excel::download(new KoordinatorApkExport($paslonId, $roleSlug, $suffix), $filename);
        $response->headers->set('Cache-Control', 'no-store, no-cache');
        $response->headers->set('Access-Control-Expose-Headers', 'Content-Disposition');
        return $response;
    }
}
