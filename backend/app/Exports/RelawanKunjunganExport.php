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


class RelawanKunjunganExport extends DefaultValueBinder implements
    FromCollection,
    WithHeadings,
    ShouldAutoSize,
    WithCustomStartCell,
    WithEvents,
    WithColumnFormatting,
    WithCustomValueBinder
{
    protected string $mode; // koordinator | admin_paslon
    protected ?int $koorKunjunganId;
    protected ?int $paslonId;
    protected ?string $namaKoordinator;
    protected ?string $namaKelurahan;

    public function __construct(string $mode, ?int $koorKunjunganId = null, ?int $paslonId = null)
    {
        $this->mode = $mode;
        $this->koorKunjunganId = $koorKunjunganId;
        $this->paslonId = $paslonId;

        if ($mode === 'koordinator' && $koorKunjunganId) {
            $this->namaKoordinator = DB::table('kunjungan_koordinators')->where('id', $koorKunjunganId)->value('nama');
            $this->namaKelurahan   = DB::table('kunjungan_koordinators')
                ->join('villages', 'villages.village_code', '=', 'kunjungan_koordinators.village_code')
                ->where('kunjungan_koordinators.id', $koorKunjunganId)
                ->value('villages.village');
        }
    }

    public function bindValue(Cell $cell, $value)
    {
        // Paksa kolom-kolom ini jadi TEXT (biar gak jadi scientific notation / hilang leading zero)
        if (in_array($cell->getColumn(), ['B', 'E', 'G'], true)) {
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
        $query = Relawan::query()
            ->with(['user', 'village', 'city', 'district', 'province'])
            ->whereNull('deleted_at')
            ->where('is_kunjungan', 1); // double job ikut karena is_kunjungan=1

        if ($this->mode === 'koordinator') {
            $query->where('koor_kunjungan_id', $this->koorKunjunganId);
        } else {
            // admin paslon
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

            if ($this->mode === 'admin_paslon') {
                return [
                    $relawan->nama,
                    (string) $relawan->nik,
                    $relawan->user->email ?? '-',
                    $password,
                    (string)($relawan->no_hp ?? '-'),
                    $relawan->alamat ?? '-',
                    $relawan->tps ?? '-',
                    $relawan->province->province ?? '-',
                    $relawan->city->city ?? '-',
                    $relawan->district->district ?? '-',
                    $relawan->village->village ?? '-',
                    ((int)$relawan->is_apk === 1 ? 'KUNJUNGAN & APK' : 'KUNJUNGAN'),
                ];
            }

            // koordinator
            return [
                $relawan->nama,
                (string) $relawan->nik,
                $relawan->user->email ?? '-',
                $password,
                (string)($relawan->no_hp ?? '-'),
                $relawan->alamat ?? '-',
                $relawan->tps ?? '-',
                $relawan->village->village ?? '-',
                ((int)$relawan->is_apk === 1 ? 'KUNJUNGAN & APK' : 'KUNJUNGAN'),
            ];
        });
    }

    public function headings(): array
    {
        if ($this->mode === 'admin_paslon') {
            return [
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
        if ($this->mode === 'admin_paslon') {
            return [
                'B' => NumberFormat::FORMAT_TEXT, // NIK
                'E' => NumberFormat::FORMAT_TEXT, // No HP
                'G' => NumberFormat::FORMAT_TEXT, // TPS
            ];
        }

        return [
            'B' => NumberFormat::FORMAT_TEXT, // NIK
            'E' => NumberFormat::FORMAT_TEXT, // No HP
            'G' => NumberFormat::FORMAT_TEXT, // TPS
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $headerRow = $this->mode === 'koordinator' ? 3 : 1;
                $lastCol   = $this->mode === 'admin_paslon' ? 'L' : 'I';

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
