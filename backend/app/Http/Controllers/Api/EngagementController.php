<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContentPlatform;
use App\Models\Engagement;
use App\Models\ContentPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class EngagementController extends Controller
{
    public function analyticContent($contentPlanId)
    {
        // Cache untuk 5 menit per content plan
        $cacheKey = "analytic_content_{$contentPlanId}";

        return Cache::remember($cacheKey, 300, function () use ($contentPlanId) {
            $contentPlan = ContentPlan::with([
                'status',
                'contentPlatforms' => function ($query) {
                    $query->select('id', 'content_plan_id', 'platform_id', 'content_type_id', 'link')
                        ->with([
                            'platform:id,name',
                            'contentType:id,name',
                            'engagements' => function ($q) {
                                $q->select('id', 'content_platform_id', 'start_date', 'end_date', 'likes', 'views')
                                    ->orderBy('start_date');
                            }
                        ]);
                }
            ])
                ->select('id', 'title', 'status_id')
                ->findOrFail($contentPlanId);

            // ❌ Belum diposting
            if ($contentPlan->status->label !== 'Diposting') {
                return response()->json([
                    'content' => [
                        'id' => $contentPlan->id,
                        'title' => $contentPlan->title,
                        'status_label' => $contentPlan->status->label,
                    ],
                    'chart_meta' => [
                        'status' => 'not_posted',
                        'message' => 'Konten ini belum diposting',
                    ],
                    'platforms_available' => [],
                    'reports' => [],
                    'chart' => [],
                ]);
            }

            $platformsAvailable = [];
            $reports = [];
            $chart = [];

            foreach ($contentPlan->contentPlatforms as $cp) {
                $platformId = $cp->platform->id;
                $engagements = $cp->engagements;

                /* =========================
                 * PLATFORMS AVAILABLE
                 * ========================= */
                if (!isset($platformsAvailable[$platformId])) {
                    $platformsAvailable[$platformId] = [
                        'platform_id' => $platformId,
                        'platform_name' => $cp->platform->name,
                    ];
                }

                /* =========================
                 * REPORTS
                 * ========================= */
                if (!isset($reports[$platformId])) {
                    $reports[$platformId] = [
                        'platform_id' => $platformId,
                        'platform_name' => $cp->platform->name,
                        'content_types' => [],
                    ];
                }

                $reports[$platformId]['content_types'][$cp->id] = [
                    'content_platform_id' => $cp->id,
                    'content_type_id' => $cp->content_type_id,
                    'content_type_name' => $cp->contentType->name,
                    'link' => $cp->link,
                    'data' => $engagements->map(fn($e) => [
                        'record_id' => $e->id,
                        'start_date' => $e->start_date->format('Y-m-d'),
                        'end_date' => $e->end_date->format('Y-m-d'),
                        'likes' => (int) $e->likes,
                        'views' => (int) $e->views,
                    ])->values(),
                ];

                /* =========================
                 * CHART
                 * ========================= */
                foreach ($engagements as $e) {
                    $chart[] = [
                        'platform_id' => $platformId,
                        'platform_name' => $cp->platform->name,
                        'content_platform_id' => $cp->id,
                        'content_type' => $cp->contentType->name,
                        'start_date' => $e->start_date->format('Y-m-d'),
                        'end_date' => $e->end_date->format('Y-m-d'),
                        'views' => (int) $e->views,
                        'likes' => (int) $e->likes,
                    ];
                }
            }

            return response()->json([
                'content' => [
                    'id' => $contentPlan->id,
                    'title' => $contentPlan->title,
                    'status_label' => $contentPlan->status->label,
                ],
                'chart_meta' => [
                    'status' => empty($chart) ? 'empty' : 'ready',
                    'message' => empty($chart) ? 'Data belum tersedia' : null,
                ],
                'platforms_available' => array_values($platformsAvailable),
                'reports' => $reports,
                'chart' => $chart,
            ]);
        });
    }

    public function store(Request $request, $contentPlanId)
    {
        $validated = $request->validate([
            'content_platform_id' => 'required|exists:content_platforms,id',
            'start_date'          => 'required|date',
            'end_date'            => 'required|date|after_or_equal:start_date',
            'likes'               => 'required|integer|min:0',
            'views'               => 'required|integer|min:0',
        ]);

        // Pastikan content_platform_id memang milik content plan ini + ambil posting_date
        $cp = ContentPlatform::with('contentPlan:id,posting_date')
            ->where('id', $validated['content_platform_id'])
            ->where('content_plan_id', $contentPlanId)
            ->firstOrFail();

        $postingDate = optional($cp->contentPlan)->posting_date; // cast => Carbon (date)

        if (!$postingDate) {
            return response()->json([
                'message' => 'Posting date belum diset pada content plan'
            ], 422);
        }

        $start = \Carbon\Carbon::parse($validated['start_date'])->startOfDay();
        $end   = \Carbon\Carbon::parse($validated['end_date'])->startOfDay();
        $post  = \Carbon\Carbon::parse($postingDate)->startOfDay();

        // ✅ RULE BARU: start/end tidak boleh < posting_date
        if ($start->lt($post) || $end->lt($post)) {
            return response()->json([
                'message' => "Start date dan End date tidak boleh sebelum tanggal posting ({$post->format('Y-m-d')})"
            ], 422);
        }

        // 🔒 Validasi overlap periode tanggal
        $hasOverlap = $this->checkOverlap(
            $cp->id,
            $start->format('Y-m-d'),
            $end->format('Y-m-d')
        );

        if ($hasOverlap) {
            return response()->json([
                'message' => 'Periode tanggal bertabrakan dengan data yang sudah ada'
            ], 422);
        }

        DB::beginTransaction();
        try {
            $engagement = Engagement::create([
                'content_platform_id' => $cp->id,
                'start_date'          => $start->format('Y-m-d'),
                'end_date'            => $end->format('Y-m-d'),
                'likes'               => $validated['likes'],
                'views'               => $validated['views'],
            ]);

            // 🧹 Clear cache setelah insert
            $this->clearAnalyticCache((int) $contentPlanId);

            DB::commit();

            return response()->json([
                'message' => 'Engagement berhasil ditambahkan',
                'data' => [
                    'record_id' => $engagement->id,
                    'content_platform_id' => $engagement->content_platform_id,
                    'start_date' => $engagement->start_date->format('Y-m-d'),
                    'end_date' => $engagement->end_date->format('Y-m-d'),
                    'likes' => (int) $engagement->likes,
                    'views' => (int) $engagement->views,
                ],
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal menyimpan engagement',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, $contentPlanId, $engagementId)
    {
        $validated = $request->validate([
            'start_date' => 'required|date',
            'end_date'   => 'required|date|after_or_equal:start_date',
            'likes'      => 'required|integer|min:0',
            'views'      => 'required|integer|min:0',
        ]);

        $engagement = Engagement::with('contentPlatform.contentPlan:id,posting_date')
            ->findOrFail($engagementId);

        $cp = $engagement->contentPlatform;

        // 🔒 Pastikan engagement milik content plan ini
        if (!$cp || $cp->content_plan_id !== (int) $contentPlanId) {
            abort(404);
        }

        $postingDate = optional($cp->contentPlan)->posting_date;

        if (!$postingDate) {
            return response()->json([
                'message' => 'Posting date belum diset pada content plan'
            ], 422);
        }

        $start = \Carbon\Carbon::parse($validated['start_date'])->startOfDay();
        $end   = \Carbon\Carbon::parse($validated['end_date'])->startOfDay();
        $post  = \Carbon\Carbon::parse($postingDate)->startOfDay();

        // ✅ RULE BARU: start/end tidak boleh < posting_date
        if ($start->lt($post) || $end->lt($post)) {
            return response()->json([
                'message' => "Start date dan End date tidak boleh sebelum tanggal posting ({$post->format('Y-m-d')})"
            ], 422);
        }

        // 🔒 VALIDASI OVERLAP TANGGAL (exclude dirinya sendiri)
        $hasOverlap = $this->checkOverlap(
            $cp->id,
            $start->format('Y-m-d'),
            $end->format('Y-m-d'),
            $engagement->id
        );

        if ($hasOverlap) {
            return response()->json([
                'message' => 'Periode tanggal bertabrakan dengan data yang sudah ada'
            ], 422);
        }

        /* =====================================================
     * 🔥 VALIDASI KRONOLOGIS (LIKES & VIEWS)
     * ===================================================== */

        // ⬅️ Periode SEBELUMNYA
        $previousEngagement = Engagement::where('content_platform_id', $cp->id)
            ->where('end_date', '<', $start->format('Y-m-d'))
            ->where('id', '!=', $engagement->id)
            ->orderBy('end_date', 'desc')
            ->first();

        if ($previousEngagement) {
            if (
                (int)$validated['views'] < (int)$previousEngagement->views ||
                (int)$validated['likes'] < (int)$previousEngagement->likes
            ) {
                return response()->json([
                    'message' =>
                    'Likes dan Views tidak boleh lebih kecil dari periode sebelumnya (' .
                        $previousEngagement->start_date->format('d M Y') .
                        ' – ' .
                        $previousEngagement->end_date->format('d M Y') .
                        ')'
                ], 422);
            }
        }

        // ➡️ Periode SETELAHNYA
        $nextEngagement = Engagement::where('content_platform_id', $cp->id)
            ->where('start_date', '>', $end->format('Y-m-d'))
            ->where('id', '!=', $engagement->id)
            ->orderBy('start_date', 'asc')
            ->first();

        if ($nextEngagement) {
            if (
                (int)$validated['views'] > (int)$nextEngagement->views ||
                (int)$validated['likes'] > (int)$nextEngagement->likes
            ) {
                return response()->json([
                    'message' =>
                    'Likes dan Views tidak boleh melebihi periode setelahnya (' .
                        $nextEngagement->start_date->format('d M Y') .
                        ' – ' .
                        $nextEngagement->end_date->format('d M Y') .
                        ')'
                ], 422);
            }
        }

        /* =====================================================
     * ✅ UPDATE DATA
     * ===================================================== */

        DB::beginTransaction();
        try {
            $engagement->update([
                'start_date' => $start->format('Y-m-d'),
                'end_date'   => $end->format('Y-m-d'),
                'likes'      => $validated['likes'],
                'views'      => $validated['views'],
            ]);

            // 🧹 Clear cache analytics
            $this->clearAnalyticCache((int) $contentPlanId);

            DB::commit();

            return response()->json([
                'message' => 'Engagement berhasil diperbarui',
                'data' => [
                    'record_id' => $engagement->id,
                    'content_platform_id' => $engagement->content_platform_id,
                    'start_date' => $engagement->start_date->format('Y-m-d'),
                    'end_date' => $engagement->end_date->format('Y-m-d'),
                    'likes' => (int) $engagement->likes,
                    'views' => (int) $engagement->views,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal memperbarui engagement',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    public function getDisabledDates(int $contentPlatformId, ?int $excludeEngagementId = null)
    {
        // Cache untuk 5 menit per content platform
        $cacheKey = "disabled_dates_{$contentPlatformId}_{$excludeEngagementId}";

        return Cache::remember($cacheKey, 300, function () use ($contentPlatformId, $excludeEngagementId) {
            $query = Engagement::where('content_platform_id', $contentPlatformId)
                ->select('start_date', 'end_date');

            if ($excludeEngagementId) {
                $query->where('id', '!=', $excludeEngagementId);
            }

            $engagements = $query->orderBy('start_date')->get();

            $disabledDates = [];

            foreach ($engagements as $e) {
                $current = \Carbon\Carbon::parse($e->start_date);
                $end = \Carbon\Carbon::parse($e->end_date);

                while ($current->lte($end)) {
                    $disabledDates[] = $current->format('Y-m-d');
                    $current->addDay();
                }
            }

            return response()->json([
                'disabled_dates' => $disabledDates,
            ]);
        });
    }

    private function checkOverlap(
        int $contentPlatformId,
        string $startDate,
        string $endDate,
        ?int $excludeEngagementId = null
    ): bool {
        $query = Engagement::where('content_platform_id', $contentPlatformId)
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate, $endDate])
                    ->orWhereBetween('end_date', [$startDate, $endDate])
                    ->orWhere(function ($q2) use ($startDate, $endDate) {
                        $q2->where('start_date', '<=', $startDate)
                            ->where('end_date', '>=', $endDate);
                    });
            });

        if ($excludeEngagementId) {
            $query->where('id', '!=', $excludeEngagementId);
        }

        return $query->exists();
    }

    private function clearAnalyticCache(int $contentPlanId): void
    {
        Cache::forget("analytic_content_{$contentPlanId}");

        // Clear juga cache disabled dates untuk semua content platforms
        $contentPlatformIds = ContentPlatform::where('content_plan_id', $contentPlanId)
            ->pluck('id');

        foreach ($contentPlatformIds as $cpId) {
            Cache::forget("disabled_dates_{$cpId}_");
            // Clear untuk semua kemungkinan excludeEngagementId
            $engagementIds = Engagement::where('content_platform_id', $cpId)->pluck('id');
            foreach ($engagementIds as $eId) {
                Cache::forget("disabled_dates_{$cpId}_{$eId}");
            }
        }
    }
}
