<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ContentBudget extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'content_plan_id',
        'budget_content'
    ];

    protected $casts = [
        'budget_content' => 'decimal:2'
    ];

    public function contentPlan()
    {
        return $this->belongsTo(ContentPlan::class);
    }
}
