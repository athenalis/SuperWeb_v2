<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class ApkRequest extends Model
{
    protected $table = 'apk_requests';

    protected $fillable = [
        'request_no',
        'coordinator_id',
        'admin_id',
        'courier_id',
        'pickup_address',
        'pickup_scheduled_at',
        'current_status_id',
        'revision_no',
    ];

    protected $casts = [
        'pickup_scheduled_at' => 'datetime', 
    ];

    public function status()
    {
        return $this->belongsTo(ApkRequestStatus::class, 'current_status_id');
    }

    public function items()
    {
        return $this->hasMany(ApkRequestItem::class, 'apk_request_id');
    }

    public function histories()
    {
        return $this->hasMany(ApkRequestStatusHistory::class, 'apk_request_id')
            ->orderBy('created_at', 'asc');
    }

    public function coordinator()
    {
        return $this->belongsTo(CoordinatorApk::class, 'coordinator_id');
    }

    public function admin()
    {
        return $this->belongsTo(AdminApk::class, 'admin_id');
    }

    public function courier()
    {
        return $this->belongsTo(CourierApk::class, 'courier_id');
    }

    public function isStatus(string $code): bool
    {
        return $this->status?->code === $code;
    }

    public function setStatusByCode(string $code, int $changedBy, ?string $note = null): void
    {
        $status = ApkRequestStatus::where('code', $code)->firstOrFail();

        $this->update([
            'current_status_id' => $status->id,
        ]);

        ApkRequestStatusHistory::create([
            'apk_request_id' => $this->id,
            'status_id'      => $status->id,
            'changed_by'     => $changedBy,
            'note'           => $note,
        ]);
    }
}
