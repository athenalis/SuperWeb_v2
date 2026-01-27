<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CoordinatorVisit extends Model
{
    use SoftDeletes;

    protected $table = 'kunjungan_koordinators';

    protected $fillable = [
        'user_id',
        'paslon_id',
        'province_code',
        'city_code',
        'district_code',
        'village_code',
        'nama',
        'nik',
        'no_hp',
        'alamat',
        'status',
    ];

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function paslon()
    {
        return $this->belongsTo(Paslon::class);
    }

    public function province()
    {
        return $this->belongsTo(Province::class, 'province_code', 'province_code');
    }

    public function city()
    {
        return $this->belongsTo(City::class, 'city_code', 'city_code');
    }

    public function district()
    {
        return $this->belongsTo(District::class, 'district_code', 'district_code');
    }

    public function village()
    {
        return $this->belongsTo(Village::class, 'village_code', 'village_code');
    }

    public function relawans()
    {
        return $this->hasMany(Relawan::class, 'koor_kunjungan_id', 'id');
    }
}
