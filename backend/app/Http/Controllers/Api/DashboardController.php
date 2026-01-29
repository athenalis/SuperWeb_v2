<?php

namespace App\Http\Controllers\Api;

use App\Models\Relawan;
use App\Models\KepuasanAnswer;
use App\Models\ContentPlan;
use App\Models\CoordinatorVisit;
use App\Models\CoordinatorApk;
use App\Models\AdminPaslon;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    private function currentAdminPaslon(): AdminPaslon
    {
        $adminPaslon = AdminPaslon::where('user_id', Auth::id())
            ->whereNull('deleted_at')
            ->first();

        if (!$adminPaslon || !$adminPaslon->paslon_id) {
            abort(response()->json([
                'success' => false,
                'message' => 'Admin paslon tidak ditemukan / tidak valid'
            ], 403));
        }

        return $adminPaslon;
    }

    private function currentPaslonId(): int
    {
        return (int) $this->currentAdminPaslon()->paslon_id;
    }

    public function index()
    {
        $paslonId = $this->currentPaslonId();

        $koorKunjunganTotal = CoordinatorVisit::where('paslon_id', $paslonId)->whereNull('deleted_at')->count();
        $koorApkTotal       = CoordinatorApk::where('paslon_id', $paslonId)->whereNull('deleted_at')->count();

        $koordinatorTotal = $koorKunjunganTotal + $koorApkTotal;

        $totalRelawans = Relawan::query()
            ->where('paslon_id', $paslonId)
            ->whereNull('deleted_at')
            ->count();

        $postedStatusId = DB::table('content_statuses')
            ->where('label', 'Diposting')
            ->value('id');

        $targetTotal = ContentPlan::query()
            ->where('paslon_id', $paslonId)
            ->count();

        $postedTotal = ContentPlan::query()
            ->where('paslon_id', $paslonId)
            ->where('status_id', $postedStatusId)
            ->count();

        $platformCounts = DB::table('content_platforms')
            ->join('content_plans', 'content_platforms.content_plan_id', '=', 'content_plans.id')
            ->join('platforms', 'content_platforms.platform_id', '=', 'platforms.id')
            ->where('content_plans.paslon_id', $paslonId)
            ->where('content_plans.status_id', $postedStatusId)
            ->select('platforms.name', DB::raw('COUNT(DISTINCT content_plans.id) as total'))
            ->groupBy('platforms.name')
            ->pluck('total', 'name')
            ->toArray();

        $defaultPlatforms = ['TikTok', 'Instagram', 'YouTube', 'Facebook', 'X'];

        $perPlatform = [];
        foreach ($defaultPlatforms as $platform) {
            $perPlatform[] = [
                'platform' => $platform,
                'total'    => (int) ($platformCounts[$platform] ?? 0),
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'koordinator_total' => $koordinatorTotal,
                'koordinator_kunjungan_total' => $koorKunjunganTotal,
                'koordinator_apk_total' => $koorApkTotal,

                'relawan_total' => $totalRelawans,

                'content_summary' => [
                    'per_platform' => $perPlatform,
                    'comparison' => [
                        'target' => $targetTotal,
                        'posted' => $postedTotal,
                    ],
                ],
            ],
        ]);
    }

    public function progressBar()
    {
        $paslonId = $this->currentPaslonId();

        $questions = ['tau_paslon', 'percaya', 'ingin_memilih'];

        $questionLabels = [
            'tau_paslon'     => 'Pengenalan Pasangan Calon',
            'percaya'        => 'Tingkat Kepercayaan',
            'ingin_memilih'  => 'Niat Memilih',
        ];

        $result = [];

        foreach ($questions as $q) {
            $total = KepuasanAnswer::where('paslon_id', $paslonId)
                ->whereNotNull($q)
                ->count();

            if ($total == 0) {
                $percent = 0;
                $positive = 0;
            } else {
                $positive = KepuasanAnswer::where('paslon_id', $paslonId)
                    ->where($q, '>=', 3)
                    ->count();

                $percent = round(($positive / $total) * 100);
            }

            $result[] = [
                'question'          => $questionLabels[$q] ?? $q,
                'percent_positive'  => $percent,
                'positive_count'    => $positive,
                'total_count'       => $total,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $result
        ]);
    }

    public function stackedBar()
    {
        $paslonId = $this->currentPaslonId();

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
            $total = KepuasanAnswer::where('paslon_id', $paslonId)
                ->whereNotNull($key)
                ->count();

            $counts = [];
            for ($i = 1; $i <= 4; $i++) {
                $counts[$i] = KepuasanAnswer::where('paslon_id', $paslonId)
                    ->where($key, $i)
                    ->count();
            }

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
                'counts' => $counts,
                'percents' => $percents,
                'colors' => [
                    4 => '#22c55e',
                    3 => '#3b82f6',
                    2 => '#facc15',
                    1 => '#FF0000'
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
        $paslonId = $this->currentPaslonId();

        $total = KepuasanAnswer::where('paslon_id', $paslonId)
            ->whereNotNull('pernah_dikunjungi')
            ->count();

        $yes = KepuasanAnswer::where('paslon_id', $paslonId)
            ->where('pernah_dikunjungi', true)
            ->count();

        $no  = KepuasanAnswer::where('paslon_id', $paslonId)
            ->where('pernah_dikunjungi', false)
            ->count();

        if ($total > 0) {
            $yesPercent = round(($yes / $total) * 100, 1);
            $noPercent  = round(($no / $total) * 100, 1);
        } else {
            $yesPercent = 0;
            $noPercent  = 0;
        }

        $harapan = KepuasanAnswer::where('paslon_id', $paslonId)
            ->whereNotNull('harapan')
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
