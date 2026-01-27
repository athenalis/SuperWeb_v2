<?php

namespace App\Http\Controllers\Api;

use App\Models\ContentPlan;
use Illuminate\Http\Request;
use App\Models\ContentBudget;
use App\Models\ContentPlatform;
use App\Models\ContentPlatformAd;
use Illuminate\Support\Facades\DB;
use App\Models\ContentTypePlatform;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

class ContentPlanController extends Controller
{
    /* =====================================================
     * INDEX — SERVER SIDE DATATABLE
     * ===================================================== */
    public function index(Request $request)
    {
        $today = Carbon::today()->toDateString();
        $postedStatusId = $this->getPostedStatusId();

        $perPage  = (int) $request->get('per_page', 10);
        $search   = $request->get('search');
        $status   = $request->get('status');
        $platform = $request->get('platform');
        $sortBy   = $request->get('sort_by', 'posting_date');
        $sortDir  = $request->get('sort_dir', 'asc');

        $query = ContentPlan::query()
            ->with([
                'status:id,label',
                'budgetWithTrashed:id,content_plan_id,budget_content',
                'contentPlatforms.platform:id,name',
                'contentPlatforms.ads',
            ])
            ->selectRaw("
                content_plans.*,
                CASE
                    WHEN posting_date < ? AND status_id != ?
                    THEN 1 ELSE 0
                END AS is_late
            ", [$today, $postedStatusId]);

        /* ================= SEARCH ================= */
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('posting_date', 'like', "%{$search}%")
                  ->orWhereHas('status', fn ($s) =>
                        $s->where('label', 'like', "%{$search}%")
                  )
                  ->orWhereHas('contentPlatforms.platform', fn ($p) =>
                        $p->where('name', 'like', "%{$search}%")
                  );
            });
        }

        /* ================= FILTER STATUS ================= */
        if ($status) {
            $query->whereHas('status', fn ($q) =>
                $q->where('label', $status)
            );
        }

        /* ================= FILTER PLATFORM ================= */
        if ($platform) {
            $query->whereHas('contentPlatforms.platform', fn ($q) =>
                $q->where('name', $platform)
            );
        }

        /* ================= SORT ================= */
        if ($sortBy === 'budget') {
            $query->leftJoin(
                'content_budgets as cb',
                'cb.content_plan_id',
                '=',
                'content_plans.id'
            )->orderBy('cb.budget_content', $sortDir);
        } else {
            $query->orderBy($sortBy, $sortDir);
        }

        $query->orderByDesc('is_late');

        $summaryQuery = ContentPlan::query();

        $paginated = $query->paginate($perPage);

        $statusSummary = $summaryQuery
            ->join('content_statuses', 'content_statuses.id', '=', 'content_plans.status_id')
            ->selectRaw('content_statuses.label, COUNT(DISTINCT content_plans.id) as total')
            ->groupBy('content_statuses.label')
            ->pluck('total', 'label');

        $lateCount = ContentPlan::whereDate('posting_date', '<', $today)
            ->where('status_id', '!=', $postedStatusId)
            ->count();

        return response()->json([
            'data' => $paginated->items(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
            'stats' => $statusSummary,
            'late_count' => $lateCount,
        ]);
    }

    public function show($id)
    {
        return Cache::remember("content_plan_{$id}", 300, function () use ($id) {
            return ContentPlan::with([
                'status',
                'budgetWithTrashed',
                'contentPlatforms.platform',
                'contentPlatforms.contentType',
                'contentPlatforms.ads',
                'influencers.platforms.platform',
                'ads',
            ])->findOrFail($id);
        });
    }

    /* =====================================================
     * STORE
     * ===================================================== */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'posting_date' => 'required|date',
            'content_types' => 'required|array|min:1',
            'budget_content' => 'required|numeric|min:0',
            'is_ads' => 'boolean',
            'ads_by_platform' => 'nullable|array',
            'ads_by_platform.*.start_date' => 'required_with:ads_by_platform|date',
            'ads_by_platform.*.end_date' => 'required_with:ads_by_platform|date|after_or_equal:ads_by_platform.*.start_date',
            'ads_by_platform.*.budget_ads' => 'required_with:ads_by_platform|numeric|min:0',
            'description' => 'nullable|string',
            'influencer_ids' => 'nullable|array',
            'influencer_ids.*' => 'exists:influencers,id',
        ]);

        DB::beginTransaction();
        try {
            $this->validateContentTypes($validated['content_types']);

            $contentPlan = ContentPlan::create([
                'title' => $validated['title'],
                'posting_date' => $validated['posting_date'],
                'status_id' => 1,
                'description' => $validated['description'] ?? null,
                'refund_budget' => false,
            ]);

            $contentPlatformsData = [];
            foreach ($validated['content_types'] as $platformId => $contentTypes) {
                foreach ($contentTypes as $contentTypeId => $data) {
                    $contentPlatformsData[] = [
                        'content_plan_id' => $contentPlan->id,
                        'platform_id' => $platformId,
                        'content_type_id' => $contentTypeId,
                        'is_collaborator' => $data['is_collaborator'] ?? false,
                        'link' => $data['link'] ?? null,
                    ];
                }
            }
            ContentPlatform::insert($contentPlatformsData);

            ContentBudget::create([
                'content_plan_id' => $contentPlan->id,
                'budget_content' => $validated['budget_content'],
            ]);

            if ($request->boolean('is_ads') && !empty($validated['ads_by_platform'])) {
                $adsData = [];
                foreach ($validated['ads_by_platform'] as $platformId => $ads) {
                    $adsData[] = [
                        'content_plan_id' => $contentPlan->id,
                        'platform_id' => $platformId,
                        'is_ads' => true,
                        'start_date' => $ads['start_date'],
                        'end_date' => $ads['end_date'],
                        'budget_ads' => $ads['budget_ads'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
                ContentPlatformAd::insert($adsData);
            }

            if (!empty($validated['influencer_ids'])) {
                $contentPlan->influencers()->attach($validated['influencer_ids']);
            }

            $this->clearContentPlanCache();

            DB::commit();
            return response()->json(['message' => 'Content plan created'], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /* =====================================================
     * UPDATE
     * ===================================================== */
    public function update(Request $request, $id)
    {
        DB::beginTransaction();
        try {
            $contentPlan = ContentPlan::findOrFail($id);

            $contentPlan->update($request->only([
                'title',
                'posting_date',
                'status_id',
                'description',
            ]));

            ContentPlatform::where('content_plan_id', $id)->delete();

            foreach ($request->content_types as $platformId => $contentTypes) {
                foreach ($contentTypes as $contentTypeId => $data) {
                    ContentPlatform::create([
                        'content_plan_id' => $id,
                        'platform_id' => $platformId,
                        'content_type_id' => $contentTypeId,
                        'is_collaborator' => $data['is_collaborator'] ?? false,
                        'link' => $data['link'] ?? null,
                    ]);
                }
            }

            ContentBudget::updateOrCreate(
                ['content_plan_id' => $id],
                ['budget_content' => $request->budget_content]
            );

            $contentPlan->influencers()->sync($request->influencer_ids ?? []);

            $this->clearContentPlanCache($id);

            DB::commit();
            return response()->json(['message' => 'Updated']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /* =====================================================
     * SUMMARY
     * ===================================================== */
    public function contentSummary()
    {
        return Cache::remember('content_summary', 600, function () {
            return DB::table('platforms')
                ->leftJoin('content_platforms', 'platforms.id', '=', 'content_platforms.platform_id')
                ->select('platforms.name', DB::raw('COUNT(*) as total'))
                ->groupBy('platforms.name')
                ->get();
        });
    }

    /* =====================================================
     * HELPERS
     * ===================================================== */
    private function validateContentTypes(array $contentTypes): void
    {
        foreach ($contentTypes as $platformId => $types) {
            foreach ($types as $contentTypeId => $data) {
                $valid = ContentTypePlatform::where([
                    'platform_id' => $platformId,
                    'content_type_id' => $contentTypeId,
                ])->exists();

                if (!$valid) {
                    throw new \Exception('Invalid content type');
                }
            }
        }
    }

    private function getPostedStatusId(): int
    {
        return Cache::remember('posted_status_id', 3600, function () {
            return DB::table('content_statuses')
                ->where('label', 'Diposting')
                ->value('id') ?? 0;
        });
    }

    private function clearContentPlanCache(?int $id = null): void
    {
        Cache::forget('content_summary');
        if ($id) {
            Cache::forget("content_plan_{$id}");
        }
    }
}
