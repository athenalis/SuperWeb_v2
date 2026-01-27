<?php

namespace App\Imports;

use App\Models\City;
use App\Models\District;
use App\Models\Coordinator;
use App\Models\Province;
use App\Models\User;
use App\Models\Village;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Illuminate\Support\Facades\Validator;

class KoordinatorImport implements ToCollection, WithHeadingRow
{
    public int $successCount = 0;
    public array $failedRows = [];
    public array $createdAccounts = [];
    protected array $processedVillages = [];

    // ================== Mapping header fleksibel ==================
    private function mapHeader(Collection $row)
    {
        $mapped = [];
        $headerNameMap = [
            'province' => ['prov', 'provinsi', 'propinsi', 'profinsi'],
            'city' => ['kab', 'kota', 'kabkot', 'kabupaten', 'kabupaten kota', 'kab/kot'],
            'district' => ['kec', 'kecamatan'],
            'village' => ['desa', 'deskel', 'kelurahan', 'kel'],
            'nama' => ['nama'],
            'nik' => ['nik'],
            'no_hp' => ['hp', 'no_hp', 'nohp', 'nomor hp', 'nomorhp', 'telp', 'no telp'],
            'tps' => ['tps'],
            'alamat' => ['alamat'],
        ];

        foreach ($row->keys() as $key) {
            $keyLower = strtolower($key);
            foreach ($headerNameMap as $standard => $variants) {
                foreach ($variants as $variant) {
                    if (str_contains($keyLower, $variant)) {
                        $mapped[$standard] = $key; // simpan nama header Excel sebenarnya
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

        // ===================== SKIP BARIS KOSONG =====================
        if ($row->filter(fn($cell) => trim((string)$cell) !== '')->isEmpty()) continue;

        $headers = $this->mapHeader($row);

        // ===================== CEK HEADER WAJIB =====================
        $requiredHeaders = [
            'nama' => 'nama',
            'nik' => 'nik',
            'no_hp' => 'no_hp',
            'tps' => 'tps',
            'alamat' => 'alamat',
            'province' => 'provinsi',
            'city' => 'kabupaten/kota',
            'district' => 'kecamatan',
            'village' => 'desa/kelurahan'
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

        // ===================== NORMALISASI NO HP =====================
        $rawPhone = $row[$headers['no_hp']] ?? '';
        $normalizedPhone = $this->normalizePhoneNumber($rawPhone);

        if (!$normalizedPhone || !str_starts_with($normalizedPhone, '08')) {
            $this->failedRows[] = [
                'row' => $rowNumber,
                'nama' => $row[$headers['nama']] ?? 'Unknown',
                'errors' => ['No HP tidak valid / harus mulai dengan 08']
            ];
            continue;
        }

        $row[$headers['no_hp']] = $normalizedPhone;

        // ===================== VALIDASI DASAR =====================
        $validator = Validator::make($row->toArray(), [
            $headers['nama'] => 'required|string|max:255',
            $headers['nik'] => 'required|digits:16|unique:koordinators,nik',
            $headers['no_hp'] => ['required', 'digits_between:10,13', 'unique:koordinators,no_hp'],
            $headers['tps'] => 'required',
            $headers['alamat'] => 'required|string|max:255',
            $headers['province'] => 'required',
            $headers['city'] => 'required',
            $headers['district'] => 'required',
            $headers['village'] => 'required',
        ]);

        if ($validator->fails()) {
            $this->failedRows[] = [
                'row' => $rowNumber,
                'nama' => $row[$headers['nama']] ?? 'Unknown',
                'errors' => $this->formatValidationErrors($validator)
            ];
            continue;
        }

        // ===================== NORMALISASI LOKASI =====================
        $province = $this->findLocation(Province::class, $row[$headers['province']]);
        $city = $this->findLocation(City::class, $row[$headers['city']], 'province_code', $province?->province_code);
        $district = $this->findLocation(District::class, $row[$headers['district']], 'city_code', $city?->city_code);
        $village = $this->findLocation(Village::class, $row[$headers['village']], 'district_code', $district?->district_code);

        $locationErrors = [];
        if (!$province) $locationErrors[] = "Provinsi '{$row[$headers['province']]}' tidak ditemukan.";
        if ($province && !$city) $locationErrors[] = "Kab/Kota '{$row[$headers['city']]}' tidak ditemukan di Provinsi '{$province->province}'.";
        if ($city && !$district) $locationErrors[] = "Kecamatan '{$row[$headers['district']]}' tidak ditemukan di Kab/Kota '{$city->city}'.";
        if ($district && !$village) $locationErrors[] = "Desa/Kelurahan '{$row[$headers['village']]}' tidak ditemukan di Kecamatan '{$district->district}'.";

        if (!empty($locationErrors)) {
            $this->failedRows[] = [
                'row' => $rowNumber,
                'nama' => $row[$headers['nama']],
                'errors' => $locationErrors
            ];
            continue;
        }

        // ===================== LIMIT 2 KOORDINATOR =====================
        $existingCount = Coordinator::where('village_code', $village->village_code)->count();
        $sessionCount = $this->processedVillages[$village->village_code] ?? 0;

        if (($existingCount + $sessionCount) >= 2) {
            $this->failedRows[] = [
                'row' => $rowNumber,
                'nama' => $row[$headers['nama']],
                'errors' => ["Desa/Kelurahan '{$village->village}' sudah memiliki " . ($existingCount + $sessionCount) . " koordinator (Maksimal 2)."]
            ];
            continue;
        }

        // ===================== NORMALISASI TPS =====================
        $tps = $this->normalizeTps($row[$headers['tps']]);

        // ===================== SIMPAN DATA =====================
        try {
            $nameClean = Str::slug($row[$headers['nama']], '');
            $email = $nameClean . rand(1000, 9999) . "@gmail.com";
            $passwordPlain = $nameClean . rand(1000, 9999);
            $passwordHash = Hash::make($passwordPlain);

            $user = User::create([
                'name' => $row[$headers['nama']],
                'nik' => $row[$headers['nik']],
                'email' => $email,
                'password' => $passwordHash,
                'plain_password' => $passwordPlain,
                'role' => 'koordinator',
                'status' => 'inactive',
            ]);

            Coordinator::create([
                'user_id' => $user->id,
                'province_code' => $province->province_code,
                'city_code' => $city->city_code,
                'district_code' => $district->district_code,
                'village_code' => $village->village_code,
                'nama' => $row[$headers['nama']],
                'nik' => $row[$headers['nik']],
                'no_hp' => $row[$headers['no_hp']],
                'alamat' => $row[$headers['alamat']],
                'tps' => $tps,
                'status' => 'inactive',
            ]);

            $this->createdAccounts[] = [
                'nama' => $row[$headers['nama']],
                'email' => $email,
                'password' => $passwordPlain
            ];

            $this->processedVillages[$village->village_code] = ($this->processedVillages[$village->village_code] ?? 0) + 1;
            $this->successCount++;
        } catch (\Throwable $e) {
            $this->failedRows[] = [
                'row' => $rowNumber,
                'nama' => $row[$headers['nama']],
                'errors' => ['Kesalahan sistem: ' . $e->getMessage()]
            ];
        }
    }
}

    // ===================== HELPERS =====================
    private function normalizePhoneNumber(?string $phone): ?string
    {
        if (!$phone) return null;

        // hapus semua karakter non-digit
        $phone = preg_replace('/[^0-9]/', '', $phone);

        // ubah awalan 62 atau +62 jadi 0
        if (str_starts_with($phone, '62')) {
            $phone = '0' . substr($phone, 2);
        } elseif (str_starts_with($phone, '+62')) {
            $phone = '0' . substr($phone, 3);
        }

        // jika mulai dengan 08, biarkan
        // jika mulai dengan 0 tapi bukan 08 → invalid, nanti di validator
        return $phone;
    }

    private function normalizeTps($tps): string
    {
        $tps = trim($tps);
        if ($tps === '') return '000';
        return str_pad((int)$tps, 3, '0', STR_PAD_LEFT);
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

        $searchName = $this->normalizeLocationName($modelClass, $inputName);

        $query = $modelClass::query();
        if ($parentColumn && $parentId) $query->where($parentColumn, $parentId);

        $columnName = match ($modelClass) {
            Province::class => 'province',
            City::class => 'city',
            District::class => 'district',
            Village::class => 'village',
            default => 'nama',
        };

        // Exact match
        $result = (clone $query)->where($columnName, $searchName)->first();
        if ($result) return $result;

        // Starts with
        $result = (clone $query)->where($columnName, 'LIKE', $searchName . '%')->first();
        if ($result) return $result;

        // Contains (minimal 4 karakter)
        if (strlen($searchName) >= 4) {
            $result = (clone $query)->where($columnName, 'LIKE', '%' . $searchName . '%')->first();
            if ($result) return $result;
        }

        return null;
    }
}
