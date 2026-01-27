<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Village extends Model
{
    protected $table = 'villages';
    public $timestamps = false;

    protected $fillable = [
        'province_code',
        'city_code',
        'district_code',
        'village_code',
        'village',
    ];

    public function district()
    {
        return $this->belongsTo(District::class,'district_code','district_code');
    }

    public function koordinators()
    {
        return $this->hasMany(Coordinator::class,'village_code','village_code');
    }

    public function voteCounts()
    {
        return $this->hasMany(voteCounts::class);
    }
}
