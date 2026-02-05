<?php

namespace App\Exports;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithCustomStartCell;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Cell\DataType;

class KoordinatorKunjunganExport implements
    FromCollection,
    WithHeadings,
    ShouldAutoSize,
    WithCustomStartCell,
    WithEvents,
    WithColumnFormatting
{
    protected string $mode; // admin_paslon (saat ini hanya ini)
    protected int $paslonId;
    protected ?string $paslonSuffix;

    public function __construct(int $paslonId, string $mode = 'admin_paslon', ?string $paslonSuffix = null)
    {
        $this->paslonId = $paslonId;
        $this->mode = $mode;
        $this->paslonSuffix = $paslonSuffix;
    }

    public function startCell(): string
    {
        return 'A1';
    }

    public function collection()
    {
        $rows = DB::table('kunjungan_koordinators as k')
            ->leftJoin('users as u', 'u.id', '=', 'k.user_id')
            ->leftJoin('villages as v', 'v.village_code', '=', 'k.village_code')
            ->leftJoin('user_credentials as uc', function ($join) {
                $join->on('uc.user_id', '=', 'k.user_id')
                    ->where('uc.is_active', '=', 1);
            })
            ->where('k.paslon_id', $this->paslonId)
            ->whereNull('k.deleted_at')
            ->whereNotNull('k.user_id')
            ->select([
                'k.nama as nama',
                DB::raw('COALESCE(k.nik, u.nik) as nik'),
                'u.email as email',
                'uc.encrypted_password as encrypted_password',
                'k.no_hp as no_hp',
                'v.village as kelurahan',
                'k.alamat as alamat',
            ])
            ->orderByDesc('k.id')
            ->get();

        return $rows->map(function ($row) {
            $password = '-';
            if (!empty($row->encrypted_password)) {
                try {
                    $password = Crypt::decryptString($row->encrypted_password);
                } catch (\Throwable $e) {
                    $password = '-';
                }
            }

            // ✅ Paksa NIK jadi string digit (biar tidak kebaca angka)
            $nik = (string) ($row->nik ?? '');
            $nik = preg_replace('/\D+/', '', $nik) ?: '-';

            // ✅ No HP juga string digit (optional, tapi aman)
            $noHp = (string) ($row->no_hp ?? '');
            $noHp = preg_replace('/\D+/', '', $noHp) ?: '-';

            return [
                $row->nama ?? '-',
                $nik,
                $row->email ?? '-',
                $password,
                $noHp,
                $row->kelurahan ?? '-',
                $row->alamat ?? '-',
            ];
        });
    }

    public function headings(): array
    {
        return ['Nama', 'NIK', 'Email', 'Password', 'No HP', 'Kelurahan', 'Alamat'];
    }

    public function columnFormats(): array
    {
        return [
            'B' => NumberFormat::FORMAT_TEXT, // NIK
            'E' => NumberFormat::FORMAT_TEXT, // No HP
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                // styling lama tetap
                $event->sheet->getStyle('A1:G1')->getFont()->setBold(true);
                $event->sheet->getStyle('A:G')->getAlignment()->setWrapText(true);

                // ✅ Mekanisme relawan: paksa kolom NIK & No HP benar-benar text (anti E+15)
                $sheet = $event->sheet->getDelegate();
                $highestRow = $sheet->getHighestRow();

                // Set format kolom text (double safety)
                $sheet->getStyle("B2:B{$highestRow}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);
                $sheet->getStyle("E2:E{$highestRow}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);

                // Paksa value explicit string (yang biasanya dipakai di relawan export)
                for ($row = 2; $row <= $highestRow; $row++) {
                    $nikVal = (string) $sheet->getCell("B{$row}")->getValue();
                    $hpVal  = (string) $sheet->getCell("E{$row}")->getValue();

                    $sheet->setCellValueExplicit("B{$row}", $nikVal, DataType::TYPE_STRING);
                    $sheet->setCellValueExplicit("E{$row}", $hpVal, DataType::TYPE_STRING);
                }
            },
        ];
    }
}
