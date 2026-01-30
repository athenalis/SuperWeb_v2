<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VisitForm extends Model
{
    protected $table = 'kunjungan_forms';

    protected $fillable = [
        'task_id',
        'relawan_id',
        'paslon_id',
        'campaign_id',
        'latitude',
        'longitude',
        'nama',
        'nik',
        'umur',
        'penghasilan',
        'pekerjaan_id',
        'pekerjaan',
        'pendidikan',
        'foto_ktp',
        'alamat',
        'status',
        'created_by',
        'status_verifikasi',
        'verified_by',
        'verified_at',
        'tanggal',
        'offline_id',
        'score',
        'completed_at',
        'completed_by'
    ];

    protected $casts = [
        'latitude',
        'longitude',
        'verified_at' => 'datetime',
    ];

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function relawan()
    {
        return $this->belongsTo(Relawan::class);
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function verifikator()
    {
        return $this->belongsTo(Coordinator::class, 'verified_by');
    }

    public function kepuasan()
    {
        return $this->hasOne(KepuasanAnswer::class, 'kunjungan_id');
    }

    public function familyForm()
    {
        return $this->hasOne(FamilyForm::class, 'kunjungan_id');
    }

    public function pekerjaan()
    {
        return $this->belongsTo(Pekerjaan::class, 'pekerjaan_id');
    }

    public function paslon() {
        return $this->belongsTo(Paslon::class, 'paslon_id');
    }
}
