<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApkInstallation extends Model
{
    protected $table = 'apk_installations';

    protected $fillable = [
        'user_id','paslon_id','relawan_id','apk_kurir_id',
        'latitude','longitude','taken_at',
        'photo_path','photo_size','photo_hash'
    ];

    protected $casts = [
        'taken_at' => 'datetime',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function relawan()
    {
        return $this->belongsTo(Relawan::class, 'relawan_id');
    }

    public function apkKurir()
    {
        return $this->belongsTo(CourierApk::class, 'apk_kurir_id');
    }
}
