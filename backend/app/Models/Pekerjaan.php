<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pekerjaan extends Model
{
    protected $table = 'pekerjaans';

    protected $primaryKey = 'id';
    public $incrementing = false; // penting
    protected $keyType = 'int';

    protected $fillable = [
        'id',
        'nama_pekerjaan'
    ];

    public function kunjunganForms()
    {
        return $this->hasMany(VisitForm::class, 'pekerjaan_id');
    }
}
