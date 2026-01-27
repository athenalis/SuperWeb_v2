<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContentPlatform extends Model
{
    protected $table = 'content_platforms';

    protected $fillable = [
        'content_plan_id',
        'platform_id',
        'content_type_id',
        'is_collaborator', // ✅ WAJIB
        'link',
    ];

    protected $casts = [
        'is_collaborator' => 'boolean', // ✅ WAJIB
    ];

    public $timestamps = false;
    public function engagements()
    {
        return $this->hasMany(Engagement::class);
    }

    public function contentType()
    {
        return $this->belongsTo(ContentType::class, 'content_type_id');
    }
    public function contentPlan()
    {
        return $this->belongsTo(ContentPlan::class);
    }

    public function platform()
    {
        return $this->belongsTo(Platform::class);
    }

    public function ads()
    {
        return $this->hasMany(ContentPlatformAd::class, 'platform_id', 'platform_id')
            ->where('content_plan_id', $this->content_plan_id)
            ->withTrashed();
    }
}
