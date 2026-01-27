<?php

namespace App\Imports;

use App\Models\Relawan;
use App\Models\User;
use App\Models\Ormas;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;

class RelawanImport implements ToCollection, WithHeadingRow
{
    public int $successCount = 0;
    public array $failedRows = [];
    public array $createdAccounts = [];

    /**
     * =========================
     * HEADER MAPPING (MUDAH DITAMBAH)
     * =========================
     */
    protected array $headerMap = [
        'nama'   => ['nama', 'name', 'nama_lengkap'],
        'nik'    => ['nik', 'no_nik'],
        'no_hp'  => ['no_hp', 'nohp', 'hp', 'telp', 'telepon'],
        'alamat' => ['alamat', 'address'],
        'tps'    => ['tps', 'no_tps'],
        'ormas'  => ['ormas', 'organisasi'],
    ];

    public function collection(Collection $rows)
    {
        $user = Auth::user();
        $koordinator = $user->koordinator;

        if (!$koordinator) {
            throw new \Exception('Akun koordinator tidak valid');
        }

        /**
         * =========================
         * VALIDASI HEADER
         * =========================
         */
        $excelHeaders = collect($rows->first()->keys())
            ->map(fn($h) => strtolower(trim($h)))
            ->toArray();

        $missingHeaders = [];

        foreach ($this->headerMap as $key => $aliases) {
            if (!$this->findHeader($excelHeaders, $aliases)) {
                $missingHeaders[] = $key;
            }
        }

        if (!empty($missingHeaders)) {
            throw new \Exception(
                "Header Excel tidak lengkap / typo. Wajib ada: " . implode(', ', $missingHeaders)
            );
        }

        /**
         * =========================
         * LOOP DATA
         * =========================
         */
        foreach ($rows as $index => $row) {
            $excelRowNumber = $index + 2;
            $errors = [];

            /**
             * =========================
             * SKIP ROW BENAR-BENAR KOSONG
             * =========================
             */
            $rawRow = collect($row)->map(fn($v) => trim((string) $v));
            if ($rawRow->filter()->isEmpty()) {
                continue;
            }

            /**
             * =========================
             * MAPPING HEADER
             * =========================
             */
            $row = $this->mapRow($row);

            /**
             * =========================
             * VALIDASI
             * =========================
             */
            if (empty($row['nama']))   $errors[] = 'Nama wajib diisi';
            if (empty($row['nik']))    $errors[] = 'NIK wajib diisi';
            if (empty($row['no_hp']))  $errors[] = 'No HP wajib diisi';
            if (empty($row['alamat'])) $errors[] = 'Alamat wajib diisi';
            if (empty($row['tps']))    $errors[] = 'TPS wajib diisi';

            if (!empty($row['nik']) && User::where('nik', $row['nik'])->exists()) {
                $errors[] = 'NIK sudah terdaftar';
            }

            /**
             * =========================
             * ORMAS
             * =========================
             */
            $ormasId = null;
            if (!empty($row['ormas'])) {
                $ormasName = strtoupper($row['ormas']);
                $ormas = Ormas::whereRaw('UPPER(nama_ormas) = ?', [$ormasName])->first();
                if (!$ormas) {
                    $errors[] = "Ormas '{$row['ormas']}' tidak ditemukan";
                } else {
                    $ormasId = $ormas->id;
                }
            }

            /**
             * =========================
             * NORMALISASI
             * =========================
             */
            $tpsNormalized = !empty($row['tps'])
                ? str_pad($row['tps'], 3, '0', STR_PAD_LEFT)
                : null;

            // ⬅️ NORMALISASI NO HP KE FORMAT 08xxxxxxxxx
            $row['no_hp'] = $this->normalizePhoneTo08($row['no_hp']);

            if (!empty($errors)) {
                $this->failedRows[] = [
                    'row'    => $excelRowNumber,
                    'nama'   => $row['nama'] ?? '-',
                    'errors' => $errors,
                ];
                continue;
            }

            /**
             * =========================
             * SIMPAN DB
             * =========================
             */
            DB::beginTransaction();
            try {
                $nameClean = strtolower(str_replace(' ', '', $row['nama']));
                $email = $nameClean . rand(1000, 9999) . '@gmail.com';
                $passwordPlain = $nameClean . rand(1000, 9999);

                $userRelawan = User::create([
                    'name'           => $row['nama'],
                    'nik'            => $row['nik'],
                    'email'          => $email,
                    'password'       => Hash::make($passwordPlain),
                    'plain_password' => $passwordPlain,
                    'role'           => 'relawan',
                    'status'         => 'inactive',
                ]);

                Relawan::create([
                    'user_id'        => $userRelawan->id,
                    'koordinator_id' => $koordinator->id,
                    'ormas_id'       => $ormasId,
                    'province_code'  => $koordinator->province_code,
                    'city_code'      => $koordinator->city_code,
                    'district_code'  => $koordinator->district_code,
                    'village_code'   => $koordinator->village_code,
                    'nama'           => $row['nama'],
                    'nik'            => $row['nik'],
                    'no_hp'          => $row['no_hp'],
                    'alamat'         => $row['alamat'],
                    'tps'            => $tpsNormalized,
                    'status'         => 'inactive',
                ]);

                DB::commit();

                $this->successCount++;
                $this->createdAccounts[] = [
                    'nama'     => $row['nama'],
                    'email'    => $email,
                    'password' => $passwordPlain,
                ];
            } catch (\Throwable $e) {
                DB::rollBack();
                $this->failedRows[] = [
                    'row'    => $excelRowNumber,
                    'nama'   => $row['nama'] ?? '-',
                    'errors' => [$e->getMessage()],
                ];
            }
        }
    }

    /**
     * =========================
     * HELPER
     * =========================
     */
    protected function findHeader(array $excelHeaders, array $aliases): ?string
    {
        foreach ($aliases as $alias) {
            if (in_array($alias, $excelHeaders)) {
                return $alias;
            }
        }
        return null;
    }

    protected function mapRow($row): array
    {
        $row = collect($row)->mapWithKeys(fn($v, $k) => [
            strtolower(trim($k)) => trim($v)
        ])->toArray();

        $mapped = [];

        foreach ($this->headerMap as $key => $aliases) {
            foreach ($aliases as $alias) {
                if (isset($row[$alias]) && $row[$alias] !== '') {
                    $mapped[$key] = $row[$alias];
                    break;
                }
            }
        }

        return $mapped;
    }

    /**
     * =========================
     * NORMALISASI NO HP
     * HASIL SELALU 08xxxxxxxxx
     * =========================
     */
    protected function normalizePhoneTo08(?string $phone): ?string
    {
        if (!$phone) return null;

        // hapus semua selain angka
        $phone = preg_replace('/[^0-9]/', '', $phone);

        /**
         * STEP 1: normalisasi ke format nasional TANPA dobel
         */
        // +62xxxxxxxxx atau 62xxxxxxxxx
        if (str_starts_with($phone, '62')) {
            $phone = substr($phone, 2);
        }

        // 8xxxxxxxxx
        if (str_starts_with($phone, '8')) {
            $phone = '0' . $phone;
        }

        /**
         * STEP 2: pastikan diawali 08
         */
        if (!str_starts_with($phone, '08')) {
            return null; // format aneh → bisa kamu jadikan error kalau mau
        }

        return $phone;
    }
}
