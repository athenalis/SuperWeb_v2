<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrackingSession extends Model
{
    protected $table = 'tracking_sessions';

    protected $fillable = [
        'user_id','paslon_id','relawan_id','apk_kurir_id',
        'started_at','ended_at',
        'last_latitude','last_longitude','last_ping_at',
        'idle_alerted_at'
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'last_ping_at' => 'datetime',
        'idle_alerted_at' => 'datetime',
        'last_latitude' => 'decimal:7',
        'last_longitude' => 'decimal:7',
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

