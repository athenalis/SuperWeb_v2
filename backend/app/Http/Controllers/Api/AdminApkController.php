<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminApk;
use App\Models\AdminPaslon;
use App\Models\User;
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
                  ->orWhere('no_hp', 'like', "%{$keyword}%")
                  ->orWhere('status', 'like', "%{$keyword}%")
                  ->orWhereHas('user', function ($qq) use ($keyword) {
                      $qq->where('name', 'like', "%{$keyword}%")
                         ->orWhere('email', 'like', "%{$keyword}%")
                         ->orWhere('nik', 'like', "%{$keyword}%");
                  });
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
        $request->validate([
            'nama' => 'required|string|max:255',
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

        $result = DB::transaction(function () use ($request, $adminPaslon, $paslonId) {

            $plainPassword = 'adminapk' . rand(100, 999);

            $user = User::create([
                'name' => $request->nama,
                'email' => 'adminapk' . time() . rand(100, 999) . '@gmail.com',
                'password' => Hash::make($plainPassword),
                'role_id' => 3, // admin_apk
                // ⚠️ jangan isi 'status' karena tabel users kamu tidak punya kolom status
            ]);

            $adminApk = AdminApk::create([
                'user_id' => $user->id,
                'paslon_id' => $paslonId,
                'admin_paslon_id' => $adminPaslon->id,
                'nama' => $request->nama,
                'no_hp' => $request->no_hp,
                'status' => 'inactive', // ✅ default create
            ]);

            // load user biar response langsung lengkap
            $adminApk->load('user');

            return [$user, $adminApk, $plainPassword];
        });

        [$user, $adminApk, $plainPassword] = $result;

        return response()->json([
            'status' => true,
            'message' => 'Admin APK berhasil dibuat',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'password' => $plainPassword,
                    'role_id' => $user->role_id,
                ],
                'admin_apk' => $adminApk
            ]
        ], 201);
    }
}
