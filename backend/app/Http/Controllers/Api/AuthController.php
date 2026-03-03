<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    private function setRoleStatus($user, string $status): void
    {
        $role = $user->role_name;

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
                if ($user->adminPaslon) {
                    if (isset($user->adminPaslon->status)) {
                        $user->adminPaslon->update(['status' => $status]);
                    } else {
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
                break;
        }
    }

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

        $this->setRoleStatus($user, 'active');

        $token = $user->createToken('api-token')->plainTextToken;

        $userData = [
            'id'      => $user->id,
            'name'    => $user->name,
            'email'   => $user->email,
            'role'    => $user->role_name,
            'role_id' => $user->role_id,
        ];

        if ($user->role_name === 'relawan') {
            $user->loadMissing('relawan');
            
            $userData['is_apk']       = $user->relawan ? (int) $user->relawan->is_apk : 0;
            $userData['is_kunjungan'] = $user->relawan ? (int) $user->relawan->is_kunjungan : 0;
            
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

        $this->setRoleStatus($user, 'inactive');

        if ($user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        return response()->json([
            'status'  => true,
            'message' => 'Berhasil logout',
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user()->load('role');

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
                'status' => $status,
            ]
        ]);
    }

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
