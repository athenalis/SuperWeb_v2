<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class City extends Model
{
    protected $table = 'cities';
    public $timestamps = false;

    protected $fillable = [
        'region_code',
        'province_code',
        'city_code',
        'city',
    ];

    public function province()
    {
        return $this->belongsTo(Province::class,'province_code','province_code');
    }

    public function districts()
    {
        return $this->hasMany(District::class,'city_code','city_code');
    }
}
