<?php

namespace App\Imports;

use App\Models\City;
use App\Models\District;
use App\Models\Province;
use App\Models\User;
use App\Models\Village;
use App\Models\UserCredential;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class KoordinatorApkImport implements ToCollection, WithHeadingRow
{
    public int $successCount = 0;
    public array $failedRows = [];
    public array $createdAccounts = [];
    protected array $processedVillages = [];

    private string $tableApk = 'apk_koordinators';
    private string $tableKunjungan = 'kunjungan_koordinators';

    public function __construct(
        protected int $paslonId
    ) {}

    private function roleId(string $role): int
    {
        $id = DB::table('roles')->where('role', $role)->value('id');
        if (!$id) throw new \RuntimeException("Role '{$role}' tidak ditemukan di tabel roles");
        return (int) $id;
    }

    private function mapHeader(Collection $row): array
    {
        $mapped = [];
        $headerNameMap = [
            'province' => ['prov', 'provinsi', 'propinsi', 'profinsi'],
            'city'     => ['kab', 'kota', 'kabkot', 'kabupaten', 'kabupaten kota', 'kab/kot'],
            'district' => ['kec', 'kecamatan'],
            'village'  => ['desa', 'deskel', 'kelurahan', 'kel'],
            'nama'     => ['nama'],
            'nik'      => ['nik'],
            'no_hp'    => ['hp', 'no_hp', 'nohp', 'nomor hp', 'nomorhp', 'telp', 'no telp'],
            'alamat'   => ['alamat'],
        ];

        foreach ($row->keys() as $key) {
            $keyLower = strtolower((string) $key);
            foreach ($headerNameMap as $standard => $variants) {
                foreach ($variants as $variant) {
                    if (str_contains($keyLower, $variant)) {
                        $mapped[$standard] = $key;
                        break 2;
                    }
                }
            }
        }

        return $mapped;
    }

    public function collection(Collection $rows)
    {
        foreach ($rows as $index => $row) {
            $rowNumber = $index + 2;

            if ($row->filter(fn($cell) => trim((string) $cell) !== '')->isEmpty()) continue;

            $headers = $this->mapHeader($row);

            // TPS DIHAPUS
            $requiredHeaders = [
                'nama'     => 'nama',
                'nik'      => 'nik',
                'no_hp'    => 'no_hp',
                'alamat'   => 'alamat',
                'province' => 'provinsi',
                'city'     => 'kabupaten/kota',
                'district' => 'kecamatan',
                'village'  => 'desa/kelurahan',
            ];

            $missing = [];
            foreach ($requiredHeaders as $key => $displayName) {
                if (!isset($headers[$key])) $missing[] = $displayName;
            }

            if (!empty($missing)) {
                $this->failedRows[] = [
                    'row' => $rowNumber,
                    'nama' => $row[$headers['nama']] ?? 'Unknown',
                    'errors' => ["Header tidak ditemukan atau salah penulisan: " . implode(', ', $missing)]
                ];
                continue;
            }

            // ===== normalize HP
            $rawPhone = $row[$headers['no_hp']] ?? '';
            $hp = $this->normalizePhoneNumber((string) $rawPhone);

            if (!$hp || !str_starts_with($hp, '08')) {
                $this->failedRows[] = [
                    'row' => $rowNumber,
                    'nama' => $row[$headers['nama']] ?? 'Unknown',
                    'errors' => ['No HP tidak valid / harus mulai dengan 08']
                ];
                continue;
            }

            $row[$headers['no_hp']] = $hp;

            // ===== validasi (TPS DIHAPUS)
            $validator = Validator::make($row->toArray(), [
                $headers['nama']     => 'required|string|max:255',
                $headers['nik']      => 'required|digits:16',
                $headers['no_hp']    => ['required', 'digits_between:10,13'],
                $headers['alamat']   => 'required|string|max:255',
                $headers['province'] => 'required',
                $headers['city']     => 'required',
                $headers['district'] => 'required',
                $headers['village']  => 'required',
            ]);

            if ($validator->fails()) {
                $this->failedRows[] = [
                    'row' => $rowNumber,
                    'nama' => $row[$headers['nama']] ?? 'Unknown',
                    'errors' => $this->formatValidationErrors($validator)
                ];
                continue;
            }

            $nik = (string) $row[$headers['nik']];

            // ===== cek duplikasi lintas tabel (soft delete aware)
            $existsNik =
                DB::table($this->tableApk)->where('nik', $nik)->whereNull('deleted_at')->exists()
                || DB::table($this->tableKunjungan)->where('nik', $nik)->whereNull('deleted_at')->exists()
                || DB::table('relawans')->where('nik', $nik)->whereNull('deleted_at')->exists();

            $existsHp =
                DB::table($this->tableApk)->where('no_hp', $hp)->whereNull('deleted_at')->exists()
                || DB::table($this->tableKunjungan)->where('no_hp', $hp)->whereNull('deleted_at')->exists()
                || DB::table('relawans')->where('no_hp', $hp)->whereNull('deleted_at')->exists();

            if ($existsNik) {
                $this->failedRows[] = ['row' => $rowNumber, 'nama' => $row[$headers['nama']], 'errors' => ['NIK sudah terdaftar (koordinator/relawan)']];
                continue;
            }
            if ($existsHp) {
                $this->failedRows[] = ['row' => $rowNumber, 'nama' => $row[$headers['nama']], 'errors' => ['No HP sudah terdaftar (koordinator/relawan)']];
                continue;
            }

            // ===== lokasi
            $province = $this->findLocation(Province::class, $row[$headers['province']]);
            $city     = $this->findLocation(City::class, $row[$headers['city']], 'province_code', $province?->province_code);
            $district = $this->findLocation(District::class, $row[$headers['district']], 'city_code', $city?->city_code);
            $village  = $this->findLocation(Village::class, $row[$headers['village']], 'district_code', $district?->district_code);

            if (!$province || !$city || !$district || !$village) {
                $errors = [];
                if (!$province) $errors[] = "Provinsi '{$row[$headers['province']]}' tidak ditemukan.";
                if ($province && !$city) $errors[] = "Kab/Kota '{$row[$headers['city']]}' tidak ditemukan di Provinsi '{$province->province}'.";
                if ($city && !$district) $errors[] = "Kecamatan '{$row[$headers['district']]}' tidak ditemukan di Kab/Kota '{$city->city}'.";
                if ($district && !$village) $errors[] = "Desa/Kelurahan '{$row[$headers['village']]}' tidak ditemukan di Kecamatan '{$district->district}'.";
                $this->failedRows[] = ['row' => $rowNumber, 'nama' => $row[$headers['nama']], 'errors' => $errors];
                continue;
            }

            // ===== limit 2 per desa (APK)
            $existingCount = DB::table($this->tableApk)
                ->where('village_code', $village->village_code)
                ->whereNull('deleted_at')
                ->count();

            $sessionCount = $this->processedVillages[$village->village_code] ?? 0;

            if (($existingCount + $sessionCount) >= 2) {
                $this->failedRows[] = [
                    'row' => $rowNumber,
                    'nama' => $row[$headers['nama']],
                    'errors' => ["Desa/Kelurahan '{$village->village}' sudah memiliki " . ($existingCount + $sessionCount) . " koordinator APK (Maksimal 2)."]
                ];
                continue;
            }

            // ===== simpan
            try {
                DB::transaction(function () use ($row, $headers, $province, $city, $district, $village, $nik, $hp) {
                    $nameClean = Str::slug((string) $row[$headers['nama']], '');
                    if ($nameClean === '') $nameClean = 'user';

                    do {
                        $email = $nameClean . rand(1000, 9999) . '@gmail.com';
                    } while (User::where('email', $email)->exists());

                    $passwordPlain = $nameClean . rand(1000, 9999);

                    $roleId = $this->roleId('apk_koordinator');

                    $user = User::create([
                        'name'     => $row[$headers['nama']],
                        'nik'      => $nik,
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

                    DB::table($this->tableApk)->insert([
                        'user_id'       => $user->id,
                        'paslon_id'     => $this->paslonId,
                        'province_code' => $province->province_code,
                        'city_code'     => $city->city_code,
                        'district_code' => $district->district_code,
                        'village_code'  => $village->village_code,
                        'nama'          => $row[$headers['nama']],
                        'nik'           => $nik,
                        'no_hp'         => $hp,
                        'alamat'        => $row[$headers['alamat']],
                        'status'        => 'inactive',
                        'created_at'    => now(),
                        'updated_at'    => now(),
                    ]);

                    $this->createdAccounts[] = [
                        'nama' => $row[$headers['nama']],
                        'email' => $email,
                        'password' => $passwordPlain
                    ];

                    $this->processedVillages[$village->village_code] =
                        ($this->processedVillages[$village->village_code] ?? 0) + 1;

                    $this->successCount++;
                });
            } catch (\Throwable $e) {
                $this->failedRows[] = [
                    'row' => $rowNumber,
                    'nama' => $row[$headers['nama']],
                    'errors' => ['Kesalahan sistem: ' . $e->getMessage()]
                ];
            }
        }
    }

    private function normalizePhoneNumber(?string $phone): ?string
    {
        if (!$phone) return null;
        $phone = preg_replace('/[^0-9]/', '', $phone);
        if (str_starts_with($phone, '62')) $phone = '0' . substr($phone, 2);
        elseif (str_starts_with($phone, '+62')) $phone = '0' . substr($phone, 3);
        return $phone;
    }

    private function formatValidationErrors($validator): array
    {
        $errors = [];
        foreach ($validator->errors()->messages() as $field => $msgs) {
            foreach ($msgs as $msg) {
                if (str_contains($field, 'nik')) $errors[] = 'NIK harus 16 digit & tidak boleh duplikat';
                elseif (str_contains($field, 'hp')) $errors[] = 'No HP tidak valid / sudah terdaftar';
                else $errors[] = $msg;
            }
        }
        return array_unique($errors);
    }

    // pakai mapping lokasi kamu (kalau mau copy mapping “Jakarta dll”, tempel di sini)
    private function normalizeLocationName($modelClass, string $input): string
    {
        $input = trim(strtoupper($input));
        $input = preg_replace('/\s+/', ' ', $input);

        if ($modelClass === Province::class) {
            $map = [
                'JAKARTA' => 'DKI JAKARTA',
                'DKI JAKARTA' => 'DKI JAKARTA',
                'DKIJAKARTA' => 'DKI JAKARTA',
                'DKI-JAKARTA' => 'DKI JAKARTA',
                'JAKARTA RAYA' => 'DKI JAKARTA',
                'PROVINSI JAKARTA' => 'DKI JAKARTA',
                'PROPINSI' => 'DKI JAKARTA',
                'PROFINSI' => 'DKI JAKARTA',
            ];
            return $map[$input] ?? strtoupper($input);
        }

        if ($modelClass === City::class) {
            $map = [
                'JAKARTA TIMUR' => 'KOTA ADM. JAKARTA TIMUR',
                'JAKTIM' => 'KOTA ADM. JAKARTA TIMUR',
                'JAKARTA BARAT' => 'KOTA ADM. JAKARTA BARAT',
                'JAKBAR' => 'KOTA ADM. JAKARTA BARAT',
                'JAKARTA SELATAN' => 'KOTA ADM. JAKARTA SELATAN',
                'JAKSEL' => 'KOTA ADM. JAKARTA SELATAN',
                'JAKARTA UTARA' => 'KOTA ADM. JAKARTA UTARA',
                'JAKUT' => 'KOTA ADM. JAKARTA UTARA',
                'JAKARTA PUSAT' => 'KOTA ADM. JAKARTA PUSAT',
                'JAKPUS' => 'KOTA ADM. JAKARTA PUSAT',
                'KEPULAUAN SERIBU' => 'KAB. ADM. KEP. SERIBU',
                'KEP SERIBU' => 'KAB. ADM. KEP. SERIBU',
            ];
            if (isset($map[$input])) return $map[$input];
            foreach ($map as $key => $value) {
                if (str_contains($input, $key)) return $value;
            }
            // kalau ga match map, balik ke input uppercase
            return strtoupper($input);
        }

        if ($modelClass === District::class) {
            $map = ['GROGOL PETAMBURAN' => 'GROGOL PERTAMBURAN'];
            return $map[$input] ?? strtoupper($input);
        }

        if ($modelClass === Village::class) {
            $map = [
                'HALIM PERDANAKUSUMAH' => 'HALIM PERDANAKUSUMA',
                'HALIM PK' => 'HALIM PERDANAKUSUMA',
                'PAPANGO' => 'PAPANGGO',
                'KAMPUNG TENGAH' => 'TENGAH',
                'PALMERIEM' => 'PALMERIAM',
                'TANJUNGPRIUK' => 'TANJUNGPRIOK',
                'WIJAYA KESUMA' => 'WIJAYA KUSUMA',
                'HARAPAN MULYA' => 'HARAPAN MULIA',
                'BALEKAMBANG' => 'BALE KAMBANG',
            ];
            $inputClean = preg_replace('/[^A-Z0-9 ]/', '', $input);
            return $map[$inputClean] ?? $inputClean;
        }

        return strtoupper($input);
    }

    private function findLocation($modelClass, $inputName, $parentColumn = null, $parentId = null)
    {
        if (empty($inputName)) return null;

        $searchName = $this->normalizeLocationName($modelClass, (string) $inputName);

        $query = $modelClass::query();
        if ($parentColumn && $parentId) $query->where($parentColumn, $parentId);

        $columnName = match ($modelClass) {
            Province::class => 'province',
            City::class => 'city',
            District::class => 'district',
            Village::class => 'village',
            default => 'nama',
        };

        // exact
        $result = (clone $query)->where($columnName, $searchName)->first();
        if ($result) return $result;

        // starts with
        $result = (clone $query)->where($columnName, 'LIKE', $searchName . '%')->first();
        if ($result) return $result;

        // contains
        if (strlen($searchName) >= 4) {
            $result = (clone $query)->where($columnName, 'LIKE', '%' . $searchName . '%')->first();
            if ($result) return $result;
        }

        return null;
    }
}
