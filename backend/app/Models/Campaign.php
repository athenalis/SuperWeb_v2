<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Campaign extends Model
{
    protected $fillable = [
        'nama', 'deskripsi',
        'province_id', 'city_id', 'district_id', 'village_id',
        'tanggal_mulai', 'deadline', 'target_kunjungan'
    ];

    protected $table = 'campaigns';

    public function coordinators()
    {
        return $this->hasMany(CampaignCoordinator::class);
    }

    public function relawans()
    {
        return $this->hasMany(CampaignRelawan::class);
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }
}
