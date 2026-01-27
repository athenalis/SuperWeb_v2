<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VoteCount;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class PetaSuaraController extends Controller
{
    private $paslonColors = [
        'paslon_01' => '#FFD100',
        'paslon_02' => '#16a34a',
        'paslon_03' => '#C40000',
    ];

    /**
     * Agregasi suara per Kota (City level)
     */
    public function perKota()
    {
        $result = Cache::remember('peta_paslon_kota', 300, function () {
            $rows = VoteCount::select(
                    'city',
                    'city_code',
                    DB::raw('SUM(suara_paslon_01) as p1'),
                    DB::raw('SUM(suara_paslon_02) as p2'),
                    DB::raw('SUM(suara_paslon_03) as p3')
                )
                ->groupBy('city', 'city_code')
                ->get();
    
            return $result = $rows->map(function ($row) {
                $suara = [
                    'paslon_01' => (int) $row->p1,
                    'paslon_02' => (int) $row->p2,
                    'paslon_03' => (int) $row->p3,
                ];
    
                $max = max($suara);
                $winners = array_keys($suara, $max);
    
                if (count($winners) > 1) {
                    return [
                        'city'          => $row->city,
                        'city_code'     => 'id'.$row->city_code,
                        'winner_paslon' => 'tie',
                        'winner_color'  => '#9ca3af',
                        'suara'         => $suara,
                    ];
                }
    
                $winner = $winners[0];
    
                return [
                    'city'          => $row->city,
                    'city_code'     => 'id'.$row->city_code,
                    'winner_paslon' => $winner,
                    'winner_color'  => $this->paslonColors[$winner],
                    'suara'         => $suara,
                ];
            });
        });

        return response()->json([
            'status' => 'success',
            'data'   => $result
        ]);
    }

    /**
     * Agregasi suara per Kecamatan (District level)
     */
    public function perKecamatan()
    {
        $result = Cache::remember('peta_paslon_kecamatan', 300, function () {
            $rows = VoteCount::select(
                    'district',
                    'district_code',
                    'city',
                    'city_code',
                    DB::raw('SUM(suara_paslon_01) as p1'),
                    DB::raw('SUM(suara_paslon_02) as p2'),
                    DB::raw('SUM(suara_paslon_03) as p3')
                )
                ->groupBy('district', 'district_code', 'city', 'city_code')
                ->get();
    
            return $result = $rows->map(function ($row) {
                $suara = [
                    'paslon_01' => (int) $row->p1,
                    'paslon_02' => (int) $row->p2,
                    'paslon_03' => (int) $row->p3,
                ];
    
                $max = max($suara);
                $winners = array_keys($suara, $max);
    
                if (count($winners) > 1) {
                    return [
                        'district'       => $row->district,
                        'district_code'  => 'id'.$row->district_code,
                        'city'           => $row->city,
                        'city_code'      => $row->city_code,
                        'winner_paslon'  => 'tie',
                        'winner_color'   => '#9ca3af',
                        'suara'          => $suara,
                    ];
                }
    
                $winner = $winners[0];
    
                return [
                    'district'       => $row->district,
                    'district_code'  => 'id'.$row->district_code,
                    'city'           => $row->city,
                    'city_code'      => $row->city_code,
                    'winner_paslon'  => $winner,
                    'winner_color'   => $this->paslonColors[$winner],
                    'suara'          => $suara,
                ];
            });
        });

        return response()->json([
            'status' => 'success',
            'data'   => $result
        ]);
    }

    /**
     * Agregasi suara per Kelurahan (Village level)
     */
    public function perKelurahan()
    {
        $result = Cache::remember('peta_paslon_kelurahan', 300, function () {
            $rows = VoteCount::select(
                    'village',
                    'village_code',
                    'district',
                    'district_code',
                    DB::raw('SUM(suara_paslon_01) as p1'),
                    DB::raw('SUM(suara_paslon_02) as p2'),
                    DB::raw('SUM(suara_paslon_03) as p3')
                )
                ->groupBy(
                    'village',
                    'village_code',
                    'district',
                    'district_code'
                )
                ->get();
    
            return $result = $rows->map(function ($row) {
                $suara = [
                    'paslon_01' => (int) $row->p1,
                    'paslon_02' => (int) $row->p2,
                    'paslon_03' => (int) $row->p3,
                ];
    
                $max = max($suara);
                $winners = array_keys($suara, $max);
    
                if (count($winners) > 1) {
                    return [
                        'village'        => $row->village,
                        'village_code'   => 'id'.$row->village_code,
                        'district'       => $row->district,
                        'district_code'  => $row->district_code,
                        'winner_paslon'  => 'tie',
                        'winner_color'   => '#9ca3af',
                        'suara'          => $suara,
                    ];
                }
    
                $winner = $winners[0];
    
                return [
                    'village'        => $row->village,
                    'village_code'   => 'id'.$row->village_code,
                    'district'       => $row->district,
                    'district_code'  => $row->district_code,
                    'winner_paslon'  => $winner,
                    'winner_color'   => $this->paslonColors[$winner],
                    'suara'          => $suara,
                ];
            });
        });

        return response()->json([
            'status' => 'success',
            'data'   => $result
        ]);
    }
}
