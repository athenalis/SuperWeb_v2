<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;

class UserExport implements FromArray, WithHeadings
{
    protected $rows;

    public function __construct($rows)
    {
        $this->rows = $rows;
    }

    public function headings(): array
    {
        return [
            'Nama',
            'Email',
            'Password',
            'Role',
            'Created At'
        ];
    }

    public function array(): array
    {
        return $this->rows;
    }
}
