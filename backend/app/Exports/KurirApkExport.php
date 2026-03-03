<?php

namespace App\Exports;

use App\Models\CourierApk;
use App\Models\UserCredential;
use Illuminate\Support\Facades\Crypt;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;

class KurirApkExport extends DefaultValueBinder implements
    FromCollection,
    WithHeadings,
    ShouldAutoSize,
    WithColumnFormatting,
    WithCustomValueBinder
{
    protected int $paslonId;

    public function __construct(int $paslonId)
    {
        $this->paslonId = $paslonId;
    }

    public function bindValue(Cell $cell, $value)
    {
        $textCols = ['B'];

        if (in_array($cell->getColumn(), $textCols, true)) {
            $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);
            return true;
        }

        return parent::bindValue($cell, $value);
    }

    public function collection()
    {
        $data = CourierApk::query()
            ->with(['user' => fn($q) => $q->withTrashed()])
            ->whereNull('deleted_at')
            ->where('paslon_id', $this->paslonId)
            ->orderBy('nama')
            ->get();

        return $data->map(function ($kurir) {
            $credential = $kurir->user
                ? UserCredential::where('user_id', $kurir->user->id)->where('is_active', true)->first()
                : null;

            $password = '-';
            if ($credential && $credential->encrypted_password) {
                try {
                    $password = Crypt::decryptString($credential->encrypted_password);
                } catch (\Throwable $e) {
                    $password = '-';
                }
            }

            return [
                $kurir->nama ?? '-',
                (string) ($kurir->no_hp ?? '-'),
                $kurir->user->email ?? '-',
                $password,
            ];
        });
    }

    public function headings(): array
    {
        return [
            'Nama Kurir',
            'No HP',
            'Email',
            'Password',
        ];
    }

    public function columnFormats(): array
    {
        return [
            'B' => NumberFormat::FORMAT_TEXT,
        ];
    }
}
