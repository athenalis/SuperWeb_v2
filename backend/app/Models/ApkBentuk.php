<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApkBentuk extends Model
{
    protected $table = 'apk_bentuks';

    protected $fillable = [
        'category',
        'name',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function apkItems(): HasMany
    {
        return $this->hasMany(ApkItem::class, 'bentuk_id');
    }
}
