<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Casts\AsArrayObject;

class Influencer extends Model
{
    protected $table = 'influencers';

    protected $fillable = [
        'name',
        'email',
        'contacts',
    ];

    // CAST contacts JSON ke array
    protected $casts = [
        'contacts' => 'array',
    ];

    // RELASI: influencer punya banyak platform
    public function platforms()
    {
        return $this->hasMany(InfluencerPlatform::class, 'influencer_id');
    }

    // RELASI: influencer bisa dipakai di banyak content plan

    public function contentPlans()
    {
        return $this->belongsToMany(
            ContentPlan::class,
            'content_plan_influencers',
            'influencer_id',
            'content_plan_id'
        )->withTimestamps();
    }
}
