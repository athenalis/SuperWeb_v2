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
        'type',       // IN | OUT | ADJUST
        'qty',
        'note',
        'total_cost',
        'created_by',
        'created_at',
    ];

    protected $casts = [
        'qty' => 'decimal:3',
        'total_cost' => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public function paslon(): BelongsTo
    {
        return $this->belongsTo(Paslon::class, 'paslon_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(ApkItem::class, 'item_id');
    }

    // kalau kamu punya model User:
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
