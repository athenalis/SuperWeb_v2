<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class UserCredential extends Model
{
    use HasFactory;

    protected $table = 'user_credentials';

    protected $fillable = [
        'user_id',
        'encrypted_password',
        'type',
        'is_active',
        'used_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'used_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
