<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TotalBudget;
use App\Models\ContentBudget;
use App\Models\ContentPlatformAd;

class BudgetController extends Controller
{
    public function index()
    {
        $totalBudget = TotalBudget::first()?->amount ?? 0;

        $usedContent = ContentBudget::sum('budget_content');

        $usedAds = ContentPlatformAd::whereNull('deleted_at')
            ->sum('budget_ads');

        return response()->json([
            'total_budget' => $totalBudget,
            'used_budget' => [
                'content' => $usedContent,
                'ads' => $usedAds,
                'total' => $usedContent + $usedAds,
            ],
            'remaining_budget' => $totalBudget - ($usedContent + $usedAds),
        ]);
    }
}
