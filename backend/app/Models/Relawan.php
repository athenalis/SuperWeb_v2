<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Relawan extends Model
{
    use SoftDeletes;

    protected $table = 'relawans';

    protected $fillable = [
        'user_id',
        'koor_kunjungan_id',
        'koor_apk_id',
        'paslon_id',
        'ormas_id',
        'province_code',
        'city_code',
        'district_code',
        'village_code',
        'nama',
        'nik',
        'no_hp',
        'alamat',
        'tps',
        'is_kunjungan',
        'is_apk',
        'status',
    ];

    protected $casts = [
        'is_kunjungan' => 'boolean',
        'is_apk'       => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function koordinatorKunjungan()
    {
        return $this->belongsTo(CoordinatorVisit::class, 'koor_kunjungan_id')->withTrashed();
    }

    public function koordinatorApk()
    {
        return $this->belongsTo(CoordinatorApk::class, 'koor_apk_id')->withTrashed();
    }

    public function paslon()
    {
        return $this->belongsTo(Paslon::class, 'paslon_id');
    }

    public function ormas()
    {
        return $this->belongsTo(Ormas::class);
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
}
