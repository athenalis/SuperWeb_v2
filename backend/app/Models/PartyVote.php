<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PartyVote extends Model
{
    protected $table = 'suara_partai';

    protected $fillable = [
        'province',
        'province_code',
        'city',
        'city_code',
        'district',
        'district_code',
        'party',
        'party_code',
        'jumlah'
    ];

    public $timestamps = false;
}
