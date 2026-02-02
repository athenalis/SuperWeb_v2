<?php

namespace App\Models;

use App\Models\ApkRequestStatus;
use Illuminate\Database\Eloquent\Model;

class ApkRequestStatusHistory extends Model
{
    protected $table = 'apk_request_status_histories';
    public $timestamps = false; // karena cuma punya created_at

    protected $fillable = [
        'apk_request_id',
        'status_id',
        'actor_type',
        'actor_id',
        'note',
        'created_at',
    ];

    public function request()
    {
        return $this->belongsTo(ApkRequest::class, 'apk_request_id');
    }

    public function status()
    {
        return $this->belongsTo(ApkRequestStatus::class, 'status_id');
    }
}
