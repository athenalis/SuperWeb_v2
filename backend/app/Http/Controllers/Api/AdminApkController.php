<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminApk;
use App\Models\AdminPaslon;
use App\Models\User;
use App\Models\UserCredential;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AdminApkController extends Controller
{
    private function currentAdminPaslon(): AdminPaslon
    {
        $adminPaslon = AdminPaslon::where('user_id', Auth::id())->first();

        if (!$adminPaslon) {
            abort(response()->json([
                'status' => false,
                'message' => 'Admin paslon tidak ditemukan / tidak valid'
            ], 403));
        }

        return $adminPaslon;
    }

    public function index(Request $request)
    {
        $adminPaslon = $this->currentAdminPaslon();

        $query = AdminApk::with([
            'user:id,name,email,nik,role_id',
        ])->where('paslon_id', $adminPaslon->paslon_id)
            ->orderByDesc('id');

        if ($request->filled('search')) {
            $keyword = $request->search;

            $query->where(function ($q) use ($keyword) {
                $q->where('nama', 'like', "%{$keyword}%")
                    ->orWhere('nik', 'like', "%{$keyword}%")
                    ->orWhere('no_hp', 'like', "%{$keyword}%")
                    ->orWhere('status', 'like', "%{$keyword}%")
                    ->orWhereHas('user', function ($qq) use ($keyword) {
                        $qq->where('name', 'like', "%{$keyword}%")
                            ->orWhere('email', 'like', "%{$keyword}%")
                            ->orWhere('nik', 'like', "%{$keyword}%");
                    });
            });
        }

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
        $adminPaslon = $this->currentAdminPaslon();

        $adminApk = AdminApk::with([
            'user:id,name,email,nik,role_id',
        ])->where('paslon_id', $adminPaslon->paslon_id)
            ->find($id);

        if (!$adminApk) {
            return response()->json([
                'status' => false,
                'message' => 'Admin APK tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'status' => true,
            'data' => $adminApk
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nama' => 'required|string|max:255',
            'nik'  => 'required|digits_between:8,20',
            'no_hp' => [
                'nullable',
                'string',
                'max:20',
                'regex:/^[0-9]+$/',
            ],
        ], [
            'no_hp.regex' => 'Nomor HP hanya boleh berisi angka.'
        ]);

        $adminPaslon = $this->currentAdminPaslon();
        $paslonId = $adminPaslon->paslon_id;

        if (User::where('nik', $validated['nik'])->exists()) {
            return response()->json([
                'status' => false,
                'message' => 'NIK sudah terdaftar'
            ], 422);
        }

        $result = DB::transaction(function () use ($validated, $adminPaslon, $paslonId) {

            $base = strtolower($validated['nama']);
            $base = preg_replace('/\s+/', '', $base);
            $base = preg_replace('/[^a-z0-9]/', '', $base);
            if ($base === '') $base = 'user';

            do {
                $randEmail = rand(1000, 9999);
                $email = $base . $randEmail . '@gmail.com';
            } while (User::where('email', $email)->exists());

            $randPass = rand(1000, 9999);
            $plainPassword = $base . $randPass;

            $user = User::create([
                'name'     => $validated['nama'],
                'nik'      => $validated['nik'],
                'email'    => $email,
                'password' => Hash::make($plainPassword),
                'role_id'  => 3,
            ]);

            UserCredential::create([
                'user_id' => $user->id,
                'encrypted_password' => Crypt::encryptString($plainPassword),
                'type' => 'initial',
                'is_active' => 1,
                'used_at' => null,
            ]);

            $adminApk = AdminApk::create([
                'user_id'         => $user->id,
                'paslon_id'       => $paslonId,
                'admin_paslon_id' => $adminPaslon->id,
                'nama'            => $validated['nama'],
                'nik'             => $validated['nik'],
                'no_hp'           => $validated['no_hp'] ?? null,
                'status'          => 'inactive',
            ]);

            $adminApk->load('user:id,name,email,nik,role_id');

            return [$user, $adminApk, $plainPassword];
        });

        [$user, $adminApk, $plainPassword] = $result;

        return response()->json([
            'status' => true,
            'message' => 'Admin APK berhasil dibuat',
            'data' => [
                'user' => [
                    'id'       => $user->id,
                    'name'     => $user->name,
                    'email'    => $user->email,
                    'nik'      => $user->nik,
                    'password' => $plainPassword, 
                    'role_id'  => $user->role_id,
                ],
                'admin_apk' => $adminApk
            ]
        ], 201);
    }
    public function update(Request $request, $id)
    {
        $adminPaslon = $this->currentAdminPaslon();

        $adminApk = AdminApk::with('user')
            ->where('paslon_id', $adminPaslon->paslon_id)
            ->find($id);

        if (!$adminApk) {
            return response()->json([
                'status' => false,
                'message' => 'Admin APK tidak ditemukan'
            ], 404);
        }

        $validated = $request->validate([
            'nama' => 'required|string|max:255',
            'nik'  => 'required|digits_between:8,20',
            'no_hp' => [
                'nullable',
                'string',
                'max:20',
                'regex:/^[0-9]+$/',
            ],
            'status' => 'nullable|in:inactive,active',
        ], [
            'no_hp.regex' => 'Nomor HP hanya boleh berisi angka.'
        ]);

        $nikUsedByOther = User::withTrashed()
            ->where('nik', $validated['nik'])
            ->where('id', '!=', $adminApk->user_id)
            ->exists();

        if ($nikUsedByOther) {
            return response()->json([
                'status' => false,
                'message' => 'NIK sudah terdaftar'
            ], 422);
        }

        $nameChanged = trim((string) $adminApk->nama) !== trim((string) $validated['nama']);

        $newEmail = null;
        $newPasswordPlain = null;

        DB::transaction(function () use ($adminApk, $validated, $nameChanged, &$newEmail, &$newPasswordPlain) {

            $adminApk->update([
                'nama'   => $validated['nama'],
                'nik'    => $validated['nik'],
                'no_hp'  => $validated['no_hp'] ?? null,
                'status' => $validated['status'] ?? $adminApk->status,
            ]);

            if ($adminApk->user) {
                $userUpdate = [
                    'name' => $validated['nama'],
                    'nik'  => $validated['nik'],
                ];

                if ($nameChanged) {
                    $base = strtolower(trim($validated['nama']));
                    $base = preg_replace('/\s+/', '', $base);
                    $base = preg_replace('/[^a-z0-9]/', '', $base);
                    if ($base === '') $base = 'user';

                    // email unik
                    do {
                        $rand = rand(1000, 9999);
                        $newEmail = $base . $rand . '@gmail.com';
                    } while (
                        User::where('email', $newEmail)
                        ->where('id', '!=', $adminApk->user->id)
                        ->exists()
                    );

                    $newPasswordPlain = $base . rand(1000, 9999);

                    $userUpdate['email'] = $newEmail;
                    $userUpdate['password'] = Hash::make($newPasswordPlain);
                }

                $adminApk->user->update($userUpdate);

                if ($nameChanged && $newPasswordPlain) {
                    UserCredential::where('user_id', $adminApk->user->id)
                        ->where('is_active', 1)
                        ->update([
                            'is_active' => 0,
                            'used_at' => now(),
                        ]);

                    UserCredential::create([
                        'user_id' => $adminApk->user->id,
                        'encrypted_password' => Crypt::encryptString($newPasswordPlain),
                        'type' => 'reactive',
                        'is_active' => 1,
                        'used_at' => null,
                    ]);
                }
            }
        });

        $adminApk->load('user:id,name,email,nik,role_id');

        return response()->json([
            'status' => true,
            'message' => 'Admin APK berhasil diperbarui',
            'data' => [
                'admin_apk' => $adminApk,
                'user' => $nameChanged ? [
                    'email' => $newEmail,
                    'password' => $newPasswordPlain, 
                ] : null
            ]
        ]);
    }

    public function destroy($id)
    {
        $adminPaslon = $this->currentAdminPaslon();

        $adminApk = AdminApk::with('user')
            ->where('paslon_id', $adminPaslon->paslon_id)
            ->find($id);

        if (!$adminApk) {
            return response()->json([
                'status' => false,
                'message' => 'Admin APK tidak ditemukan'
            ], 404);
        }

        DB::transaction(function () use ($adminApk) {
            $adminApk->delete();

            if ($adminApk->user && method_exists($adminApk->user, 'delete')) {
                $adminApk->user->delete();
            }
        });

        return response()->json([
            'status' => true,
            'message' => 'Admin APK berhasil dihapus'
        ]);
    }
}
