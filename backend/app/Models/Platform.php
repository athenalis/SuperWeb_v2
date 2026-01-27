<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Platform extends Model
{
    protected $fillable = ['name'];

    public $timestamps = false;

    public function contentPlans()
    {
        return $this->belongsToMany(ContentPlan::class, 'content_platforms');
    }

    public function influencerPlatforms()
    {
        return $this->hasMany(InfluencerPlatform::class, 'platform_id');
    }

    public function contentTypes()
    {
        return $this->belongsToMany(
            ContentType::class,
            'content_type_platforms',
            'platform_id',
            'content_type_id'
        );
    }
}
