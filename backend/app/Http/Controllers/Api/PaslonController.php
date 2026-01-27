<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Paslon;
use App\Models\Party;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaslonController extends Controller
{
    public function index()
    {
        $data = Paslon::with('parties')
            ->orderBy('nomor_urut')
            ->get();

        return response()->json([
            'status' => true,
            'data' => $data
        ]);
    }

    public function show($id)
    {
        $paslon = Paslon::with('parties')->find($id);

        if (!$paslon) {
            return response()->json([
                'status' => false,
                'message' => 'Paslon tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'status' => true,
            'data' => $paslon
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'cagub'       => 'required|string',
            'cawagub'     => 'required|string',
            'nomor_urut'  => 'required|integer|unique:paslons,nomor_urut',
            'party_codes' => 'required|array',
            'party_codes.*' => 'exists:parties,party_code',
            'image'       => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        DB::transaction(function () use ($request, &$paslon) {

            $imagePath = null;

            if ($request->hasFile('image')) {
                $imagePath = $request->file('image')
                    ->store('paslon', 'public');
                // hasil: paslon/xxxx.png
            }

            $paslon = Paslon::create([
                'cagub'      => $request->cagub,
                'cawagub'    => $request->cawagub,
                'nomor_urut' => $request->nomor_urut,
                'image'      => $imagePath,
            ]);

            $paslon->parties()->attach($request->party_codes);
        });

        return response()->json([
            'status' => true,
            'message' => 'Paslon berhasil dibuat',
            'data' => $paslon->load('parties')
        ]);
    }
}
