<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Region extends Model
{
    protected $table = 'regions';

    protected $fillable = [
        'province',
        'city',
        'district',
        'village',
        'level',
        'area_km2',
    ];
}
