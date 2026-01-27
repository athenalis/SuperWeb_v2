<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VoteCount extends Model
{
    protected $table = 'perolehan_suara';

    protected $fillable = [
        'village_code',
        'suara_paslon_01',
        'suara_paslon_02',
        'suara_paslon_03',
        'jumlah_perolehan_suara_sah',
        'jumlah_perolehan_suara_tidak_sah',
        'total_suara'
    ];

    public function village()
    {
        return $this->belongsTo(Village::class);
    }
}
