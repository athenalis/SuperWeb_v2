<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FamilyForm extends Model
{
    protected $table = 'keluarga_forms';

    protected $fillable = [
        'kunjungan_id',
        'jumlah_anggota_memiliki_ktp',
        'alamat_keluarga',
    ];

    /**
     * Relasi ke KunjunganForm
     */
    public function kunjungan()
    {
        return $this->belongsTo(VisitForm::class);
    }

    public function members()
    {
        return $this->hasMany(FamilyMember::class, 'keluarga_form_id');
    }

    public function keluarga()
    {
        return $this->belongsTo(FamilyForm::class, 'keluarga_form_id');
    }
}
