<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminPaslon;
use App\Models\Paslon;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AdminPaslonController extends Controller
{
    public function index(Request $request)
    {
        $query = AdminPaslon::with([
            'paslon:id,cagub,cawagub,nomor_urut,image',
            'user:id,name,email,role_id'
        ])->orderByDesc('id');

        if ($request->filled('search')) {
            $keyword = $request->search;
            $query->where(function ($q) use ($keyword) {
                $q->whereHas(
                    'user',
                    fn($qq) =>
                    $qq->where('name', 'like', "%{$keyword}%")
                        ->orWhere('email', 'like', "%{$keyword}%")
                )
                    ->orWhereHas(
                        'paslon',
                        fn($qq) =>
                        $qq->where('cagub', 'like', "%{$keyword}%")
                            ->orWhere('cawagub', 'like', "%{$keyword}%")
                            ->orWhere('nomor_urut', 'like', "%{$keyword}%")
                    );
            });
        }

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
        $adminPaslon = AdminPaslon::with([
            'paslon:id,cagub,cawagub,nomor_urut,image',
            'user:id,name,email,role_id'
        ])->find($id);

        if (!$adminPaslon) {
            return response()->json([
                'status' => false,
                'message' => 'Admin Paslon tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'status' => true,
            'data' => $adminPaslon
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'paslon_id' => 'required|exists:paslons,id'
        ]);

        $paslon = Paslon::findOrFail($request->paslon_id);
        $nomorUrut = $paslon->nomor_urut;

        // 1️⃣ Cek apakah admin paslon sudah ada
        $existing = AdminPaslon::where('paslon_id', $paslon->id)->first();
        if ($existing) {
            return response()->json([
                'status' => false,
                'message' => 'Admin Paslon untuk paslon ini sudah ada.'
            ], 400);
        }

        // 2️⃣ Generate user
        $name = "adminpaslon{$nomorUrut}";
        $email = "adminpaslon{$nomorUrut}@gmail.com";
        $plainPassword = "adminpaslon{$nomorUrut}" . rand(100, 999);

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($plainPassword),
            // 'plain_password' => $plainPassword, // simpan supaya bisa dikirim ke admin
            'role_id' => '2',
            'status' => 'active'
        ]);

        // 3️⃣ Buat admin paslon
        $adminPaslon = AdminPaslon::create([
            'user_id' => $user->id,
            'paslon_id' => $paslon->id
        ]);

        return response()->json([
            'status' => true,
            'message' => 'Admin Paslon berhasil dibuat',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'password' => $plainPassword, // kasih ke frontend supaya bisa diinformasikan
                    'role' => $user->role
                ],
                'admin_paslon' => $adminPaslon
            ]
        ]);
    }
}
