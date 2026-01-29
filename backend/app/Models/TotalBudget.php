<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TotalBudget extends Model
{
    protected $table = 'total_budget';

    protected $fillable = [
        'paslon_id',  // ✅ tambah
        'amount'
    ];

    public $timestamps = false;

    public function paslon()
    {
        return $this->belongsTo(Paslon::class, 'paslon_id');
    }
}
