<?php

namespace App\Models;

use App\Models\ApkRequest;
use Illuminate\Database\Eloquent\Model;

class ApkRequestStatus extends Model
{
    protected $table = 'apk_request_statuses';

    protected $fillable = [
        'code', 'name', 'sort_order', 'is_final'
    ];

    public const SUBMITTED = 'SUBMITTED';
    public const APPROVED  = 'APPROVED';
    public const REJECTED  = 'REJECTED';
    public const REVISED   = 'REVISED';
    public const PICKED_UP = 'PICKED_UP';
    public const ARRIVED   = 'ARRIVED';
    public const DELIVERED = 'DELIVERED';

    public function requests()
    {
        return $this->hasMany(ApkRequest::class, 'current_status_id');
    }
}
