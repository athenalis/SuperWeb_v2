<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContentPlanInfluencer extends Model
{
    protected $table = 'content_plan_influencers';

    protected $fillable = [
        'content_plan_id',
        'influencer_id',
    ];

    // RELASI: influencer
    public function influencer()
    {
        return $this->belongsTo(Influencer::class, 'influencer_id');
    }

    // RELASI: content plan
    public function contentPlan()
    {
        return $this->belongsTo(ContentPlan::class, 'content_plan_id');
    }
}
