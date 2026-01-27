<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ormas extends Model
{
    protected $table = 'ormas';
    
    protected $fillable = ['nama_ormas', 'naungan'];

    public function relawans()
    {
        return $this->hasMany(Relawan::class);
    }
}
