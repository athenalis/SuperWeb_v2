<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ApkItem extends Model
{
    protected $table = 'apk_items';

    protected $fillable = [
        'paslon_id',
        'bentuk_id',
        'name',
        'unit_id',
        'user_id',
        'stock',
        'budget_total',
        'budget_note',
        'description',
        'is_active',
    ];

    protected $casts = [
        'stock' => 'decimal:3',
        'budget_total' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function paslon(): BelongsTo
    {
        return $this->belongsTo(Paslon::class, 'paslon_id');
    }

    public function bentuk(): BelongsTo
    {
        return $this->belongsTo(ApkBentuk::class, 'bentuk_id');
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    public function stock(): HasOne
    {
        return $this->hasOne(ApkItemStock::class, 'item_id');
    }

    public function stockTransactions(): HasMany
    {
        return $this->hasMany(ApkStockTransaction::class, 'item_id');
    }
}
