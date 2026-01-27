<?php

namespace App\Http\Controllers\Api;

use App\Models\Relawan;
use App\Models\KepuasanAnswer;
use App\Models\ContentPlan;
use App\Models\Coordinator;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        // Hitung semua koordinator
        $totalCoordinators = Coordinator::count();

        // Hitung semua relawan
        $totalRelawans = Relawan::count();

        // =====================
        // CONTENT SUMMARY
        // =====================

        // ID status "Diposting"
        $postedStatusId = DB::table('content_statuses')
            ->where('label', 'Diposting')
            ->value('id');

        // Total semua konten
        $targetTotal = ContentPlan::count();

        // Total konten yang sudah diposting
        $postedTotal = ContentPlan::where('status_id', $postedStatusId)->count();

        // Hitung konten per platform (hanya yang status Diposting)
        $platformCounts = DB::table('content_platforms')
            ->join('content_plans', 'content_platforms.content_plan_id', '=', 'content_plans.id')
            ->join('platforms', 'content_platforms.platform_id', '=', 'platforms.id')
            ->where('content_plans.status_id', $postedStatusId)
            ->select('platforms.name', DB::raw('COUNT(DISTINCT content_plans.id) as total'))
            ->groupBy('platforms.name')
            ->pluck('total', 'name')
            ->toArray();

        // 5 platform yang selalu ditampilkan
        $defaultPlatforms = ['TikTok', 'Instagram', 'YouTube', 'Facebook', 'X'];

        $perPlatform = [];
        foreach ($defaultPlatforms as $platform) {
            $perPlatform[] = [
                'platform' => $platform,
                'total' => $platformCounts[$platform] ?? 0
            ];
        }

        // Kembalikan data sebagai JSON
        return response()->json([
            'success' => true,
            'data' => [
                'koordinator_total' => $totalCoordinators,
                'relawan_total' => $totalRelawans,
                'content_summary' => [
                    'per_platform' => $perPlatform,
                    'comparison' => [
                        'target' => $targetTotal,
                        'posted' => $postedTotal
                    ]
                ]
            ],
        ]);
    }

    public function progressBar()
    {
        $questions = ['tau_paslon', 'percaya', 'ingin_memilih'];

        // 🔑 Mapping label (TIDAK ubah database)
        $questionLabels = [
            'tau_paslon'     => 'Pengenalan Pasangan Calon',
            'percaya'        => 'Tingkat Kepercayaan',
            'ingin_memilih'  => 'Niat Memilih',
        ];

        $result = [];

        foreach ($questions as $q) {
            $total = KepuasanAnswer::whereNotNull($q)->count();

            if ($total == 0) {
                $percent = 0;
                $positive = 0;
            } else {
                $positive = KepuasanAnswer::where($q, '>=', 3)->count();
                $percent = round(($positive / $total) * 100);
            }

            $result[] = [
                // ⬇️ ganti key teknis jadi label manusia
                'question' => $questionLabels[$q] ?? $q,

                'percent_positive' => $percent,
                'positive_count'   => $positive,
                'total_count'      => $total,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $result
        ]);
    }

    public function stackedBar()
    {
        $questions = [
            'tau_paslon' => 'Pengenalan Pasangan Calon',
            'tau_informasi' => 'Pemahaman Informasi Pemilu',
            'tau_visi_misi' => 'Pemahaman Visi dan Misi',
            'tau_program_kerja' => 'Penilaian Program Kerja',
            'tau_rekam_jejak' => 'Penilaian Rekam Jejak',
            'percaya' => 'Tingkat Kepercayaan',
            'pertimbangan' => 'Pertimbangan Pemilih',
            'ingin_memilih' => 'Niat Memilih'
        ];

        $result = [];

        foreach ($questions as $key => $label) {
            $total = KepuasanAnswer::whereNotNull($key)->count();

            // hitung jumlah orang per jawaban 1-4
            $counts = [];
            for ($i = 1; $i <= 4; $i++) {
                $counts[$i] = KepuasanAnswer::where($key, $i)->count();
            }

            // hitung persentase per jawaban
            $percents = [];
            if ($total > 0) {
                foreach ($counts as $score => $count) {
                    $percents[$score] = round(($count / $total) * 100, 1);
                }
            } else {
                for ($i = 1; $i <= 4; $i++) $percents[$i] = 0;
            }

            $result[] = [
                'question' => $label,
                'total_responses' => $total,
                'counts' => $counts,        // angka asli
                'percents' => $percents,    // persentase untuk stacked bar
                'colors' => [
                    4 => '#22c55e', // hijau
                    3 => '#3b82f6', // biru
                    2 => '#facc15', // kuning
                    1 => '#FF0000'  // merah
                ]
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $result
        ]);
    }

    public function visitSummary()
    {
        // ======================
        // PIE: PERNAH DIKUNJUNGI
        // ======================
        $total = KepuasanAnswer::whereNotNull('pernah_dikunjungi')->count();

        $yes = KepuasanAnswer::where('pernah_dikunjungi', true)->count();
        $no  = KepuasanAnswer::where('pernah_dikunjungi', false)->count();

        if ($total > 0) {
            $yesPercent = round(($yes / $total) * 100, 1);
            $noPercent  = round(($no / $total) * 100, 1);
        } else {
            $yesPercent = 0;
            $noPercent  = 0;
        }

        // ======================
        // LIST: HARAPAN
        // ======================
        $harapan = KepuasanAnswer::whereNotNull('harapan')
            ->where('harapan', '!=', '')
            ->latest()
            ->limit(50)
            ->pluck('harapan');

        return response()->json([
            'success' => true,
            'data' => [
                'pie' => [
                    'total' => $total,
                    'series' => [
                        ['name' => 'Pernah Dikunjungi', 'value' => $yes, 'percent' => $yesPercent],
                        ['name' => 'Belum Pernah', 'value' => $no,  'percent' => $noPercent],
                    ]
                ],
                'harapan' => $harapan
            ]
        ]);
    }
}
