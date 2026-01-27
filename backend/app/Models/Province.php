<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Province extends Model
{
    protected $table = 'provinces';
    public $timestamps = false;

    protected $fillable = [
        'region_code',
        'province_code',
        'province',
    ];

    public function cities()
    {
        return $this->hasMany(City::class,'province_code','province_code');
    }
}
