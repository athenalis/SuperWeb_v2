<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    protected $fillable = [
        'campaign_id', 'relawan_id', 'koordinator_id',
        'catatan_tugas', 'wilayah_kunjungan', 'target_kunjungan',
        'deadline', 'status'
    ];

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function relawan()
    {
        return $this->belongsTo(Relawan::class);
    }

    public function koordinator()
    {
        return $this->belongsTo(Coordinator::class);
    }

    public function kunjunganForms()
    {
        return $this->hasMany(VisitForm::class);
    }
}
