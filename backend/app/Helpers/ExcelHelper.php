<?php

namespace App\Helpers;

use App\Exports\UserExport;
use Maatwebsite\Excel\Facades\Excel;

class ExcelHelper
{
    public static function addToExcel($row)
    {
        $file = 'exports/user_credentials.xlsx';

        // Ambil data lama jika sudah ada file
        $existing = [];
        if (file_exists(storage_path('app/' . $file))) {
            $existing = Excel::toArray(new UserExport([]), storage_path('app/' . $file))[0];
            array_shift($existing); // hapus heading
        }

        // Tambahkan baris baru
        $merged = array_merge($existing, [$row]);

        // Buat / replace file
        Excel::store(new UserExport($merged), $file);
    }
}
