<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminPaslon;
use App\Models\CoordinatorVisit;
use App\Models\Relawan;
use App\Models\User;
use App\Models\History;
use App\Models\UserCredential;
use App\Helpers\ActivityLogger;
use App\Helpers\PhoneHelper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use App\Exports\KoordinatorExport;
use App\Imports\KoordinatorImport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Auth;
use Illuminate\Database\Eloquent\SoftDeletes;


class CoordinatorController extends Controller
{
    private function roleId(string $role): int
    {
        $id = DB::table('roles')->where('role', $role)->value('id');

        if (!$id) {
            throw new \RuntimeException("Role '{$role}' tidak ditemukan di tabel roles");
        }

        return (int) $id;
    }

    public function index(Request $request)
    {
        $query = CoordinatorVisit::query()
            ->with([
                'province:province_code,province',
                'city:city_code,city',
                'district:district_code,district',
                'village:village_code,village',
                'paslon:id,nomor_urut,cagub,cawagub',
            ])
            ->withCount('relawans');

        $adminPaslon = AdminPaslon::query()
            ->where('user_id', Auth::id())
            ->whereNull('deleted_at')
            ->first();

        if (!$adminPaslon) {
            return response()->json([
                'status'  => false,
                'message' => 'Akun ini bukan admin paslon / tidak memiliki paslon.',
            ], 403);
        }

        $query->where('paslon_id', (int) $adminPaslon->paslon_id);

        if ($request->filled('city_code')) {
            $query->where('city_code', $request->city_code);
        }
        if ($request->filled('district_code')) {
            $query->where('district_code', $request->district_code);
        }
        if ($request->filled('village_code')) {
            $query->where('village_code', $request->village_code);
        }

        if ($request->filled('search')) {
            $raw = (string) $request->search;

            $keyword = mb_strtolower(trim($raw));
            $keywordNoSpace = preg_replace('/\s+/', '', $keyword);
            $keywordAlnum = preg_replace('/[^a-z0-9]/', '', $keyword);

            $wordToDigit = [
                'nol' => 0, 'zero' => 0,
                'satu' => 1, 'one' => 1, 'pertama' => 1,
                'dua' => 2, 'two' => 2, 'kedua' => 2,
                'tiga' => 3, 'three' => 3, 'ketiga' => 3,
                'empat' => 4, 'four' => 4, 'keempat' => 4,
                'lima' => 5, 'five' => 5, 'kelima' => 5,
                'enam' => 6, 'six' => 6, 'keenam' => 6,
                'tujuh' => 7, 'seven' => 7, 'ketujuh' => 7,
                'delapan' => 8, 'eight' => 8, 'kedelapan' => 8,
                'sembilan' => 9, 'nine' => 9, 'kesembilan' => 9,
                'sepuluh' => 10, 'ten' => 10, 'kesepuluh' => 10,
            ];

            $detectedNomorUrut = null;

            if (preg_match('/\b([0-9]{1,2})\b/', $keyword, $m)) {
                $detectedNomorUrut = (int) $m[1];
            }

            if ($detectedNomorUrut === null) {
                foreach ($wordToDigit as $w => $d) {
                    if (preg_match('/\b' . preg_quote($w, '/') . '\b/u', $keyword)) {
                        $detectedNomorUrut = (int) $d;
                        break;
                    }
                }
            }

            $query->where(function ($q) use ($keyword, $keywordNoSpace, $keywordAlnum, $detectedNomorUrut) {

                $q->where('nama', 'like', "%{$keyword}%")
                    ->orWhere('nik', 'like', "%{$keywordAlnum}%")
                    ->orWhere('no_hp', 'like', "%{$keywordAlnum}%")
                    ->orWhereRaw("REPLACE(LOWER(nama), ' ', '') LIKE ?", ["%{$keywordNoSpace}%"]);

                $q->orWhereHas('province', function ($qq) use ($keyword, $keywordNoSpace) {
                    $qq->where('province', 'like', "%{$keyword}%")
                    ->orWhereRaw("REPLACE(LOWER(province), ' ', '') LIKE ?", ["%{$keywordNoSpace}%"]);
                });

                $q->orWhereHas('city', function ($qq) use ($keyword, $keywordNoSpace) {
                    $qq->where('city', 'like', "%{$keyword}%")
                    ->orWhereRaw("REPLACE(LOWER(city), ' ', '') LIKE ?", ["%{$keywordNoSpace}%"]);
                });

                $q->orWhereHas('district', function ($qq) use ($keyword, $keywordNoSpace) {
                    $qq->where('district', 'like', "%{$keyword}%")
                    ->orWhereRaw("REPLACE(LOWER(district), ' ', '') LIKE ?", ["%{$keywordNoSpace}%"]);
                });

                $q->orWhereHas('village', function ($qq) use ($keyword, $keywordNoSpace) {
                    $qq->where('village', 'like', "%{$keyword}%")
                    ->orWhereRaw("REPLACE(LOWER(village), ' ', '') LIKE ?", ["%{$keywordNoSpace}%"]);
                });

                if ($detectedNomorUrut !== null) {
                    $q->orWhereHas('paslon', function ($qq) use ($detectedNomorUrut) {
                        $qq->where('nomor_urut', $detectedNomorUrut);
                    });
                }

                $q->orWhereHas('paslon', function ($qq) use ($keyword, $keywordNoSpace) {
                    $qq->where('cagub', 'like', "%{$keyword}%")
                    ->orWhere('cawagub', 'like', "%{$keyword}%")
                    ->orWhereRaw("REPLACE(LOWER(cagub), ' ', '') LIKE ?", ["%{$keywordNoSpace}%"])
                    ->orWhereRaw("REPLACE(LOWER(cawagub), ' ', '') LIKE ?", ["%{$keywordNoSpace}%"]);
                });
            });
        }

        if ($request->filled('per_page')) {
            $perPage = max(1, (int) $request->per_page);
            $data = $query->orderByDesc('id')->paginate($perPage);
        } else {
            $data = $query->orderByDesc('id')->get();
        }

        return response()->json([
            'status' => true,
            'data'   => $data
        ]);
    }

