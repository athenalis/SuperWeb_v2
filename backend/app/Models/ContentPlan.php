<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContentPlan extends Model
{
    protected $fillable = [
        'title',
        'description',
        'posting_date',
        'status_id',
        'refund_budget',
    ];

    protected $casts = [
        'refund_budget' => 'boolean',
        'posting_date' => 'date',
    ];

    /* ======================
        RELATIONSHIP
    ====================== */

    public function status()
    {
        return $this->belongsTo(ContentStatus::class);
    }

    // budget (default TIDAK include soft delete)
    public function budget()
    {
        return $this->hasOne(ContentBudget::class);
    }

    // khusus index & detail (include soft delete)
    public function budgetWithTrashed()
    {
        return $this->hasOne(ContentBudget::class)->withTrashed();
    }

    public function contentPlatforms()
    {
        return $this->hasMany(ContentPlatform::class, 'content_plan_id');
    }

    public function influencers()
    {
        return $this->belongsToMany(
            Influencer::class,
            'content_plan_influencers',
            'content_plan_id',
            'influencer_id'
        );
    }
    public function ads()
    {
        return $this->hasMany(ContentPlatformAd::class, 'content_plan_id')
            ->withTrashed();
    }

    /* ======================
        ACCESSOR
    ====================== */

    public function getTotalBudgetAttribute()
    {
        $budgetContent = $this->budgetWithTrashed?->budget_content ?? 0;

        $adsBudget = ContentPlatformAd::withTrashed()
            ->where('content_plan_id', $this->id)
            ->sum('budget_ads');

        return $budgetContent + $adsBudget;
    }
}
