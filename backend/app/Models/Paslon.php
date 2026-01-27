<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Paslon extends Model
{
    protected $table = 'paslons';

    protected $fillable = [
        'cagub',
        'cawagub',
        'nomor_urut',
        'image'
    ];

    public function adminPaslon()
    {
        return $this->hasOne(AdminPaslon::class, 'paslon_id');
    }

    public function parties()
    {
        return $this->belongsToMany(
            Party::class,
            'paslon_parties',
            'paslon_id',
            'party_code',
            'id',
            'party_code'
        );
    }

    protected $appends = ['image_url'];

    public function getImageUrlAttribute()
    {
        return $this->image ? asset('storage/' . $this->image) : null;
    }
}