    public function show($id)
    {
        $koordinator = CoordinatorVisit::with(['province', 'city', 'district', 'village', 'user'])->find($id);

        if (!$koordinator) {
            return response()->json([
                'status' => 'error',
                'message' => 'Koordinator tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $koordinator
        ]);
    }

    public function store(Request $request)
    {
        $request->merge([
            'no_hp' => PhoneHelper::normalize($request->no_hp),
        ]);

        $adminPaslon = AdminPaslon::query()
            ->where('user_id', Auth::id())
            ->whereNull('deleted_at')
            ->first();

        if (!$adminPaslon) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Akun ini bukan admin paslon / tidak memiliki paslon.',
            ], 403);
        }

        $request->merge([
            'paslon_id' => (int) $adminPaslon->paslon_id,
        ]);

        $validator = Validator::make($request->all(), [
            'nama' => [
                'required',
                'string',
                'max:255',
                'regex:/^[^0-9]+$/'
            ],
            'nik' => [
                'required',
                'digits:16',
                function ($attribute, $value, $fail) {
                    $existsKoordinator = CoordinatorVisit::where('nik', $value)->exists();
                    $existsRelawan     = Relawan::where('nik', $value)->exists();

                    if ($existsKoordinator || $existsRelawan) {
                        $fail('NIK sudah terdaftar sebagai relawan atau koordinator');
                    }
                }
            ],
            'no_hp' => [
                'required',
                'digits_between:10,13',
                function ($attribute, $value, $fail) {
                    if (str_starts_with($value, '021')) {
                        $fail('Nomor telepon rumah (021) tidak diperbolehkan');
                    }
                }
            ],
            'alamat'        => 'required|string|max:255',

            'paslon_id'     => 'required|exists:paslons,id',

            'province_code' => 'required|exists:provinces,province_code',
            'city_code'     => 'required|exists:cities,city_code',
            'district_code' => 'required|exists:districts,district_code',
            'village_code'  => 'required|exists:villages,village_code',
        ], [
            'nama.regex' => 'Nama tidak boleh mengandung angka'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'errors' => $validator->errors()
            ], 422);
        }

        $result = DB::transaction(function () use ($request) {

            $countKoordinator = CoordinatorVisit::query()
                ->where('village_code', $request->village_code)
                ->lockForUpdate()
                ->count();

            if ($countKoordinator >= 2) {
                return [
                    'blocked' => true,
                    'message' => 'Kelurahan ini sudah memiliki 2 koordinator',
                ];
            }

            $nameClean = strtolower(preg_replace('/\s+/', '', trim($request->nama)));
            $randEmail = rand(1000, 9999);
            $randPass  = rand(1000, 9999);

            $email = $nameClean . $randEmail . '@gmail.com';
            $passwordPlain = $nameClean . $randPass;

            if (User::where('email', $email)->exists()) {
                $email = $nameClean . rand(10000, 99999) . '@gmail.com';
            }

            $roleId = $this->roleId('kunjungan_koordinator');

            $user = User::create([
                'name'     => $request->nama,
                'nik'      => $request->nik,
                'email'    => $email,
                'password' => Hash::make($passwordPlain),
                'role_id'  => $roleId,
                'status'   => 'inactive',
            ]);

            UserCredential::create([
                'user_id'            => $user->id,
                'encrypted_password' => Crypt::encryptString($passwordPlain),
                'type'               => 'initial',
                'is_active'          => 1,
            ]);

            $koordinator = CoordinatorVisit::create([
                'user_id'       => $user->id,
                'paslon_id'     => $request->paslon_id,
                'province_code' => $request->province_code,
                'city_code'     => $request->city_code,
                'district_code' => $request->district_code,
                'village_code'  => $request->village_code,
                'nama'          => $request->nama,
                'nik'           => $request->nik,
                'no_hp'         => $request->no_hp,
                'alamat'        => $request->alamat,
                'status'        => 'inactive',
            ]);

            $koordinator->load(['province', 'city', 'district', 'village']);

            ActivityLogger::log([
                'action'      => 'CREATE',
                'target_type' => 'koordinator',
                'target_name' => $koordinator->nama,
                'meta' => [
                    'provinsi'  => $koordinator->province->province ?? null,
                    'kota'      => $koordinator->city->city ?? null,
                    'kecamatan' => $koordinator->district->district ?? null,
                    'kelurahan' => $koordinator->village->village ?? null,
                ]
            ]);

            return [
                'blocked'    => false,
                'koordinator'=> $koordinator,
                'email'      => $email,
                'password'   => $passwordPlain,
            ];
        });

        if (!empty($result['blocked'])) {
            return response()->json([
                'status'  => false,
                'message' => $result['message'],
            ], 422);
        }

        return response()->json([
            'status'  => 'success',
            'message' => 'Koordinator berhasil dibuat',
            'data' => [
                'koordinator' => $result['koordinator'],
                'user' => [
                    'email'    => $result['email'],
                    'password' => $result['password'],
                ]
            ]
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $koordinator = CoordinatorVisit::with('user')->find($id);
        if (!$koordinator) {
            return response()->json([
                'status' => 'error',
                'message' => 'Koordinator tidak ditemukan'
            ], 404);
        }

        $request->merge([
            'no_hp' => PhoneHelper::normalize($request->no_hp),
        ]);

        $adminPaslon = AdminPaslon::query()
            ->where('user_id', Auth::id())
            ->whereNull('deleted_at')
            ->first();

        if (!$adminPaslon) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Akun ini bukan admin paslon / tidak memiliki paslon.',
            ], 403);
        }

        $request->merge([
            'paslon_id' => (int) $adminPaslon->paslon_id,
        ]);

        $validator = Validator::make($request->all(), [
            'nama' => [
                'required',
                'string',
                'max:255',
                'regex:/^[^0-9]+$/'
            ],
            'nik' => [
                'required',
                'digits:16',
                function ($attribute, $value, $fail) use ($koordinator) {
                    $existsKoordinator = CoordinatorVisit::where('nik', $value)
                        ->where('id', '!=', $koordinator->id)
                        ->exists();

                    $existsRelawan = Relawan::where('nik', $value)->exists();

                    if ($existsKoordinator || $existsRelawan) {
                        $fail('NIK sudah terdaftar sebagai relawan atau koordinator');
                    }
                }
            ],
            'no_hp' => [
                'required',
                'digits_between:10,13',
                function ($attribute, $value, $fail) {
                    if (str_starts_with($value, '021')) {
                        $fail('Nomor telepon rumah (021) tidak diperbolehkan');
                    }
                }
            ],
            'paslon_id'     => 'required|exists:paslons,id',

            'alamat'        => 'required|string|max:255',
            'province_code' => 'required|exists:provinces,province_code',
            'city_code'     => 'required|exists:cities,city_code',
            'district_code' => 'required|exists:districts,district_code',
            'village_code'  => 'required|exists:villages,village_code',
        ], [
            'nama.regex' => 'Nama tidak boleh mengandung angka'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'errors' => $validator->errors()
            ], 422);
        }

        $result = DB::transaction(function () use ($request, $koordinator) {

            $oldData = $koordinator->only([
                'nama','nik','no_hp','alamat','province_code','city_code','district_code','village_code','paslon_id'
            ]);

            $oldVillage = $koordinator->village_code;
            $newVillage = $request->village_code;

            if ($oldVillage !== $newVillage) {
                $countKoordinator = CoordinatorVisit::query()
                    ->where('village_code', $newVillage)
                    ->lockForUpdate()
                    ->count();

                if ($countKoordinator >= 2) {
                    return [
                        'blocked' => true,
                        'message' => 'Kelurahan ini sudah memiliki 2 koordinator'
                    ];
                }
            }

            $koordinator->update([
                'paslon_id'     => $request->paslon_id,
                'province_code' => $request->province_code,
                'city_code'     => $request->city_code,
                'district_code' => $request->district_code,
                'village_code'  => $request->village_code,
                'nama'          => $request->nama,
                'nik'           => $request->nik,
                'no_hp'         => $request->no_hp,
                'alamat'        => $request->alamat,
            ]);

            $newEmail = null;
            $newPasswordPlain = null;

            $nameChanged = ($oldData['nama'] ?? null) !== $request->nama;

            if ($koordinator->user) {
                $roleId = $this->roleId('kunjungan_koordinator');

                $userUpdate = [
                    'name' => $request->nama,
                    'nik'  => $request->nik,
                    'role_id' => $roleId,
                ];

                if ($nameChanged) {
                    $nameClean = strtolower(preg_replace('/\s+/', '', trim($request->nama)));
                    $newEmail = $nameClean . rand(1000, 9999) . '@gmail.com';
                    $newPasswordPlain = $nameClean . rand(1000, 9999);

                    if (User::where('email', $newEmail)->where('id', '!=', $koordinator->user->id)->exists()) {
                        $newEmail = $nameClean . rand(10000, 99999) . '@gmail.com';
                    }

                    $userUpdate['email'] = $newEmail;
                    $userUpdate['password'] = Hash::make($newPasswordPlain);

                    UserCredential::where('user_id', $koordinator->user->id)
                        ->update(['is_active' => false]);

                    UserCredential::create([
                        'user_id'            => $koordinator->user->id,
                        'encrypted_password' => Crypt::encryptString($newPasswordPlain),
                        'type'               => 'reactive',
                        'is_active'          => true,
                    ]);
                }

                $koordinator->user->update($userUpdate);
            }

            foreach ($oldData as $field => $oldValue) {
                $newValue = $request->input($field);

                if ((string)$oldValue !== (string)$newValue) {
                    ActivityLogger::log([
                        'action'      => 'UPDATE',
                        'target_type' => 'koordinator',
                        'target_name' => $koordinator->nama,
                        'field'       => $field,
                        'old_value'   => $oldValue,
                        'new_value'   => $newValue,
                    ]);
                }
            }

            return [
                'blocked' => false,
                'koordinator' => $koordinator->fresh(),
                'email' => $newEmail,
                'password' => $newPasswordPlain,
                'name_changed' => $nameChanged,
            ];
        });

        if (!empty($result['blocked'])) {
            return response()->json([
                'status'  => false,
                'message' => $result['message'],
            ], 422);
        }

        $userPayload = null;
        if (!empty($result['name_changed'])) {
            $userPayload = [
                'email'    => $result['email'],
                'password' => $result['password'],
            ];
        }

        return response()->json([
            'status'  => 'success',
            'message' => 'Koordinator berhasil diperbarui',
            'data' => [
                'koordinator' => $result['koordinator'],
                'user'        => $userPayload,
            ]
        ]);
    }

    public function destroy($id)
    {
        $koordinator = CoordinatorVisit::with(['village','district','city','user'])
            ->withCount('relawans')
            ->find($id);

        if (!$koordinator) {
            return response()->json([
                'status' => false,
                'message' => 'Koordinator tidak ditemukan'
            ], 404);
        }

        if ($koordinator->relawans_count > 0) {
            return response()->json([
                'status' => false,
                'message' => "Koordinator ini masih mempunyai {$koordinator->relawans_count} relawan, mohon hapus relawan terlebih dahulu",
                'relawan_count' => $koordinator->relawans_count
            ], 422);
        }

        ActivityLogger::log([
            'action' => 'DELETE',
            'target_type' => 'koordinator',
            'target_name' => $koordinator->nama,
            'meta' => [
                'kelurahan' => $koordinator->village->nama ?? null,
                'kecamatan' => $koordinator->district->nama ?? null,
                'kota' => $koordinator->city->nama ?? null,
            ],
        ]);

        DB::transaction(function () use ($koordinator) {
            $koordinator->delete();
            $koordinator->user?->delete();
        });

        return response()->json([
            'status' => true,
            'message' => 'Koordinator berhasil dihapus'
        ]);
    }

    public function exportAll(Request $request)
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $inputPassword = $request->input('password');
        if (!$inputPassword || !Hash::check($inputPassword, $user->password)) {
            return response()->json(['message' => 'Password salah'], 403);
        }

        ActivityLogger::log([
            'action' => 'EXPORT',
            'target_type' => 'koordinator',
        ]);

        return Excel::download(
            new KoordinatorExport,
            'data-koordinator.xlsx'
        );
    }


    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xls,xlsx'
        ]);

        $import = new KoordinatorImport;

        try {
            Excel::import($import, $request->file('file'));

            return response()->json([
                'status' => true,
                'message' => 'Import selesai',
                'data' => [
                    'successCount' => $import->successCount,
                    'failed_rows'=> $import->failedRows,
                    'created_accounts' => $import->createdAccounts,
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'message' => 'Gagal import: ' . $e->getMessage()
            ], 500);
        }
    }

    public function checkNik(Request $request)
    {
        $request->validate([
            'nik' => 'required|digits:16'
        ]);

        $adminPaslon = AdminPaslon::query()
            ->where('user_id', Auth::id())
            ->whereNull('deleted_at')
            ->first();

        if (!$adminPaslon) {
            return response()->json([
                'status'  => false,
                'message' => 'Akun ini bukan admin paslon.',
            ], 403);
        }

        $koordinator = CoordinatorVisit::withTrashed()
            ->with([
                'user' => fn ($q) => $q->withTrashed(),
                'province:province_code,province',
                'city:city_code,city',
                'district:district_code,district',
                'village:village_code,village',
            ])
            ->where('nik', $request->nik)
            ->first();

        if (!$koordinator) {
            return response()->json([
                'exists'  => false,
                'deleted' => false,
                'data'    => null,
            ], 200);
        }

        if (!$koordinator->trashed()) {
            return response()->json([
                'exists'  => true,
                'deleted' => false,
                'message' => 'NIK sudah terdaftar dan aktif',
                'data'    => [
                    'id' => $koordinator->id,
                    'nama' => $koordinator->nama,
                    'nik' => $koordinator->nik,
                    'no_hp' => $koordinator->no_hp,
                    'alamat' => $koordinator->alamat,
                    'province_code' => $koordinator->province_code,
                    'city_code' => $koordinator->city_code,
                    'district_code' => $koordinator->district_code,
                    'village_code' => $koordinator->village_code,
                ],
            ], 200);
        }

        return response()->json([
            'exists'  => true,
            'deleted' => true,
            'message' => 'NIK pernah terdaftar dan saat ini nonaktif. Ingin aktifkan kembali?',
            'data'    => [
                'id' => $koordinator->id,
                'nama' => $koordinator->nama,
                'nik' => $koordinator->nik,
                'no_hp' => $koordinator->no_hp,
                'alamat' => $koordinator->alamat,
                'province_code' => $koordinator->province_code,
                'city_code' => $koordinator->city_code,
                'district_code' => $koordinator->district_code,
                'village_code' => $koordinator->village_code,
            ],
        ], 200);
    }

    public function restoreByNik(Request $request)
    {
        $request->validate([
            'nik' => 'required|digits:16',

            'nama' => 'sometimes|required|string|max:255|regex:/^[^0-9]+$/',
            'no_hp' => 'sometimes|required|digits_between:10,13',
            'alamat' => 'sometimes|required|string|max:255',
            'province_code' => 'sometimes|required|exists:provinces,province_code',
            'city_code' => 'sometimes|required|exists:cities,city_code',
            'district_code' => 'sometimes|required|exists:districts,district_code',
            'village_code' => 'sometimes|required|exists:villages,village_code',
        ], [
            'nama.regex' => 'Nama tidak boleh mengandung angka'
        ]);

        $adminPaslon = AdminPaslon::query()
            ->where('user_id', Auth::id())
            ->whereNull('deleted_at')
            ->first();

        if (!$adminPaslon) {
            return response()->json([
                'status'  => false,
                'message' => 'Akun ini bukan admin paslon / tidak memiliki paslon.',
            ], 403);
        }

        $koordinator = CoordinatorVisit::withTrashed()
            ->with(['user' => fn ($q) => $q->withTrashed()])
            ->where('nik', $request->nik)
            ->first();

        if (!$koordinator) {
            return response()->json([
                'status'  => false,
                'message' => 'Data koordinator dengan NIK ini tidak ditemukan.',
            ], 404);
        }

        if (!$koordinator->trashed()) {
            return response()->json([
                'status'  => false,
                'message' => 'Koordinator dengan NIK ini sudah aktif.',
            ], 422);
        }

        if ($request->filled('no_hp')) {
            $request->merge([
                'no_hp' => PhoneHelper::normalize($request->no_hp),
            ]);
        }

        $result = DB::transaction(function () use ($request, $koordinator, $adminPaslon) {

            $targetVillage = $request->input('village_code', $koordinator->village_code);

            $countKoordinator = CoordinatorVisit::query()
                ->where('village_code', $targetVillage)
                ->whereNull('deleted_at')
                ->lockForUpdate()
                ->count();

            if ($countKoordinator >= 2) {
                return [
                    'blocked' => true,
                    'message' => 'Kelurahan ini sudah memiliki 2 koordinator, tidak bisa restore.',
                ];
            }

            $koordinator->restore();

            if ($koordinator->user && $koordinator->user->trashed()) {
                $koordinator->user->restore();
            }

            $koordinator->update([
                'paslon_id'     => (int) $adminPaslon->paslon_id,
                'nama'          => $request->input('nama', $koordinator->nama),
                'no_hp'         => $request->input('no_hp', $koordinator->no_hp),
                'alamat'        => $request->input('alamat', $koordinator->alamat),
                'province_code' => $request->input('province_code', $koordinator->province_code),
                'city_code'     => $request->input('city_code', $koordinator->city_code),
                'district_code' => $request->input('district_code', $koordinator->district_code),
                'village_code'  => $targetVillage,
                'status'        => 'inactive',
            ]);

            $nameClean = strtolower(preg_replace('/\s+/', '', trim($koordinator->nama)));
            $newEmail = $nameClean . rand(1000, 9999) . '@gmail.com';
            $newPasswordPlain = $nameClean . rand(1000, 9999);

            if (User::where('email', $newEmail)->where('id', '!=', optional($koordinator->user)->id)->exists()) {
                $newEmail = $nameClean . rand(10000, 99999) . '@gmail.com';
            }

            if ($koordinator->user) {
                $roleId = $this->roleId('kunjungan_koordinator');

                $koordinator->user->update([
                    'name'     => $koordinator->nama,
                    'nik'      => $koordinator->nik,
                    'email'    => $newEmail,
                    'password' => Hash::make($newPasswordPlain),
                    'role_id'  => $roleId,
                    'status'   => 'inactive',
                ]);

                UserCredential::where('user_id', $koordinator->user->id)
                    ->update(['is_active' => false]);

                UserCredential::create([
                    'user_id'            => $koordinator->user->id,
                    'encrypted_password' => Crypt::encryptString($newPasswordPlain),
                    'type'               => 'reactive',
                    'is_active'          => true,
                ]);
            }

            ActivityLogger::log([
                'action'      => 'RESTORE',
                'target_type' => 'koordinator',
                'target_name' => $koordinator->nama,
                'field'       => 'activate_nik',
                'old_value'   => 'deleted',
                'new_value'   => 'active',
            ]);

            return [
                'blocked' => false,
                'koordinator' => $koordinator->fresh(['user','province','city','district','village']),
                'email' => $newEmail,
                'password' => $newPasswordPlain,
            ];
        });

        if (!empty($result['blocked'])) {
            return response()->json([
                'status'  => false,
                'message' => $result['message'],
            ], 422);
        }

        return response()->json([
            'status'  => true,
            'message' => "Koordinator {$result['koordinator']->nama} berhasil diaktifkan kembali",
            'data' => [
                'koordinator' => $result['koordinator'],
                'user' => [
                    'email'    => $result['email'],
                    'password' => $result['password'],
                ],
            ]
        ]);
    }
}
