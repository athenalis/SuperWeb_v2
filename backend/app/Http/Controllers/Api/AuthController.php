<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    private function setRoleStatus($user, string $status): void
    {
        $role = $user->role_name; // accessor dari User model (roles.role)

        // load relasi yg mungkin dipakai biar tidak N+1 / null
        $user->loadMissing([
            'kunjunganKoordinator',
            'apkKoordinator',
            'relawan',
            'adminPaslon',
            'adminApk',
            'apkKurir',
        ]);

        switch ($role) {
            case 'kunjungan_koordinator':
                if ($user->kunjunganKoordinator) {
                    $user->kunjunganKoordinator->update(['status' => $status]);
                }
                break;

            case 'apk_koordinator':
                if ($user->apkKoordinator) {
                    $user->apkKoordinator->update(['status' => $status]);
                }
                break;

            case 'relawan':
                if ($user->relawan) {
                    $user->relawan->update(['status' => $status]);
                }
                break;

            case 'admin_paslon':
                // kalau memang admin_paslon juga punya kolom status di tabelnya:
                if ($user->adminPaslon) {
                    // kalau admin_paslons ada kolom status:
                    if (isset($user->adminPaslon->status)) {
                        $user->adminPaslon->update(['status' => $status]);
                    } else {
                        // kalau gak ada kolom status dan cuma mau touch, biarkan
                        $user->adminPaslon->touch();
                    }
                }
                break;

            case 'admin_apk':
                if ($user->adminApk) {
                    $user->adminApk->update(['status' => $status]);
                }
                break;

            case 'apk_kurir':
                if ($user->apkKurir) {
                    $user->apkKurir->update(['status' => $status]);
                }
                break;

            default:
                // role lain: tidak melakukan apa-apa
                break;
        }
    }

    /**
     * =======================
     * LOGIN
     * =======================
     */
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required'
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json([
                'status'  => false,
                'message' => 'Email atau password salah'
            ], 401);
        }

        $user = Auth::user()->load('role');

        // ✅ status ACTIVE di tabel role masing-masing (bukan users)
        $this->setRoleStatus($user, 'active');

        // TOKEN
        $token = $user->createToken('api-token')->plainTextToken;

        // Build user response
        $userData = [
            'id'      => $user->id,
            'name'    => $user->name,
            'email'   => $user->email,
            'role'    => $user->role_name,
            'role_id' => $user->role_id,
        ];

        // Jika relawan, tambahkan is_apk dan is_kunjungan untuk redirect logic
        if ($user->role_name === 'relawan') {
            // Load relawan jika belum
            $user->loadMissing('relawan');
            
            // Default ke 0 jika relawan record tidak ada
            $userData['is_apk']       = $user->relawan ? (int) $user->relawan->is_apk : 0;
            $userData['is_kunjungan'] = $user->relawan ? (int) $user->relawan->is_kunjungan : 0;
            
            // Debug log (bisa dihapus nanti)
            \Log::info('[Login] Relawan flags', [
                'user_id' => $user->id,
                'has_relawan' => $user->relawan ? true : false,
                'is_apk' => $userData['is_apk'],
                'is_kunjungan' => $userData['is_kunjungan'],
            ]);
        }

        return response()->json([
            'status' => true,
            'token'  => $token,
            'user'   => $userData
        ]);
    }

    /**
     * =======================
     * LOGOUT
     * =======================
     */
    public function logout(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'status'  => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $user->load('role');

        // ✅ status INACTIVE di tabel role masing-masing (bukan users)
        $this->setRoleStatus($user, 'inactive');

        // ✅ HAPUS TOKEN TERAKHIR
        if ($user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        return response()->json([
            'status'  => true,
            'message' => 'Berhasil logout',
        ]);
    }

    /**
     * =======================
     * ME (PROFILE)
     * =======================
     * NOTE: kalau status bukan di users, endpoint me sebaiknya ambil dari tabel role juga.
     */
    public function me(Request $request)
    {
        $user = $request->user()->load('role');

        // ambil status dari tabel role sesuai role
        $status = null;
        $user->loadMissing([
            'kunjunganKoordinator',
            'apkKoordinator',
            'relawan',
            'adminPaslon',
            'adminApk',
            'apkKurir',
        ]);

        switch ($user->role_name) {
            case 'kunjungan_koordinator':
                $status = $user->kunjunganKoordinator->status ?? null;
                break;
            case 'apk_koordinator':
                $status = $user->apkKoordinator->status ?? null;
                break;
            case 'relawan':
                $status = $user->relawan->status ?? null;
                break;
            case 'admin_paslon':
                $status = $user->adminPaslon->status ?? null;
                break;
            case 'admin_apk':
                $status = $user->adminApk->status ?? null;
                break;
            case 'kurir_apk':
                $status = $user->apkKurir->status ?? null;
                break;
        }

        return response()->json([
            'status' => true,
            'data'   => [
                'id'     => $user->id,
                'name'   => $user->name,
                'email'  => $user->email,
                'role'   => $user->role_name,
                'status' => $status, // ✅ status dari tabel masing-masing
            ]
        ]);
    }

    /**
     * =======================
     * WILAYAH
     * =======================
     * kalau wilayah memang khusus koordinator, sesuaikan role check-nya
     */
    public function wilayah(Request $request)
    {
        $user = $request->user()->load('role');

        if (!in_array($user->role_name, ['kunjungan_koordinator', 'apk_koordinator'], true)) {
            return response()->json([
                'status'  => false,
                'message' => 'Unauthorized'
            ], 403);
        }

        if ($user->role_name === 'kunjungan_koordinator') {
            $user->loadMissing('kunjunganKoordinator');
            $koor = $user->kunjunganKoordinator;
        } else {
            $user->loadMissing('apkKoordinator');
            $koor = $user->apkKoordinator;
        }

        if (!$koor) {
            return response()->json([
                'status'  => false,
                'message' => 'Akun koordinator tidak valid'
            ], 404);
        }

        return response()->json([
            'status' => true,
            'data'   => [
                'province' => $koor->province ?? $koor->province_code ?? null,
                'city'     => $koor->city ?? $koor->city_code ?? null,
                'district' => $koor->district ?? $koor->district_code ?? null,
                'village'  => $koor->village ?? $koor->village_code ?? null,
            ]
        ]);
    }
}
