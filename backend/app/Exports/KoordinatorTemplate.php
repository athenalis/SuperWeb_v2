<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\WithHeadings;

class KoordinatorTemplate implements WithHeadings
{
    public function headings(): array
    {
        return [
            'nama',
            'nik',
            'no_hp',
            'tps',
            'alamat',
            'provinsi',
            'kabupaten/kota',
            'kecamatan',
            'desa/kelurahan',
        ];
    }
}
