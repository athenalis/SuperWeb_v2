<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AdminApk extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'admin_apks';

    protected $fillable = [
        'user_id',
        'paslon_id',
        'admin_paslon_id',
        'nama',
        'nik',
        'no_hp',
        'status',
    ];

    // relasi ke user
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // relasi ke admin paslon
    public function adminPaslon()
    {
        return $this->belongsTo(AdminPaslon::class, 'admin_paslon_id');
    }

    // relasi ke paslon
    public function paslon()
    {
        return $this->belongsTo(Paslon::class);
    }
}
