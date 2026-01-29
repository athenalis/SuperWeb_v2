<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\UserCredential;
use App\Models\CourierApk;
use App\Helpers\PhoneHelper;
use App\Helpers\ActivityLogger;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CourierApkController extends Controller
{
    private function roleId(string $role): int
    {
        $id = DB::table('roles')->where('role', $role)->value('id');
        if (!$id) throw new \RuntimeException("Role '{$role}' tidak ditemukan di tabel roles");
        return (int) $id;
    }

    private function userRoleSlug($user): ?string
    {
        return DB::table('roles')->where('id', $user->role_id)->value('role');
    }

    private function getApkCoordinator($user)
    {
        return DB::table('apk_koordinators')
            ->where('user_id', $user->id)
            ->whereNull('deleted_at')
            ->first();
    }

    private function getAdminApk($user)
    {
        return DB::table('admin_apks')
            ->where('user_id', $user->id)
            ->whereNull('deleted_at')
            ->first();
    }

    public function index(Request $request)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        $isApkKoor     = $roleSlug === 'apk_koordinator';
        $isAdminApk    = $roleSlug === 'admin_apk';
        $isAdminPaslon = $roleSlug === 'admin_paslon';

        if (!$isApkKoor && !$isAdminApk && !$isAdminPaslon) {
            return response()->json([
                'status'  => false,
                'message' => 'Anda tidak memiliki akses melihat data kurir APK'
            ], 403);
        }

        $paslonId = null;

        if ($isApkKoor) {
            $apkRow = $this->getApkCoordinator($actor);
            if (!$apkRow) {
                return response()->json([
                    'status'  => false,
                    'message' => 'Akun apk_koordinator tidak valid / tidak memiliki paslon'
                ], 403);
            }
            $paslonId = (int) ($apkRow->paslon_id ?? 0);
        }

        if ($isAdminApk) {
            $adminApk = $this->getAdminApk($actor);
            if (!$adminApk) {
                return response()->json([
                    'status'  => false,
                    'message' => 'Akun admin_apk tidak valid / tidak memiliki paslon'
                ], 403);
            }
            $paslonId = (int) ($adminApk->paslon_id ?? 0);
        }

        if ($isAdminPaslon) {
            $adminPaslon = DB::table('admin_paslons')
                ->where('user_id', $actor->id)
                ->whereNull('deleted_at')
                ->first();

            if (!$adminPaslon) {
                return response()->json([
                    'status'  => false,
                    'message' => 'Akun ini bukan admin paslon / tidak memiliki paslon.'
                ], 403);
            }

            $paslonId = (int) ($adminPaslon->paslon_id ?? 0);
        }

        if (!$paslonId) {
            return response()->json([
                'status'  => false,
                'message' => 'Paslon tidak ditemukan untuk akun ini.'
            ], 403);
        }

        $query = CourierApk::query()
            ->with(['user' => fn ($q) => $q->withTrashed()])
            ->where('paslon_id', $paslonId);

        if ($request->filled('search')) {
            $keyword = $request->search;
            $query->where(function ($q) use ($keyword) {
                $q->where('nama', 'like', "%{$keyword}%")
                  ->orWhere('no_hp', 'like', "%{$keyword}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('per_page')) {
            $perPage = max(1, (int) $request->per_page);
            $data = $query->orderByDesc('id')->paginate($perPage);
        } else {
            $data = $query->orderByDesc('id')->get();
        }

        return response()->json([
            'status' => true,
            'data'   => $data
        ]);
    }

    public function show($id)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        $isApkKoor     = $roleSlug === 'apk_koordinator';
        $isAdminApk    = $roleSlug === 'admin_apk';
        $isAdminPaslon = $roleSlug === 'admin_paslon';

        if (!$isApkKoor && !$isAdminApk && !$isAdminPaslon) {
            return response()->json([
                'status'  => false,
                'message' => 'Anda tidak memiliki akses melihat data kurir APK'
            ], 403);
        }

        $kurir = CourierApk::with(['user' => fn ($q) => $q->withTrashed()])->find($id);
        if (!$kurir) {
            return response()->json([
                'status'  => false,
                'message' => 'Kurir APK tidak ditemukan'
            ], 404);
        }

        $paslonId = null;

        if ($isApkKoor) {
            $apkRow = $this->getApkCoordinator($actor);
            $paslonId = (int) ($apkRow->paslon_id ?? 0);
        } elseif ($isAdminApk) {
            $adminApk = $this->getAdminApk($actor);
            $paslonId = (int) ($adminApk->paslon_id ?? 0);
        } elseif ($isAdminPaslon) {
            $adminPaslon = DB::table('admin_paslons')
                ->where('user_id', $actor->id)
                ->whereNull('deleted_at')
                ->first();
            $paslonId = (int) ($adminPaslon->paslon_id ?? 0);
        }

        if (!$paslonId || (int)$kurir->paslon_id !== (int)$paslonId) {
            return response()->json([
                'status'  => false,
                'message' => 'Anda tidak berhak melihat kurir ini'
            ], 403);
        }

        return response()->json([
            'status' => true,
            'data'   => $kurir
        ]);
    }

    public function store(Request $request)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        if ($roleSlug !== 'admin_apk') {
            return response()->json([
                'status'  => false,
                'message' => 'Hanya admin_apk yang dapat menambahkan kurir APK'
            ], 403);
        }

        // ✅ PERBAIKAN: ambil paslon dari admin_apks
        $adminApk = $this->getAdminApk($actor);
        if (!$adminApk) {
            return response()->json([
                'status'  => false,
                'message' => 'Akun admin apk tidak valid'
            ], 403);
        }

        $request->merge([
            'no_hp' => PhoneHelper::normalize($request->no_hp),
        ]);

        $validator = Validator::make($request->all(), [
            'nama' => ['required','string','max:255','regex:/^[^0-9]+$/'],
            'no_hp' => [
                'required','digits_between:10,13',
                function ($attribute, $value, $fail) {
                    if (str_starts_with($value, '021')) $fail('Nomor telepon rumah (021) tidak diperbolehkan');
                }
            ],
        ], [
            'nama.regex' => 'Nama tidak boleh mengandung angka'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $result = DB::transaction(function () use ($request, $adminApk) {

            $paslonId = (int) ($adminApk->paslon_id ?? 0);
            if (!$paslonId) {
                return ['blocked' => true, 'message' => 'Paslon admin apk tidak valid'];
            }

            $nameClean = strtolower(preg_replace('/\s+/', '', trim($request->nama)));
            $email = $nameClean . rand(1000, 9999) . '@gmail.com';
            $passwordPlain = $nameClean . rand(1000, 9999);

            if (User::where('email', $email)->exists()) {
                $email = $nameClean . rand(10000, 99999) . '@gmail.com';
            }

            $roleKurirId = $this->roleId('apk_kurir');

            $userKurir = User::create([
                'name'     => $request->nama,
                'email'    => $email,
                'password' => Hash::make($passwordPlain),
                'role_id'  => $roleKurirId,
            ]);

            UserCredential::create([
                'user_id'            => $userKurir->id,
                'encrypted_password' => Crypt::encryptString($passwordPlain),
                'type'               => 'initial',
                'is_active'          => true,
            ]);

            $kurir = CourierApk::create([
                'user_id'   => $userKurir->id,
                'paslon_id' => $paslonId,
                'nama'      => $request->nama,
                'no_hp'     => $request->no_hp,
                'status'    => 'inactive',
            ]);

            ActivityLogger::log([
                'action'      => 'CREATE',
                'target_type' => 'apk_kurir',
                'target_name' => $kurir->nama,
                'meta'        => [
                    'paslon_id' => $kurir->paslon_id,
                    'no_hp'     => $kurir->no_hp,
                ],
            ]);

            return [
                'blocked'  => false,
                'kurir'    => $kurir->load(['user']),
                'email'    => $email,
                'password' => $passwordPlain,
            ];
        });

        if (!empty($result['blocked'])) {
            return response()->json([
                'status'  => false,
                'message' => $result['message']
            ], 422);
        }

        return response()->json([
            'status'  => true,
            'message' => 'Kurir APK berhasil ditambahkan',
            'data'    => [
                'kurir' => $result['kurir'],
                'user'  => [
                    'email'    => $result['email'],
                    'password' => $result['password'],
                ],
            ]
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        // ✅ PERBAIKAN: CRUD hanya admin_apk
        if ($roleSlug !== 'admin_apk') {
            return response()->json([
                'status'  => false,
                'message' => 'Hanya admin_apk yang dapat mengubah kurir APK'
            ], 403);
        }

        $adminApk = $this->getAdminApk($actor);
        if (!$adminApk) {
            return response()->json([
                'status'  => false,
                'message' => 'Akun admin apk tidak valid'
            ], 403);
        }

        $kurir = CourierApk::with(['user' => fn ($q) => $q->withTrashed()])->find($id);
        if (!$kurir) {
            return response()->json([
                'status'  => false,
                'message' => 'Kurir APK tidak ditemukan'
            ], 404);
        }

        $paslonId = (int) ($adminApk->paslon_id ?? 0);
        if ((int)$kurir->paslon_id !== (int)$paslonId) {
            return response()->json([
                'status'  => false,
                'message' => 'Anda tidak berhak mengubah kurir ini'
            ], 403);
        }

        if ($request->filled('no_hp')) {
            $request->merge(['no_hp' => PhoneHelper::normalize($request->no_hp)]);
        }

        $validator = Validator::make($request->all(), [
            'nama'   => ['required','string','max:255','regex:/^[^0-9]+$/'],
            'no_hp'  => [
                'required','digits_between:10,13',
                function ($attribute, $value, $fail) {
                    if (str_starts_with($value, '021')) $fail('Nomor telepon rumah (021) tidak diperbolehkan');
                }
            ],
            'status' => 'sometimes|in:inactive,active',
        ], [
            'nama.regex' => 'Nama tidak boleh mengandung angka'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $result = DB::transaction(function () use ($request, $kurir) {

            $oldData = $kurir->only(['nama','no_hp','status']);
            $nameChanged = ($oldData['nama'] ?? null) !== $request->nama;

            $kurir->update([
                'nama'   => $request->nama,
                'no_hp'  => $request->no_hp,
                'status' => $request->input('status', $kurir->status),
            ]);

            $newEmail = null;
            $newPasswordPlain = null;

            if ($kurir->user) {
                $userUpdate = [
                    'name'    => $request->nama,
                    'role_id' => $this->roleId('apk_kurir'),
                ];

                if ($nameChanged) {
                    $nameClean = strtolower(preg_replace('/\s+/', '', trim($request->nama)));
                    $newEmail = $nameClean . rand(1000, 9999) . '@gmail.com';
                    $newPasswordPlain = $nameClean . rand(1000, 9999);

                    if (User::where('email', $newEmail)->where('id', '!=', $kurir->user->id)->exists()) {
                        $newEmail = $nameClean . rand(10000, 99999) . '@gmail.com';
                    }

                    $userUpdate['email'] = $newEmail;
                    $userUpdate['password'] = Hash::make($newPasswordPlain);

                    UserCredential::where('user_id', $kurir->user->id)->update(['is_active' => false]);

                    UserCredential::create([
                        'user_id'            => $kurir->user->id,
                        'encrypted_password' => Crypt::encryptString($newPasswordPlain),
                        'type'               => 'reactive',
                        'is_active'          => true,
                    ]);
                }

                $kurir->user->update($userUpdate);
            }

            foreach ($oldData as $field => $oldValue) {
                $newValue = $kurir->$field;
                if ((string)$oldValue !== (string)$newValue) {
                    ActivityLogger::log([
                        'action'      => 'UPDATE',
                        'target_type' => 'apk_kurir',
                        'target_name' => $kurir->nama,
                        'field'       => $field,
                        'old_value'   => $oldValue,
                        'new_value'   => $newValue,
                    ]);
                }
            }

            return [
                'kurir'        => $kurir->fresh()->load(['user']),
                'name_changed' => $nameChanged,
                'email'        => $newEmail,
                'password'     => $newPasswordPlain,
            ];
        });

        $userPayload = null;
        if (!empty($result['name_changed'])) {
            $userPayload = [
                'email'    => $result['email'],
                'password' => $result['password'],
            ];
        }

        return response()->json([
            'status'  => true,
            'message' => 'Kurir APK berhasil diperbarui',
            'data'    => [
                'kurir' => $result['kurir'],
                'user'  => $userPayload,
            ]
        ]);
    }

    public function destroy($id)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        if ($roleSlug !== 'admin_apk') {
            return response()->json([
                'status'  => false,
                'message' => 'Hanya admin_apk yang dapat menghapus kurir APK'
            ], 403);
        }

        $adminApk = $this->getAdminApk($actor);
        if (!$adminApk) {
            return response()->json([
                'status'  => false,
                'message' => 'Akun admin apk tidak valid'
            ], 403);
        }

        $kurir = CourierApk::withTrashed()
            ->with(['user' => fn ($q) => $q->withTrashed()])
            ->find($id);

        if (!$kurir) {
            return response()->json([
                'status'  => false,
                'message' => 'Kurir APK tidak ditemukan'
            ], 404);
        }

        $paslonId = (int) ($adminApk->paslon_id ?? 0);
        if ((int)$kurir->paslon_id !== (int)$paslonId) {
            return response()->json([
                'status'  => false,
                'message' => 'Anda tidak berhak menghapus kurir ini'
            ], 403);
        }

        $userId = (int) $kurir->user_id;
        $nama   = $kurir->nama;
        $noHp   = $kurir->no_hp;

        ActivityLogger::log([
            'action'      => 'DELETE',
            'target_type' => 'apk_kurir',
            'target_name' => $nama,
            'meta'        => [
                'paslon_id'    => $kurir->paslon_id,
                'no_hp'        => $noHp,
                'hard_delete'  => true,
            ],
        ]);

        DB::transaction(function () use ($kurir, $userId) {

            // 1) HAPUS KURIR DULU (biar FK ke users hilang)
            $kurir->forceDelete();

            // 2) Hapus semua credential user (bersih)
            UserCredential::where('user_id', $userId)->delete();

            // 3) Hapus user (hard delete)
            User::withTrashed()->where('id', $userId)->forceDelete();
        });

        return response()->json([
            'status'  => true,
            'message' => 'Kurir APK berhasil dihapus permanen'
        ]);
    }
}
