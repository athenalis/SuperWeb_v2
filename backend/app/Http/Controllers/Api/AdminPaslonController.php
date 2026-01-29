<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\Paslon;
use App\Models\AdminPaslon;
use Illuminate\Http\Request;
use App\Models\UserCredential;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
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
            'user:id,name,email,role_id',
            'user.activeCredential:id,user_id,encrypted_password,type,is_active',
        ])->find($id);

        if (!$adminPaslon) {
            return response()->json([
                'status' => false,
                'message' => 'Admin Paslon tidak ditemukan'
            ], 404);
        }

        if ($adminPaslon->user) {
            $encrypted = optional($adminPaslon->user->activeCredential)->encrypted_password;

            $adminPaslon->user->credential_password = null;

            if ($encrypted) {
                try {
                    $adminPaslon->user->credential_password = Crypt::decryptString($encrypted);
                } catch (\Throwable $e) {
                    $adminPaslon->user->credential_password = null;
                }
            }

            unset($adminPaslon->user->activeCredential); 
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

        $existing = AdminPaslon::where('paslon_id', $paslon->id)->first();
        if ($existing) {
            return response()->json([
                'status' => false,
                'message' => 'Admin Paslon untuk paslon ini sudah ada.'
            ], 400);
        }

        $name = "adminpaslon{$nomorUrut}";
        $email = "adminpaslon{$nomorUrut}@gmail.com";
        $plainPassword = "adminpaslon{$nomorUrut}" . rand(100, 999);

        DB::beginTransaction();
        try {
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($plainPassword),
                'role_id' => 2,
            ]);

            UserCredential::create([
                'user_id' => $user->id,
                'encrypted_password' => Crypt::encryptString($plainPassword),
                'type' => 'initial', 
                'is_active' => 1,
                'used_at' => null,
            ]);

            $adminPaslon = AdminPaslon::create([
                'user_id' => $user->id,
                'paslon_id' => $paslon->id
            ]);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Admin Paslon berhasil dibuat',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'password' => $plainPassword, 
                        'role_id' => $user->role_id,
                    ],
                    'admin_paslon' => $adminPaslon
                ]
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
