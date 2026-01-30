<?php

namespace App\Imports;

use App\Models\Ormas;
use App\Models\Relawan;
use App\Models\User;
use App\Models\UserCredential;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class RelawanKunjunganImport implements ToCollection, WithHeadingRow
{
    public int $successCount = 0;
    public int $updatedDoubleJobCount = 0;
    public array $failedRows = [];
    public array $createdAccounts = [];

    public function __construct(
        protected int $koorKunjunganId
    ) {}

    protected array $headerMap = [
        'nama'     => ['nama', 'name', 'nama_lengkap'],
        'nik'      => ['nik', 'no_nik'],
        'no_hp'    => ['no_hp', 'nohp', 'hp', 'telp', 'telepon'],
        'alamat'   => ['alamat', 'address'],
        'tps'      => ['tps', 'no_tps'],
        'ormas'    => ['ormas', 'organisasi'],
    ];

    public function collection(Collection $rows)
    {
        $koor = DB::table('kunjungan_koordinators')
            ->where('id', $this->koorKunjunganId)
            ->whereNull('deleted_at')
            ->first();

        if (!$koor) throw new \Exception('Koordinator kunjungan tidak valid');

        $paslonId = (int) ($koor->paslon_id ?? 0);
        if (!$paslonId) throw new \Exception('Paslon koordinator tidak valid');

        $headers = $this->mapHeader($rows->first());

        $required = ['nama','nik','no_hp','alamat','tps'];
        $missing = array_values(array_filter($required, fn($k) => !isset($headers[$k])));
        if ($missing) {
            throw new \Exception("Header Excel tidak lengkap/typo. Wajib ada: " . implode(', ', $missing));
        }

        foreach ($rows as $i => $row) {
            $rowNumber = $i + 2;

            if ($row->filter(fn($c) => trim((string)$c) !== '')->isEmpty()) continue;

            $data = $this->mapRow($row, $headers);

            $data['no_hp'] = $this->normalizePhoneTo08($data['no_hp'] ?? null);
            $data['tps']   = $this->normalizeTps($data['tps'] ?? null);

            $v = Validator::make($data, [
                'nama'   => 'required|string|max:255',
                'nik'    => 'required|digits:16',
                'no_hp'  => 'required|digits_between:10,13',
                'alamat' => 'required|string|max:255',
                'tps'    => 'required|string|max:3',
            ]);

            if ($v->fails()) {
                $this->failedRows[] = [
                    'row' => $rowNumber,
                    'nama' => $data['nama'] ?? '-',
                    'errors' => array_values(array_unique($v->errors()->all())),
                ];
                continue;
            }

            $ormasId = null;
            if (!empty($data['ormas'])) {
                $ormasName = strtoupper(trim($data['ormas']));
                $ormas = Ormas::whereRaw('UPPER(nama_ormas) = ?', [$ormasName])->first();
                if (!$ormas) {
                    $this->failedRows[] = [
                        'row' => $rowNumber,
                        'nama' => $data['nama'],
                        'errors' => ["Ormas '{$data['ormas']}' tidak ditemukan"],
                    ];
                    continue;
                }
                $ormasId = $ormas->id;
            }

            $nik = (string)$data['nik'];

            $existing = Relawan::withTrashed()
                ->with(['village:village_code,village'])
                ->where('nik', $nik)
                ->first();

            // untuk import kunjungan: kalau sudah ada aktif => duplikat / atau sudah apk (nggak boleh upgrade)
            if ($existing && !$existing->trashed()) {
                if ((int)$existing->paslon_id !== $paslonId) {
                    $this->failedRows[] = [
                        'row' => $rowNumber,
                        'nama' => $data['nama'],
                        'errors' => ["Relawan ini sudah terdaftar di paslon lain."],
                    ];
                    continue;
                }

                // ✅ cek wilayah harus sama koor
                if ((string)$existing->village_code !== (string)$koor->village_code) {
                    $kel = $existing->village->village ?? 'UNKNOWN';
                    $this->failedRows[] = [
                        'row' => $rowNumber,
                        'nama' => $data['nama'],
                        'errors' => ["Relawan ini sudah terdaftar di kunjungan/apk dengan kelurahan {$kel}."],
                    ];
                    continue;
                }

                if ((int)$existing->is_kunjungan === 1) {
                    $this->failedRows[] = [
                        'row' => $rowNumber,
                        'nama' => $data['nama'],
                        'errors' => ['NIK sudah terdaftar sebagai relawan kunjungan'],
                    ];
                    continue;
                }

                $this->failedRows[] = [
                    'row' => $rowNumber,
                    'nama' => $data['nama'],
                    'errors' => ['Relawan sudah terdaftar sebagai relawan APK. Tidak bisa ditambahkan sebagai kunjungan lewat import ini.'],
                ];
                continue;
            }

            // CREATE relawan kunjungan
            try {
                DB::transaction(function () use ($data, $ormasId, $koor, $paslonId) {
                    $nameClean = Str::slug((string)$data['nama'], '');
                    if ($nameClean === '') $nameClean = 'user';

                    do {
                        $email = $nameClean . rand(1000, 9999) . '@gmail.com';
                    } while (User::where('email', $email)->exists());

                    $passwordPlain = $nameClean . rand(1000, 9999);

                    $roleId = (int) DB::table('roles')->where('role', 'relawan')->value('id');

                    $user = User::create([
                        'name'     => $data['nama'],
                        'nik'      => $data['nik'],
                        'email'    => $email,
                        'password' => Hash::make($passwordPlain),
                        'role_id'  => $roleId,
                        'status'   => 'inactive',
                    ]);

                    UserCredential::create([
                        'user_id'            => $user->id,
                        'encrypted_password' => Crypt::encryptString($passwordPlain),
                        'type'               => 'initial',
                        'is_active'          => true,
                    ]);

                    Relawan::create([
                        'user_id' => $user->id,
                        'paslon_id' => $paslonId,

                        'koor_kunjungan_id' => (int)$koor->id,
                        'koor_apk_id' => null,

                        // ✅ wilayah selalu dari koor
                        'province_code' => $koor->province_code,
                        'city_code'     => $koor->city_code,
                        'district_code' => $koor->district_code,
                        'village_code'  => $koor->village_code,

                        'ormas_id' => $ormasId,
                        'nama' => $data['nama'],
                        'nik' => $data['nik'],
                        'no_hp' => $data['no_hp'],
                        'alamat' => $data['alamat'],
                        'tps' => $data['tps'],

                        'is_kunjungan' => 1,
                        'is_apk' => 0,
                        'status' => 'inactive',
                    ]);

                    $this->createdAccounts[] = [
                        'nama' => $data['nama'],
                        'email' => $email,
                        'password' => $passwordPlain,
                    ];

                    $this->successCount++;
                });
            } catch (\Throwable $e) {
                $this->failedRows[] = [
                    'row' => $rowNumber,
                    'nama' => $data['nama'],
                    'errors' => ['Kesalahan sistem: ' . $e->getMessage()],
                ];
            }
        }
    }

    private function mapHeader($row): array
    {
        $mapped = [];
        foreach ($row->keys() as $key) {
            $k = strtolower(trim((string)$key));
            foreach ($this->headerMap as $standard => $aliases) {
                foreach ($aliases as $alias) {
                    if (str_contains($k, $alias)) {
                        $mapped[$standard] = $key;
                        break 2;
                    }
                }
            }
        }
        return $mapped;
    }

    private function mapRow($row, array $headers): array
    {
        $out = [];
        foreach ($headers as $std => $realKey) {
            $out[$std] = trim((string)($row[$realKey] ?? ''));
        }
        return $out;
    }

    private function normalizeTps($tps): ?string
    {
        $tps = trim((string)$tps);
        if ($tps === '') return null;
        return str_pad($tps, 3, '0', STR_PAD_LEFT);
    }

    private function normalizePhoneTo08(?string $phone): ?string
    {
        if (!$phone) return null;
        $p = preg_replace('/[^0-9]/', '', $phone);
        if (str_starts_with($p, '62')) $p = substr($p, 2);
        if (str_starts_with($p, '8')) $p = '0' . $p;
        return str_starts_with($p, '08') ? $p : null;
    }
}
