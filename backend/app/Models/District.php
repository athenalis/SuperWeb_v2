<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class District extends Model
{
    protected $table = 'districts';
    public $timestamps = false;

    protected $fillable = [
        'province_code',
        'city_code',
        'district_code',
        'district',
    ];

    public function city()
    {
        return $this->belongsTo(City::class,'city_code','city_code');
    }

    public function villages()
    {
        return $this->hasMany(Village::class,'district_code','district_code');
    }
}
