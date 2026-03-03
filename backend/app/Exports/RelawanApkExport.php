<?php

namespace App\Exports;

use App\Models\Relawan;
use App\Models\UserCredential;
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
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;

class RelawanApkExport extends DefaultValueBinder implements
    FromCollection,
    WithHeadings,
    ShouldAutoSize,
    WithCustomStartCell,
    WithEvents,
    WithColumnFormatting,
    WithCustomValueBinder
{
    protected string $mode; // koordinator, admin_paslon, admin_apk
    protected ?int $koorApkId;
    protected ?int $paslonId;
    protected ?string $namaKoordinator;
    protected ?string $namaKelurahan;

    public function __construct(string $mode, ?int $koorApkId = null, ?int $paslonId = null)
    {
        $this->mode = $mode;
        $this->koorApkId = $koorApkId;
        $this->paslonId = $paslonId;

        if ($mode === 'koordinator' && $koorApkId) {
            $this->namaKoordinator = DB::table('apk_koordinators')->where('id', $koorApkId)->value('nama');
            $this->namaKelurahan   = DB::table('apk_koordinators')
                ->join('villages', 'villages.village_code', '=', 'apk_koordinators.village_code')
                ->where('apk_koordinators.id', $koorApkId)
                ->value('villages.village');
        }
    }

    private function isAdminMode(): bool
    {
        return in_array($this->mode, ['admin_paslon', 'admin_apk'], true);
    }

    public function bindValue(Cell $cell, $value)
    {
        if ($this->isAdminMode()) {
            $textCols = ['D', 'G', 'I'];
        } else {
            $textCols = ['B', 'E', 'G'];
        }

        if (in_array($cell->getColumn(), $textCols, true)) {
            $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);
            return true;
        }

        return parent::bindValue($cell, $value);
    }

    public function startCell(): string
    {
        return $this->mode === 'koordinator' ? 'A4' : 'A1';
    }

    public function collection()
    {
        if ($this->isAdminMode()) {
            $query = Relawan::query()
                ->leftJoin('apk_koordinators as ak', 'ak.id', '=', 'relawans.koor_apk_id')
                ->leftJoin('villages as vk', 'vk.village_code', '=', 'ak.village_code')
                ->with(['user', 'village', 'city', 'district', 'province'])
                ->whereNull('relawans.deleted_at')
                ->where('relawans.is_apk', 1)
                ->where('relawans.paslon_id', $this->paslonId)
                ->addSelect([
                    'relawans.*',
                    'ak.nama as nama_koordinator',
                    'vk.village as kelurahan_penugasan',
                ]);

            return $query->orderBy('relawans.village_code')->orderBy('relawans.nama')->get()
                ->map(function ($relawan) {
                    $credential = $relawan->user
                        ? UserCredential::where('user_id', $relawan->user->id)->where('is_active', true)->first()
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
                        $relawan->nama_koordinator ?? '-',
                        $relawan->kelurahan_penugasan ?? '-',
                        $relawan->nama ?? '-',
                        (string) ($relawan->nik ?? '-'),
                        $relawan->user->email ?? '-',
                        $password,
                        (string)($relawan->no_hp ?? '-'),
                        $relawan->alamat ?? '-',
                        (string)($relawan->tps ?? '-'),
                        $relawan->province->province ?? '-',
                        $relawan->city->city ?? '-',
                        $relawan->district->district ?? '-',
                        $relawan->village->village ?? '-',
                        ((int)$relawan->is_kunjungan === 1 ? 'KUNJUNGAN & APK' : 'APK'),
                    ];
                });
        }

        $query = Relawan::query()
            ->with(['user', 'village', 'city', 'district', 'province'])
            ->whereNull('deleted_at')
            ->where('is_apk', 1);

        if ($this->mode === 'koordinator') {
            $query->where('koor_apk_id', $this->koorApkId);
        } else {
            $query->where('paslon_id', $this->paslonId);
        }

        return $query->orderBy('village_code')->orderBy('nama')->get()->map(function ($relawan) {
            $credential = $relawan->user
                ? UserCredential::where('user_id', $relawan->user->id)->where('is_active', true)->first()
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
                $relawan->nama,
                (string) $relawan->nik,
                $relawan->user->email ?? '-',
                $password,
                (string)($relawan->no_hp ?? '-'),
                $relawan->alamat ?? '-',
                (string)($relawan->tps ?? '-'),
                $relawan->village->village ?? '-',
                ((int)$relawan->is_kunjungan === 1 ? 'KUNJUNGAN & APK' : 'APK'),
            ];
        });
    }

    public function headings(): array
    {
        if ($this->isAdminMode()) {
            return [
                'Koordinator',
                'Kelurahan Penugasan',
                'Nama Relawan',
                'NIK',
                'Email',
                'Password',
                'No HP',
                'Alamat',
                'TPS',
                'Provinsi',
                'Kota/Kab',
                'Kecamatan',
                'Kelurahan',
                'Tipe Tugas',
            ];
        }

        return [
            'Nama Relawan',
            'NIK',
            'Email',
            'Password',
            'No HP',
            'Alamat',
            'TPS',
            'Kelurahan',
            'Tipe Tugas',
        ];
    }

    public function columnFormats(): array
    {
        if ($this->isAdminMode()) {
            return [
                'D' => NumberFormat::FORMAT_TEXT,
                'G' => NumberFormat::FORMAT_TEXT,
                'I' => NumberFormat::FORMAT_TEXT,
            ];
        }

        return [
            'B' => NumberFormat::FORMAT_TEXT,
            'E' => NumberFormat::FORMAT_TEXT,
            'G' => NumberFormat::FORMAT_TEXT,
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $headerRow = $this->mode === 'koordinator' ? 4 : 1;

                $lastCol = $this->isAdminMode() ? 'N' : 'I';

                $event->sheet->getStyle("A{$headerRow}:{$lastCol}{$headerRow}")
                    ->getFont()->setBold(true);

                if ($this->mode === 'koordinator') {
                    $event->sheet->setCellValue('A1', 'Koordinator :');
                    $event->sheet->setCellValue('B1', $this->namaKoordinator ?? '-');
                    $event->sheet->setCellValue('A2', 'Kelurahan :');
                    $event->sheet->setCellValue('B2', $this->namaKelurahan ?? '-');

                    $event->sheet->getStyle('A1:B2')->getFont()->setBold(true);
                }
            },
        ];
    }
}
