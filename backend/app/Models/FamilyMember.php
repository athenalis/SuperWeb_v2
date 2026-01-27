<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FamilyMember extends Model
{
    protected $table = 'keluarga_members';

    protected $fillable = [
        'keluarga_form_id',
        'nama',
        'nik',
        'tanggal_lahir',
        'umur',
        'pekerjaan',
        'pendidikan',
        'penghasilan',
        'foto_ktp',
        'hubungan',
        'offline_id'
    ];

    public function keluargaForm()
    {
        return $this->belongsTo(FamilyForm::class);
    }
}
