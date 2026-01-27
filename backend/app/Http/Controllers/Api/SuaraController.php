<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Paslon;
use App\Models\VoteCount;

class SuaraController extends Controller
{
    public function paslonCard()
    {
        $raw = Paslon::select(
            'paslon_id',
            'nama_paslon',
            'party',
            'party_code'
        )->get();

        $data = $raw->groupBy(function ($item) {
            return explode('/', $item->paslon_id)[1];
        })->map(function ($items, $paslonNumber) {

            $gubernur = $items->first(function ($item) {
                return str_ends_with($item->paslon_id, '/01');
            });

            $wakil = $items->first(function ($item) {
                return str_ends_with($item->paslon_id, '/02');
            });

            return [
                'paslon_number' => $paslonNumber,
                'paslon_name' => trim(
                    ($gubernur?->nama_paslon ?? '') .
                    ' - ' .
                    ($wakil?->nama_paslon ?? '')
                ),
                'paslon_ids' => $items->pluck('paslon_id')->values(),
                'party' => $items->first()->party,
                'party_code' => $items->first()->party_code,
            ];
        })->values();

        return response()->json($data);
    }

    public function diagramPaslon(Request $request)
    {
        $query = VoteCount::query();

        $query->when($request->city_code, fn($q) =>
            $q->where('city_code', $request->city_code)
        );

        $query->when($request->district_code, fn($q) =>
            $q->where('district_code', $request->district_code)
        );

        if ($request->boolean('summary')) {
            return response()->json([
                'paslon_01' => (int) $query->sum('suara_paslon_01'),
                'paslon_02' => (int) $query->sum('suara_paslon_02'),
                'paslon_03' => (int) $query->sum('suara_paslon_03'),
            ]);
        }

        if ($request->city_code && $request->district_code && $request->village_code) {
            return $query
                ->where('village_code', $request->village_code)
                ->select(
                    'village',
                    'village_code',
                    DB::raw('SUM(suara_paslon_01) as paslon_01'),
                    DB::raw('SUM(suara_paslon_02) as paslon_02'),
                    DB::raw('SUM(suara_paslon_03) as paslon_03')
                )
                ->groupBy('village', 'village_code')
                ->get();
        }

        if ($request->city_code && $request->district_code) {
            return $query
                ->select(
                    'village',
                    'village_code',
                    DB::raw('SUM(suara_paslon_01) as paslon_01'),
                    DB::raw('SUM(suara_paslon_02) as paslon_02'),
                    DB::raw('SUM(suara_paslon_03) as paslon_03')
                )
                ->groupBy('village', 'village_code')
                ->orderBy('village_code', 'asc')
                ->get();
        }

        if ($request->city_code) {
            return $query
                ->select(
                    'district',
                    'district_code',
                    DB::raw('SUM(suara_paslon_01) as paslon_01'),
                    DB::raw('SUM(suara_paslon_02) as paslon_02'),
                    DB::raw('SUM(suara_paslon_03) as paslon_03')
                )
                ->groupBy('district', 'district_code')
                ->orderBy('district_code', 'asc')
                ->get();
        }

        return $query
            ->select(
                'city',
                'city_code',
                DB::raw('SUM(suara_paslon_01) as paslon_01'),
                DB::raw('SUM(suara_paslon_02) as paslon_02'),
                DB::raw('SUM(suara_paslon_03) as paslon_03')
            )
            ->groupBy('city', 'city_code')
            ->orderBy('city_code', 'asc')
            ->get();
    }

public function diagramPartai(Request $request)
{
    $cleanPartyExpr = "
        TRIM(
            REPLACE(
                REPLACE(party, CHAR(13), ''),
                CHAR(10), ''
            )
        )
    ";

    $query = DB::table('suara_partai');

    // filter wilayah (opsional)
    $query->when($request->city_code, fn ($q) =>
        $q->where('city_code', $request->city_code)
    );

    $query->when($request->district_code, fn ($q) =>
        $q->where('district_code', $request->district_code)
    );

    return response()->json(
        $query
            ->select(
                DB::raw("$cleanPartyExpr as party"),
                'party_code',
                DB::raw('SUM(jumlah) as total_suara')
            )
            ->groupBy(
                DB::raw($cleanPartyExpr),
                'party_code'
            )
            ->orderByDesc('total_suara')
            ->get()
    );
}
}