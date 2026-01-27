<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VoteCount;
use App\Models\PartyVote;
use Illuminate\Support\Facades\DB;

class Analisis extends Controller
{
    public function straightTicketByDistrict()
    {
        $coalitions = [
            '01' => [100004, 100008],
            '02' => [],
            '03' => [100003],
        ];

        // 1️⃣ PASLON + SUARA
        $paslon = VoteCount::select(
                'district',
                'district_code',
                DB::raw('SUM(suara_paslon_01) as v01'),
                DB::raw('SUM(suara_paslon_02) as v02'),
                DB::raw('SUM(suara_paslon_03) as v03')
            )
            ->groupBy('district', 'district_code')
            ->get()
            ->keyBy('district_code');

        // 2️⃣ PARTAI + SUARA (SEMUA)
        $parties = PartyVote::select(
                'district_code',
                'party_code',
                DB::raw('SUM(jumlah) as votes')
            )
            ->groupBy('district_code', 'party_code')
            ->get()
            ->groupBy('district_code');

        // 3️⃣ BUILD RESPONSE
        $result = [];

        foreach ($paslon as $districtCode => $row) {
            $votesPaslon = [
                '01' => (int) $row->v01,
                '02' => (int) $row->v02,
                '03' => (int) $row->v03,
            ];

            arsort($votesPaslon);
            $winner = array_key_first($votesPaslon);

            $partyVotes = [];
            foreach ($parties[$districtCode] ?? [] as $p) {
                $partyVotes[$p->party_code] = (int) $p->votes;
            }

            arsort($partyVotes);
            $dominantParty = array_key_first($partyVotes); // 🔥 INI PARTY WINNER!

            $category = isset($partyVotes[$dominantParty]) &&
                in_array($dominantParty, $coalitions[$winner] ?? [])
                ? 'Straight Ticket'
                : 'Split Ticket';

            $result[] = [
                'district' => $row->district,
                'district_code' => $districtCode,
                'winner_paslon' => $winner,
                'votes_paslon' => $votesPaslon,
                'party_winner' => $dominantParty, // ✅ TAMBAHKAN INI
                'party_votes' => $partyVotes,
                'category' => $category,
            ];
        }

        return response()->json($result);
    }
}