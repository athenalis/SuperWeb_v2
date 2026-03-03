<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\CourierApk;
use App\Helpers\PhoneHelper;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\KurirApkExport;
use App\Models\UserCredential;
use App\Helpers\ActivityLogger;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Crypt;
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

    private function getAdminApk($user)
    {
        return DB::table('admin_apks')
            ->where('user_id', $user->id)
            ->whereNull('deleted_at')
            ->first();
    }

    private function requireAdminApkAndPaslon()
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        if ($roleSlug !== 'admin_apk') {
            return response()->json([
                'status'  => false,
                'message' => 'Hanya admin_apk yang memiliki akses.'
            ], 403);
        }

        $adminApk = $this->getAdminApk($actor);
        if (!$adminApk) {
            return response()->json([
                'status'  => false,
                'message' => 'Akun admin apk tidak valid / tidak memiliki paslon'
            ], 403);
        }

        $paslonId = (int) ($adminApk->paslon_id ?? 0);
        if (!$paslonId) {
            return response()->json([
                'status'  => false,
                'message' => 'Paslon admin apk tidak valid'
            ], 403);
        }

        return [$adminApk, $paslonId];
    }

    private function normalizeNoHpOrFail(?string $raw)
    {
        $normalized = PhoneHelper::normalize($raw);

        if (!$normalized) {
            return response()->json([
                'status' => false,
                'errors' => [
                    'no_hp' => [PhoneHelper::lastError() ?? 'Nomor HP tidak valid']
                ]
            ], 422);
        }

        return $normalized;
    }

    public function index(Request $request)
    {
        $guard = $this->requireAdminApkAndPaslon();
        if ($guard instanceof JsonResponse) return $guard;
        [, $paslonId] = $guard;

        $query = CourierApk::query()
            ->with(['user' => fn($q) => $q->withTrashed()])
            ->where('paslon_id', $paslonId)
            ->withCount([
                'requestsAssigned as total_pengiriman',
                'requestsAssigned as pengiriman_selesai' => function ($query) {
                    $query->whereHas('status', function ($q) {
                        $q->where('code', 'DELIVERED');
                    });
                }
            ]);

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
        $guard = $this->requireAdminApkAndPaslon();
        if ($guard instanceof JsonResponse) return $guard;
        [, $paslonId] = $guard;

        $kurir = CourierApk::with(['user' => fn($q) => $q->withTrashed()])->find($id);
        if (!$kurir) {
            return response()->json([
                'status'  => false,
                'message' => 'Kurir APK tidak ditemukan'
            ], 404);
        }

        if ((int) $kurir->paslon_id !== (int) $paslonId) {
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
        $guard = $this->requireAdminApkAndPaslon();
        if ($guard instanceof JsonResponse) return $guard;
        [, $paslonId] = $guard;

        $normalized = $this->normalizeNoHpOrFail($request->no_hp);
        if ($normalized instanceof JsonResponse) return $normalized;
        $request->merge(['no_hp' => $normalized]);

        $validator = Validator::make($request->all(), [
            'nama'  => ['required', 'string', 'max:255', 'regex:/^[^0-9]+$/'],
            'no_hp' => ['required', 'regex:/^08\d{8,11}$/'],
        ], [
            'nama.regex' => 'Nama tidak boleh mengandung angka',
            'no_hp.regex' => 'Nomor HP harus format 08xxxxxxxxxx (10-13 digit)',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $result = DB::transaction(function () use ($request, $paslonId) {

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
                'kurir'    => $kurir->load(['user' => fn($q) => $q->withTrashed()]),
                'email'    => $email,
                'password' => $passwordPlain,
            ];
        });

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
        $guard = $this->requireAdminApkAndPaslon();
        if ($guard instanceof JsonResponse) return $guard;
        [, $paslonId] = $guard;

        $kurir = CourierApk::with(['user' => fn($q) => $q->withTrashed()])->find($id);
        if (!$kurir) {
            return response()->json([
                'status'  => false,
                'message' => 'Kurir APK tidak ditemukan'
            ], 404);
        }

        if ((int) $kurir->paslon_id !== (int) $paslonId) {
            return response()->json([
                'status'  => false,
                'message' => 'Anda tidak berhak mengubah kurir ini'
            ], 403);
        }

        if ($request->filled('no_hp')) {
            $normalized = $this->normalizeNoHpOrFail($request->no_hp);
            if ($normalized instanceof JsonResponse) return $normalized;
            $request->merge(['no_hp' => $normalized]);
        }

        $validator = Validator::make($request->all(), [
            'nama'   => ['required', 'string', 'max:255', 'regex:/^[^0-9]+$/'],
            'no_hp'  => ['required', 'regex:/^08\d{8,11}$/'],
            'status' => 'sometimes|in:inactive,active',
        ], [
            'nama.regex' => 'Nama tidak boleh mengandung angka',
            'no_hp.regex' => 'Nomor HP harus format 08xxxxxxxxxx (10-13 digit)',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $result = DB::transaction(function () use ($request, $kurir) {

            $oldData = $kurir->only(['nama', 'no_hp', 'status']);
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
                if ((string) $oldValue !== (string) $newValue) {
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
                'kurir'        => $kurir->fresh()->load(['user' => fn($q) => $q->withTrashed()]),
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
        $guard = $this->requireAdminApkAndPaslon();
        if ($guard instanceof JsonResponse) return $guard;
        [, $paslonId] = $guard;

        $kurir = CourierApk::withTrashed()
            ->with(['user' => fn($q) => $q->withTrashed()])
            ->find($id);

        if (!$kurir) {
            return response()->json([
                'status'  => false,
                'message' => 'Kurir APK tidak ditemukan'
            ], 404);
        }

        if ((int) $kurir->paslon_id !== (int) $paslonId) {
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
                'paslon_id'   => $kurir->paslon_id,
                'no_hp'       => $noHp,
                'hard_delete' => true,
            ],
        ]);

        DB::transaction(function () use ($kurir, $userId) {
            $kurir->forceDelete();
            UserCredential::where('user_id', $userId)->delete();
            User::withTrashed()->where('id', $userId)->forceDelete();
        });

        return response()->json([
            'status'  => true,
            'message' => 'Kurir APK berhasil dihapus permanen'
        ]);
    }

    public function active()
    {
        $guard = $this->requireAdminApkAndPaslon();
        if ($guard instanceof JsonResponse) return $guard;
        [, $paslonId] = $guard;

        $data = CourierApk::query()
            ->select('id', 'user_id', 'paslon_id', 'nama', 'no_hp', 'status')
            ->whereNull('deleted_at')
            ->where('status', 'active')
            ->where('paslon_id', $paslonId)
            ->orderBy('nama')
            ->get();

        return response()->json([
            'status' => true,
            'data'   => $data
        ]);
    }

    public function exportKurir(Request $request)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        if ($roleSlug !== 'admin_apk') {
            return response()->json([
                'status'  => false,
                'message' => 'Hanya admin_apk yang dapat export kurir apk'
            ], 403);
        }

        $password = $request->password;
        if (!password_verify($password, $actor->password)) {
            return response()->json(['message' => 'Password salah'], 422);
        }

        $guard = $this->requireAdminApkAndPaslon();
        if ($guard instanceof JsonResponse) return $guard;
        [, $paslonId] = $guard;

        $nomorUrut = (int) (DB::table('paslons')->where('id', $paslonId)->value('nomor_urut') ?? 0);
        $suffix = $nomorUrut
            ? str_pad((string)$nomorUrut, 2, '0', STR_PAD_LEFT)
            : str_pad((string)$paslonId, 2, '0', STR_PAD_LEFT);

        $fileName = "KURIR_APK_{$suffix}.xlsx";

        $response = Excel::download(
            new KurirApkExport((int)$paslonId),
            $fileName
        );

        $response->headers->set('Cache-Control', 'no-store, no-cache');
        $response->headers->set('Access-Control-Expose-Headers', 'Content-Disposition');
        return $response;
    }
}
