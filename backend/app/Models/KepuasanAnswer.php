<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KepuasanAnswer extends Model
{
    protected $table = 'kepuasan_answers';

    protected $fillable = [
        'kunjungan_id',
        'paslon_id',
        'tau_paslon',
        'tau_informasi',
        'tau_visi_misi',
        'tau_program_kerja',
        'tau_rekam_jejak',
        'pernah_dikunjungi',
        'percaya',
        'harapan',
        'pertimbangan',
        'ingin_memilih'
    ];

    public function kunjungan()
    {
        return $this->belongsTo(VisitForm::class);
    }
}
