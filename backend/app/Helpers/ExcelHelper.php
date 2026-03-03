<?php

namespace App\Helpers;

use App\Exports\UserExport;
use Maatwebsite\Excel\Facades\Excel;

class ExcelHelper
{
    public static function addToExcel($row)
    {
        $file = 'exports/user_credentials.xlsx';

        $existing = [];
        if (file_exists(storage_path('app/' . $file))) {
            $existing = Excel::toArray(new UserExport([]), storage_path('app/' . $file))[0];
            array_shift($existing);
        }

        $merged = array_merge($existing, [$row]);

        Excel::store(new UserExport($merged), $file);
    }
}
