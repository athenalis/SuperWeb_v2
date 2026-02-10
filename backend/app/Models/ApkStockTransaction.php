<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApkStockTransaction extends Model
{
    protected $table = 'apk_stock_transactions';
    public $timestamps = false;

    public const TYPE_IN = 'IN';
    public const TYPE_OUT = 'OUT';
    public const TYPE_ADJUST = 'ADJUST';

    protected $fillable = [
        'paslon_id',
        'item_id',
        'type',
        'qty',
        'note',
        'total_cost',
        'created_by',
        'coordinator_id',   // ✅ baru
        'created_at',
    ];

    protected $casts = [
        'qty' => 'decimal:3',
        'total_cost' => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(ApkItem::class, 'item_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // ✅ koordinator yang request (khusus OUT)
    public function coordinator(): BelongsTo
    {
        return $this->belongsTo(CoordinatorApk::class, 'coordinator_id');
    }
}
