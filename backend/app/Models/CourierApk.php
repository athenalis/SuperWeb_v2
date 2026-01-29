<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CourierApk extends Model
{
    use SoftDeletes;

    protected $table = 'apk_kurirs';

    protected $fillable = [
        'user_id',
        'paslon_id',
        'nama',
        'no_hp',
        'status',
    ];

    protected $casts = [
        'user_id'   => 'integer',
        'paslon_id' => 'integer',
        'deleted_at'=> 'datetime',
        'created_at'=> 'datetime',
        'updated_at'=> 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function paslon()
    {
        return $this->belongsTo(Paslon::class, 'paslon_id');
    }
}
