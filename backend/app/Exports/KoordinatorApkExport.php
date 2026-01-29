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

class KoordinatorApkExport implements
    FromCollection,
    WithHeadings,
    ShouldAutoSize,
    WithCustomStartCell,
    WithEvents,
    WithColumnFormatting
{
    protected int $paslonId;
    protected string $mode; // admin_paslon | admin_apk
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
        $rows = DB::table('apk_koordinators as k')
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

            return [
                $row->nama ?? '-',
                $row->email ?? '-',
                $password,
                (string) ($row->no_hp ?? '-'),
                $row->kelurahan ?? '-',
                $row->alamat ?? '-',
            ];
        });
    }

    public function headings(): array
    {
        return ['Nama', 'Email', 'Password', 'No HP', 'Kelurahan', 'Alamat'];
    }

    public function columnFormats(): array
    {
        return [
            'D' => NumberFormat::FORMAT_TEXT,
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $event->sheet->getStyle('A1:F1')->getFont()->setBold(true);
                $event->sheet->getStyle('A:F')->getAlignment()->setWrapText(true);
            },
        ];
    }
}
