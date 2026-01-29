<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminPaslon;
use App\Models\ContentBudget;
use App\Models\ContentPlan;
use App\Models\ContentPlatform;
use App\Models\ContentPlatformAd;
use App\Models\ContentTypePlatform;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ContentPlanController extends Controller
{

    private function currentAdminPaslon(): AdminPaslon
    {
        $adminPaslon = AdminPaslon::where('user_id', Auth::id())
            ->whereNull('deleted_at')
            ->first();

        if (!$adminPaslon || !$adminPaslon->paslon_id) {
            abort(response()->json([
                'status' => false,
                'message' => 'Admin paslon tidak ditemukan / tidak valid'
            ], 403));
        }

        return $adminPaslon;
    }

    private function currentPaslonId(): int
    {
        return (int) $this->currentAdminPaslon()->paslon_id;
    }
    public function index(Request $request)
    {
        $paslonId = $this->currentPaslonId();

        $today = Carbon::today()->toDateString();
        $postedStatusId = $this->getPostedStatusId();

        $perPage  = (int) $request->get('per_page', 10);
        $search   = $request->get('search');
        $status   = $request->get('status');
        $platform = $request->get('platform');
        $sortBy   = $request->get('sort_by', 'posting_date');
        $sortDir  = $request->get('sort_dir', 'asc');

        $query = ContentPlan::query()
            ->where('paslon_id', $paslonId)
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

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('posting_date', 'like', "%{$search}%")
                    ->orWhereHas(
                        'status',
                        fn($s) =>
                        $s->where('label', 'like', "%{$search}%")
                    )
                    ->orWhereHas(
                        'contentPlatforms.platform',
                        fn($p) =>
                        $p->where('name', 'like', "%{$search}%")
                    );
            });
        }

        if ($status) {
            $query->whereHas('status', fn($q) => $q->where('label', $status));
        }

        if ($platform) {
            $query->whereHas('contentPlatforms.platform', fn($q) => $q->where('name', $platform));
        }

        if ($sortBy === 'budget') {
            $query->leftJoin('content_budgets as cb', 'cb.content_plan_id', '=', 'content_plans.id')
                ->orderBy('cb.budget_content', $sortDir)
                ->select('content_plans.*');
        } else {
            $query->orderBy($sortBy, $sortDir);
        }

        $query->orderByDesc('is_late');

        $paginated = $query->paginate($perPage);

        $statusSummary = ContentPlan::query()
            ->where('paslon_id', $paslonId)
            ->join('content_statuses', 'content_statuses.id', '=', 'content_plans.status_id')
            ->selectRaw('content_statuses.label, COUNT(DISTINCT content_plans.id) as total')
            ->groupBy('content_statuses.label')
            ->pluck('total', 'label');

        $lateCount = ContentPlan::query()
            ->where('paslon_id', $paslonId)
            ->whereDate('posting_date', '<', $today)
            ->where('status_id', '!=', $postedStatusId)
            ->count();

        return response()->json([
            'data' => $paginated->items(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ],
            'stats' => $statusSummary,
            'late_count' => $lateCount,
        ]);
    }

    public function show($id)
    {
        $paslonId = $this->currentPaslonId();
        $cacheKey = "content_plan_{$paslonId}_{$id}";

        return Cache::remember($cacheKey, 300, function () use ($id, $paslonId) {
            return ContentPlan::query()
                ->where('paslon_id', $paslonId)
                ->with([
                    'status',
                    'budgetWithTrashed',
                    'contentPlatforms.platform',
                    'contentPlatforms.contentType',
                    'contentPlatforms.ads',
                    'influencers.platforms.platform',
                    'ads',
                ])
                ->findOrFail($id);
        });
    }

    public function store(Request $request)
    {
        $paslonId = $this->currentPaslonId();

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
                'paslon_id'     => $paslonId,
                'title'         => $validated['title'],
                'posting_date'  => $validated['posting_date'],
                'status_id'     => 1,
                'description'   => $validated['description'] ?? null,
                'refund_budget' => false,
            ]);

            $contentPlatformsData = [];
            foreach ($validated['content_types'] as $platformId => $contentTypes) {
                foreach ($contentTypes as $contentTypeId => $data) {
                    $contentPlatformsData[] = [
                        'content_plan_id' => $contentPlan->id,
                        'platform_id'     => $platformId,
                        'content_type_id' => $contentTypeId,
                        'is_collaborator' => $data['is_collaborator'] ?? false,
                        'link'            => $data['link'] ?? null,
                    ];
                }
            }
            ContentPlatform::insert($contentPlatformsData);

            ContentBudget::create([
                'content_plan_id' => $contentPlan->id,
                'budget_content'  => $validated['budget_content'],
            ]);

            // ADS
            if ($request->boolean('is_ads') && !empty($validated['ads_by_platform'])) {
                $adsData = [];
                foreach ($validated['ads_by_platform'] as $platformId => $ads) {
                    $adsData[] = [
                        'content_plan_id' => $contentPlan->id,
                        'platform_id'     => $platformId,
                        'is_ads'          => true,
                        'start_date'      => $ads['start_date'],
                        'end_date'        => $ads['end_date'],
                        'budget_ads'      => $ads['budget_ads'],
                        'created_at'      => now(),
                        'updated_at'      => now(),
                    ];
                }
                ContentPlatformAd::insert($adsData);
            }

            if (!empty($validated['influencer_ids'])) {
                $contentPlan->influencers()->attach($validated['influencer_ids']);
            }

            $this->clearContentPlanCache($paslonId, $contentPlan->id);

            DB::commit();

            $contentPlan->load([
                'status',
                'budgetWithTrashed',
                'contentPlatforms.platform',
                'contentPlatforms.contentType',
                'contentPlatforms.ads',
                'influencers.platforms.platform',
                'ads',
            ]);

            return response()->json([
                'status'  => true,
                'message' => 'Content plan created',
                'data'    => [
                    'content_plan' => $contentPlan,
                    'total_budget' => $contentPlan->total_budget,
                ]
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'status' => false,
                'error'  => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $paslonId = $this->currentPaslonId();

        $validated = $request->validate([
            'title'         => 'required|string|max:255',
            'posting_date'  => 'required|date',
            'status_id'     => 'required|exists:content_statuses,id',
            'description'   => 'nullable|string',
            'refund_budget' => 'nullable|boolean',

            'content_types'  => 'required|array|min:1',
            'budget_content' => 'required|numeric|min:0',

            'influencer_ids'   => 'nullable|array',
            'influencer_ids.*' => 'exists:influencers,id',

            'is_ads' => 'boolean',
            'ads_by_platform' => 'nullable|array',
            'ads_by_platform.*.start_date' => 'required_with:ads_by_platform|date',
            'ads_by_platform.*.end_date'   => 'required_with:ads_by_platform|date|after_or_equal:ads_by_platform.*.start_date',
            'ads_by_platform.*.budget_ads' => 'required_with:ads_by_platform|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $contentPlan = ContentPlan::query()
                ->where('paslon_id', $paslonId)
                ->with(['budgetWithTrashed', 'ads'])
                ->findOrFail($id);

            $alreadyRefunded = (bool) $contentPlan->refund_budget;

            $this->validateContentTypes($validated['content_types']);

            $contentPlan->update([
                'title'         => $validated['title'],
                'posting_date'  => $validated['posting_date'],
                'status_id'     => $validated['status_id'],
                'description'   => $validated['description'] ?? null,
                'refund_budget' => (bool) ($validated['refund_budget'] ?? false),
            ]);

            ContentPlatform::where('content_plan_id', $id)->delete();

            $platformRows = [];
            foreach ($validated['content_types'] as $platformId => $contentTypes) {
                foreach ($contentTypes as $contentTypeId => $data) {
                    $platformRows[] = [
                        'content_plan_id' => $id,
                        'platform_id'     => (int) $platformId,
                        'content_type_id' => (int) $contentTypeId,
                        'is_collaborator' => (bool) ($data['is_collaborator'] ?? false),
                        'link'            => $data['link'] ?? null,
                    ];
                }
            }
            ContentPlatform::insert($platformRows);

            ContentBudget::updateOrCreate(
                ['content_plan_id' => $id],
                ['budget_content'  => $validated['budget_content']]
            );

            ContentPlatformAd::where('content_plan_id', $id)->delete();

            if ($request->boolean('is_ads') && !empty($validated['ads_by_platform'])) {
                $adsData = [];
                foreach ($validated['ads_by_platform'] as $platformId => $ads) {
                    $adsData[] = [
                        'content_plan_id' => $id,
                        'platform_id'     => (int) $platformId,
                        'is_ads'          => true,
                        'start_date'      => $ads['start_date'],
                        'end_date'        => $ads['end_date'],
                        'budget_ads'      => $ads['budget_ads'],
                        'created_at'      => now(),
                        'updated_at'      => now(),
                    ];
                }
                ContentPlatformAd::insert($adsData);
            }

            // influencers
            $contentPlan->influencers()->sync($validated['influencer_ids'] ?? []);

            //refund
            $shouldRefund = ((int) $validated['status_id'] === 5) && ((bool) ($validated['refund_budget'] ?? false));

            if ($shouldRefund && !$alreadyRefunded) {
                // hitung refund pakai data terbaru (include trashed)
                $budgetContent = (float) (ContentBudget::withTrashed()
                    ->where('content_plan_id', $id)
                    ->value('budget_content') ?? 0);

                $adsBudget = (float) ContentPlatformAd::withTrashed()
                    ->where('content_plan_id', $id)
                    ->sum('budget_ads');

                $refundAmount = $budgetContent + $adsBudget;

                // balikin ke total_budget paslon
                DB::table('total_budget')
                    ->where('paslon_id', $paslonId)
                    ->increment('amount', $refundAmount);

                // soft delete budget & ads supaya "budget aktif" jadi 0 / null
                ContentBudget::where('content_plan_id', $id)->delete();
                ContentPlatformAd::where('content_plan_id', $id)->delete();

                // pastiin flag true (kalau sebelumnya null)
                $contentPlan->refund_budget = true;
                $contentPlan->save();
            }

            $this->clearContentPlanCache($paslonId, $id);

            DB::commit();

            // reload lengkap buat response
            $contentPlan->refresh()->load([
                'status',
                'budgetWithTrashed',
                'contentPlatforms.platform',
                'contentPlatforms.contentType',
                'contentPlatforms.ads',
                'influencers.platforms.platform',
                'ads',
            ]);

            return response()->json([
                'status'  => true,
                'message' => 'Content plan updated',
                'data'    => [
                    'content_plan' => $contentPlan,
                    'total_budget' => $contentPlan->total_budget,
                ]
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'status' => false,
                'error'  => $e->getMessage(),
            ], 500);
        }
    }

    public function contentSummary()
    {
        $paslonId = $this->currentPaslonId();
        $cacheKey = "content_summary_{$paslonId}";

        return Cache::remember($cacheKey, 600, function () use ($paslonId) {
            return DB::table('platforms')
                ->leftJoin('content_platforms', 'platforms.id', '=', 'content_platforms.platform_id')
                ->leftJoin('content_plans', 'content_plans.id', '=', 'content_platforms.content_plan_id')
                ->where('content_plans.paslon_id', $paslonId) // ✅ scope paslon
                ->select('platforms.name', DB::raw('COUNT(DISTINCT content_plans.id) as total'))
                ->groupBy('platforms.name')
                ->get();
        });
    }
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

    private function clearContentPlanCache(int $paslonId, ?int $id = null): void
    {
        Cache::forget("content_summary_{$paslonId}");
        if ($id) {
            Cache::forget("content_plan_{$paslonId}_{$id}");
        }
    }
}
