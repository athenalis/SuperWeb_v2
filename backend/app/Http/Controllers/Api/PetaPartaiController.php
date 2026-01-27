<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PartyVote;
use Illuminate\Support\Facades\DB;

class PetaPartaiController extends Controller
{
   private array $partyColors = [
        100001 => '#0B6E3F',
        100002 => '#B71C1C',
        100003 => '#C40000',
        100004 => '#FFD100',
        100005 => '#1B2E6F',
        100006 => '#FF6A00',
        100007 => '#4DA6E7',
        100008 => '#F58220',
        100009 => '#0D3B66',
        100010 => '#F05A28',
        100011 => '#D32F2F',
        100012 => '#0072BC',
        100013 => '#006400',
        100014 => '#005BAC',
        100015 => '#FF3366',
        100016 => '#1F4FD8',
        100017 => '#006B3F',
        100024 => '#111111',
    ];

    /* ======================================
       🔹 MAP PER KOTA
    ====================================== */
    public function perKota()
    {
        $rows = PartyVote::select(
                'city',
                'party',
                'party_code',
                DB::raw('SUM(jumlah) as total_suara')
            )
            ->groupBy(
                'city',
                'party',
                'party_code'
            )
            ->get();

        $grouped = $rows->groupBy(fn ($r) =>
            strtoupper(trim((string) $r->city))
        );

        $result = $grouped->map(function ($items) {
            $city = $items->first()->city;
            $winner = $items->sortByDesc('total_suara')->first();

            return [
                'city'         => $city,
                'winner_party' => trim((string) $winner->party),
                'winner_color' =>
                    $this->partyColors[$winner->party_code] ?? '#9ca3af',
                'parties' => $items->map(fn ($r) => [
                    'party'  => trim($r->party),
                    'jumlah' => (int) $r->total_suara,
                ])->values(),
            ];
        })->values();

        return response()->json([
            'status' => 'success',
            'level'  => 'kota',
            'data'   => $result,
        ]);
    }

    /* ======================================
       🔹 MAP PER KECAMATAN
    ====================================== */
    public function perKecamatan()
    {
        $rows = PartyVote::select(
                'district',
                'party',
                'party_code',
                DB::raw('SUM(jumlah) as total_suara')
            )
            ->groupBy(
                'district',
                'party',
                'party_code'
            )
            ->get();

        $grouped = $rows->groupBy(fn ($r) =>
            strtoupper(trim((string) $r->district))
        );

        $result = $grouped->map(function ($items) {

            $district = $items->first()->district;
            $winner   = $items->sortByDesc('total_suara')->first();

            return [
                'district'     => $district,
                'winner_party' => trim((string) $winner->party),
                'winner_color' =>
                    $this->partyColors[$winner->party_code] ?? '#9ca3af',

                'parties' => $items->map(fn ($r) => [
                    'party'  => trim($r->party),
                    'jumlah' => (int) $r->total_suara,
                ])->values(),
            ];
        })->values();

        return response()->json([
            'status' => 'success',
            'level'  => 'district',
            'data'   => $result,
        ]);
    }
}
