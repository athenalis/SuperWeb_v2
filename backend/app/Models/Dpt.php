<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Dpt extends Model
{
    protected $table = 'dpt';
    public $timestamps = false;

    protected $fillable = [
        'name',
        'tps',
        'village_code',
        'village',
        'district_code',
        'district',
        'city_code',
        'city',
        'province_code',
        'province',
    ];
}
