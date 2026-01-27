<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TotalBudget extends Model
{
    protected $table = 'total_budget';
    protected $fillable = ['amount'];
    public $timestamps = false;
}
