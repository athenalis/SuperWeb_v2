<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContentType extends Model
{
    protected $fillable = ['name'];

    public $timestamps = false;

    public function contentPlans()
    {
        return $this->hasMany(ContentPlan::class);
    }

    public function platforms()
    {
        return $this->belongsToMany(
            Platform::class,
            'content_type_platforms',
            'content_type_id',
            'platform_id'
        );
    }
}
