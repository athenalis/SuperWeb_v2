<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminPaslon extends Model
{
    protected $table = 'admin_paslons';

    protected $fillable = [
        'user_id',
        'paslon_id',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function paslon()
    {
        return $this->belongsTo(Paslon::class);
    }
}
