<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ContentPlatformAd extends Model
{
    use SoftDeletes;

    protected $table = 'content_platform_ads';

    protected $fillable = [
        'content_plan_id',
        'platform_id',
        'is_ads',
        'start_date',
        'end_date',
        'budget_ads',
    ];

    protected $casts = [
        'is_ads' => 'boolean',
        'start_date' => 'date',
        'end_date' => 'date',
        'budget_ads' => 'decimal:2',
    ];

    public function contentPlan()
    {
        return $this->belongsTo(ContentPlan::class);
    }

    public function platform()
    {
        return $this->belongsTo(Platform::class);
    }
}
