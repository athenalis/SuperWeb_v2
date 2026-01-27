<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Party extends Model
{
    protected $primaryKey = 'party_code';
    public $incrementing = false;
    protected $keyType = 'int';

    protected $fillable = [
        'party_code',
        'party'
    ];

    public function paslons()
    {
        return $this->belongsToMany(
            Paslon::class,
            'paslon_parties',
            'party_code',
            'paslon_id',
            'party_code',
            'id'
        );
    }
}
