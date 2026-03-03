<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\Paslon;
use Illuminate\Http\Request;
use App\Models\UserCredential;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;

class PaslonController extends Controller
{
    public function index()
    {
        $data = Paslon::with('parties')
            ->orderBy('nomor_urut')
            ->get();

        return response()->json([
            'status' => true,
            'data'   => $data
        ]);
    }

    public function show($id)
    {
        $paslon = Paslon::with('parties')->find($id);

        if (!$paslon) {
            return response()->json([
                'status'  => false,
                'message' => 'Paslon tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'status' => true,
            'data'   => $paslon
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'cagub'         => 'required|string',
            'cawagub'       => 'required|string',
            'nomor_urut'    => 'required|integer|unique:paslons,nomor_urut',
            'party_codes'   => 'required|array',
            'party_codes.*' => 'exists:parties,party_code',
            'image'         => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        $paslon = DB::transaction(function () use ($request) {
            $imagePath = null;

            if ($request->hasFile('image')) {
                $imagePath = $request->file('image')->store('paslon', 'public');
            }

            $paslon = Paslon::create([
                'cagub'      => $request->cagub,
                'cawagub'    => $request->cawagub,
                'nomor_urut' => $request->nomor_urut,
                'image'      => $imagePath,
            ]);

            $paslon->parties()->attach($request->party_codes);

            return $paslon->load('parties');
        });

        return response()->json([
            'status'  => true,
            'message' => 'Paslon berhasil dibuat',
            'data'    => $paslon
        ]);
    }

    public function destroy($id)
    {
        $paslon = Paslon::with([
            'parties',
            'contentPlans',
            'totalBudget',
            'adminPaslon',
        ])->find($id);

        if (!$paslon) {
            return response()->json([
                'status'  => false,
                'message' => 'Paslon tidak ditemukan'
            ], 404);
        }

        DB::transaction(function () use ($paslon) {

            $paslon->parties()->detach();

            if ($paslon->contentPlans && $paslon->contentPlans->count() > 0) {
                foreach ($paslon->contentPlans as $cp) {
                    $cp->delete(); 
                }
            }

            if ($paslon->totalBudget) {
                $paslon->totalBudget->delete(); 
            }

            $adminPaslon = $paslon->adminPaslon()->first();

            if ($adminPaslon) {
                $adminUser = User::withTrashed()->find($adminPaslon->user_id);

                if ($adminUser) {
                    UserCredential::where('user_id', $adminUser->id)->delete();

                    $adminUser->forceDelete();
                }

                $adminPaslon->delete();
            }

            if (!empty($paslon->image)) {
                Storage::disk('public')->delete($paslon->image);
            }

            $paslon->delete();

            return true;
        });

        return response()->json([
            'status'  => true,
            'message' => 'Paslon berhasil dihapus (admin paslon & akun admin force delete)'
        ]);
    }
}
