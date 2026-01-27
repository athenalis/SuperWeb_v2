<?php

namespace App\Exports;

use App\Models\Relawan;
use App\Models\Coordinator;
use App\Models\UserCredential;
use Illuminate\Support\Facades\Crypt;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithCustomStartCell;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

class RelawanExport implements
    FromCollection,
    WithHeadings,
    ShouldAutoSize,
    WithCustomStartCell,
    WithEvents,
    WithColumnFormatting
{
    protected string $mode; // admin | koordinator
    protected ?int $koordinatorId;
    protected ?string $namaKoordinator;

    public function __construct(string $mode = 'admin', int $koordinatorId = null)
    {
        $this->mode = $mode;
        $this->koordinatorId = $koordinatorId;

        if ($mode === 'koordinator' && $koordinatorId) {
            $this->namaKoordinator = Coordinator::where('id', $koordinatorId)
                ->value('nama');
        }
    }

    /* =======================
        START CELL
    ======================= */
    public function startCell(): string
    {
        return $this->mode === 'koordinator' ? 'A3' : 'A1';
    }

    /* =======================
        DATA
    ======================= */
    public function collection()
    {
        $query = Relawan::with(['user', 'village', 'koordinator']);

        if ($this->mode === 'koordinator') {
            $query->where('koordinator_id', $this->koordinatorId);
        }

        return $query->get()->map(function ($relawan) {
            $credential = $relawan->user
                ? $relawan->user->credentials()->where('is_active', true)->first()
                : null;

            $password = $credential
                ? Crypt::decryptString($credential->encrypted_password)
                : '-';

            // ================= ADMIN =================
            if ($this->mode === 'admin') {
                return [
                    $relawan->koordinator->nama ?? '-',
                    $relawan->nama,
                    $relawan->user->email ?? '-',
                    $password ?? '-',
                    (string) $relawan->no_hp ?? '-', // WAJIB STRING
                    $relawan->village->village ?? '-',
                ];
            }

            // ================= KOORDINATOR =================
            return [
                $relawan->nama,
                $relawan->user->email ?? '-',
                $password ?? '-',
                (string) $relawan->no_hp ?? '-', // WAJIB STRING
                $relawan->village->village ?? '-',
            ];
        });
    }

    /* =======================
        HEADINGS
    ======================= */
    public function headings(): array
    {
        if ($this->mode === 'admin') {
            return [
                'Nama Koordinator',
                'Nama Relawan',
                'Email',
                'Password',
                'No HP',
                'Kelurahan',
            ];
        }

        return [
            'Nama Relawan',
            'Email',
            'Password',
            'No HP',
            'Kelurahan',
        ];
    }

    /* =======================
        COLUMN FORMAT
        (INI KUNCI UTAMA)
    ======================= */
    public function columnFormats(): array
    {
        // ADMIN → No HP kolom E
        if ($this->mode === 'admin') {
            return [
                'E' => NumberFormat::FORMAT_TEXT,
            ];
        }

        // KOORDINATOR → No HP kolom D
        return [
            'D' => NumberFormat::FORMAT_TEXT,
        ];
    }

    /* =======================
        EVENTS
    ======================= */
    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {

                // HEADER BOLD
                $headerRow = $this->mode === 'koordinator' ? 3 : 1;
                $lastCol   = $this->mode === 'admin' ? 'F' : 'E';

                $event->sheet
                    ->getStyle("A{$headerRow}:{$lastCol}{$headerRow}")
                    ->getFont()
                    ->setBold(true);

                // INFO KOORDINATOR
                if ($this->mode === 'koordinator') {
                    $event->sheet->setCellValue('A1', 'Koordinator');
                    $event->sheet->setCellValue('B1', $this->namaKoordinator);

                    $event->sheet
                        ->getStyle('A1:B1')
                        ->getFont()
                        ->setBold(true);
                }
            },
        ];
    }
}
