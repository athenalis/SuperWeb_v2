<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApkTotalBudget extends Model
{
    protected $table = 'apk_total_budget';

    protected $fillable = [
        'paslon_id',
        'amount',
    ];

    protected $casts = [
        'paslon_id' => 'integer',
        'amount' => 'decimal:2',
    ];
}
