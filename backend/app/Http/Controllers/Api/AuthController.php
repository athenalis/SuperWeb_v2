<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
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

        // UPDATE STATUS USER
        $user->update([
            'status' => 'active'
        ]);


        if ($user->role_name === 'kunjungan_koordinator' && $user->koordinator) {
            $user->koordinator->update(['status' => 'active']);
        }

        if ($user->role_name === 'relawan' && $user->relawan) {
            $user->relawan->update(['status' => 'active']);
        }

        if ($user->role_name === 'admin_paslon' && $user->adminPaslon) {
            $user->adminPaslon->touch();
        }

        // TOKEN
        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'status' => true,
            'token'  => $token,
            'user'   => [
                'id'      => $user->id,
                'name'    => $user->name,
                'email'   => $user->email,
                'role'    => $user->role_name,
                'role_id' => $user->role_id,  // ✅ Tambahkan role_id
            ]
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

        // ✅ UPDATE STATUS DULU (sebelum token dihapus)
        $user->update(['status' => 'inactive']);

        // ✅ UPDATE STATUS BERDASARKAN ROLE
        if ($user->role === 'koordinator' && $user->koordinator) {
            $user->koordinator->update(['status' => 'inactive']);
        }
        if ($user->role === 'relawan' && $user->relawan) {
            $user->relawan->update(['status' => 'inactive']);
        }

        // ✅ HAPUS TOKEN TERAKHIR (setelah semua update selesai)
        $user->currentAccessToken()->delete();

        return response()->json([
            'status'  => true,
            'message' => 'Berhasil logout',
        ]);
    }

    /**
     * =======================
     * ME (PROFILE)
     * =======================
     */
    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'status' => true,
            'data'   => [
                'id'     => $user->id,
                'name'   => $user->name,
                'email'  => $user->email,
                'role'   => $user->role,
                'status' => $user->status
            ]
        ]);
    }

    /**
     * =======================
     * WILAYAH (KHUSUS KOORDINATOR)
     * =======================
     */
    public function wilayah(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'koordinator') {
            return response()->json([
                'status'  => false,
                'message' => 'Unauthorized'
            ], 403);
        }

        if (!$user->koordinator) {
            return response()->json([
                'status'  => false,
                'message' => 'Akun koordinator tidak valid'
            ], 404);
        }

        return response()->json([
            'status' => true,
            'data'   => [
                'province' => $user->koordinator->province,
                'city'     => $user->koordinator->city,
                'district' => $user->koordinator->district,
                'village'  => $user->koordinator->village,
            ]
        ]);
    }
}
