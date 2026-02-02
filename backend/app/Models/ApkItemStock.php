<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApkItemStock extends Model
{
    protected $table = 'apk_item_stocks';
    protected $primaryKey = 'item_id';
    public $incrementing = false;
    protected $keyType = 'int';
    
    public $timestamps = false;     // tabel ini tidak punya created_at, hanya updated_at

    protected $fillable = [
        'item_id',
        'qty_current',
        'budget_total',
    ];

    protected $casts = [
        'qty_current' => 'decimal:3',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(ApkItem::class, 'item_id');
    }
}

