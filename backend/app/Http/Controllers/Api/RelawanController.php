<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\ActivityLogger;
use App\Helpers\PhoneHelper;

use App\Models\User;
use App\Models\Relawan;
use App\Models\VisitForm;
use App\Models\CoordinatorVisit;
use App\Models\UserCredential;
use App\Models\AdminPaslon;

use App\Exports\RelawanKunjunganExport;
use App\Exports\RelawanApkExport;

use App\Imports\RelawanApkImport;
use App\Imports\RelawanKunjunganImport;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

use Maatwebsite\Excel\Facades\Excel;

class RelawanController extends Controller
{
    /* =========================================================
     * Helpers (ROLE + KOORDINATOR)
     * ========================================================= */

    private function userRoleSlug($user): ?string
    {
        // prioritas role_id dulu (biar gak ketiban kolom users.role legacy)
        if (!empty($user->role_id)) {
            $slug = DB::table('roles')->where('id', $user->role_id)->value('role');
            if (!empty($slug)) return $slug;
        }

        // fallback terakhir
        return !empty($user->role) ? $user->role : null;
    }

    private function roleId(string $slug): ?int
    {
        $id = DB::table('roles')->where('role', $slug)->value('id');
        return $id ? (int) $id : null;
    }

    private function getKunjunganCoordinator($user)
    {
        return CoordinatorVisit::where('user_id', $user->id)
            ->whereNull('deleted_at')
            ->first();
    }

    private function getApkCoordinator($user)
    {
        // NOTE: pakai table karena modelnya bisa beda nama, tapi tetap aman
        return DB::table('apk_koordinators')
            ->where('user_id', $user->id)
            ->whereNull('deleted_at')
            ->first();
    }

    private function normalizeTps($tps): ?string
    {
        if ($tps === null) return null;
        $tps = trim((string) $tps);
        $tps = preg_replace('/[^0-9]/', '', $tps);
        $tps = substr($tps, 0, 3);
        return $tps === '' ? null : $tps;
    }

    private function canDoubleJobFromKunjunganToApk(Relawan $relawan): bool
    {
        // hanya boleh: relawan sudah kunjungan, belum apk
        return ((int)$relawan->is_kunjungan === 1) && ((int)$relawan->is_apk === 0);
    }

    /* =========================================================
     * Query Builders
     * ========================================================= */

    private function baseQueryRelawan()
    {
        $q = Relawan::query()
            ->with([
                'province:province_code,province',
                'city:city_code,city',
                'district:district_code,district',
                'village:village_code,village',
            ]);

        // ✅ FIX: jangan error kalau relation visitForms belum ada
        if (method_exists(Relawan::class, 'visitForms')) {
            $q->withCount('visitForms');
        }

        return $q;
    }

    private function applySearchAndFilters(Request $request, $query)
    {
        /**
         * ✅ FIX MINIMAL:
         * Frontend kirim "keyword", controller lama pakai "search".
         * Kita dukung dua-duanya tanpa merusak kompatibilitas.
         */
        $searchValue = null;
        if ($request->filled('search')) $searchValue = $request->search;
        if ($request->filled('keyword')) $searchValue = $request->keyword; // alias dari frontend

        if (!empty($searchValue)) {
            $keyword = $searchValue;

            $query->where(function ($q) use ($keyword) {
                $q->where('nama', 'like', "%{$keyword}%")
                    ->orWhere('nik', 'like', "%{$keyword}%")
                    ->orWhere('no_hp', 'like', "%{$keyword}%")
                    ->orWhere('tps', 'like', "%{$keyword}%")
                    ->orWhereHas('province', fn($qq) => $qq->where('province', 'like', "%{$keyword}%"))
                    ->orWhereHas('city', fn($qq) => $qq->where('city', 'like', "%{$keyword}%"))
                    ->orWhereHas('district', fn($qq) => $qq->where('district', 'like', "%{$keyword}%"))
                    ->orWhereHas('village', fn($qq) => $qq->where('village', 'like', "%{$keyword}%"));
            });
        }

        if ($request->filled('city_code')) $query->where('city_code', $request->city_code);
        if ($request->filled('district_code')) $query->where('district_code', $request->district_code);
        if ($request->filled('village_code')) $query->where('village_code', $request->village_code);

        return $query;
    }

    private function finalizeList(Request $request, $query)
    {
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

    /* =========================================================
     * INDEX LIST
     * ========================================================= */

    public function indexApk(Request $request)
    {
        $actor    = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        $isApkKoor     = $roleSlug === 'apk_koordinator';
        $isAdminPaslon = $roleSlug === 'admin_paslon';
        $isAdminApk    = $roleSlug === 'admin_apk';

        if (!$isApkKoor && !$isAdminPaslon && !$isAdminApk) {
            return response()->json([
                'status'  => false,
                'message' => 'Anda tidak memiliki akses melihat relawan APK'
            ], 403);
        }

        $query = $this->baseQueryRelawan();
        $paslonId = null;

        if ($isAdminPaslon) {
            $adminPaslon = AdminPaslon::query()
                ->where('user_id', $actor->id)
                ->whereNull('deleted_at')
                ->first();

            if (!$adminPaslon) {
                return response()->json([
                    'status'  => false,
                    'message' => 'Akun ini bukan admin paslon / tidak memiliki paslon.',
                ], 403);
            }

            $mappedPaslonId = DB::table('paslons')
                ->where('nomor_urut', $adminPaslon->paslon_id)
                ->value('id');

            $paslonId = $mappedPaslonId ? (int) $mappedPaslonId : (int) $adminPaslon->paslon_id;
        }

        if ($isApkKoor) {
            $koor = $this->getApkCoordinator($actor);
            if (!$koor) {
                return response()->json([
                    'status'  => false,
                    'message' => 'Akun koordinator apk tidak valid'
                ], 403);
            }

            $paslonId = (int) ($koor->paslon_id ?? 0);
            $query->where('koor_apk_id', (int)$koor->id);
        }

        if ($isAdminApk) {
            $adminApkRow = DB::table('admin_apks')
                ->where('user_id', $actor->id)
                ->whereNull('deleted_at')
                ->first();

            if (!$adminApkRow) {
                return response()->json([
                    'status'  => false,
                    'message' => 'Akun ini bukan admin apk / tidak memiliki paslon.',
                ], 403);
            }

            $paslonId = (int) ($adminApkRow->paslon_id ?? 0);
        }

        if (!$paslonId) {
            return response()->json([
                'status'  => false,
                'message' => 'Paslon tidak ditemukan untuk akun ini.',
            ], 403);
        }

        $query->where('paslon_id', $paslonId)
            ->where('is_apk', 1);

        $this->applySearchAndFilters($request, $query);

        return $this->finalizeList($request, $query);
    }

    public function indexKunjungan(Request $request)
    {
        $actor    = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        $isKunjunganKoor = $roleSlug === 'kunjungan_koordinator';
        $isAdminPaslon   = $roleSlug === 'admin_paslon';

        if (!$isKunjunganKoor && !$isAdminPaslon) {
            return response()->json([
                'status'  => false,
                'message' => 'Anda tidak memiliki akses melihat relawan Kunjungan'
            ], 403);
        }

        $query = $this->baseQueryRelawan();

        /**
         * ✅ FIX UTAMA:
         * - Untuk admin_paslon: sebelumnya bikin $paslonIds tapi gak dipakai,
         *   dan gak pernah set $paslonId -> akhirnya selalu 403.
         * - Sekarang: admin_paslon pakai whereIn agar kompatibel data lama (nomor_urut vs id).
         */
        $paslonIds = [];
        $paslonId  = null;

        if ($isAdminPaslon) {
            $adminPaslon = AdminPaslon::query()
                ->where('user_id', $actor->id)
                ->whereNull('deleted_at')
                ->first();

            if (!$adminPaslon) {
                return response()->json([
                    'status'  => false,
                    'message' => 'Akun ini bukan admin paslon / tidak memiliki paslon.',
                ], 403);
            }

            $paslonNoUrut = (int) $adminPaslon->paslon_id;

            $paslonDbId = DB::table('paslons')
                ->where('nomor_urut', $paslonNoUrut)
                ->value('id');

            $paslonIds = array_values(array_unique(array_filter([
                $paslonNoUrut,
                $paslonDbId ? (int)$paslonDbId : null,
            ])));

            // set juga paslonId biar gak jatuh ke 403
            $paslonId = $paslonDbId ? (int)$paslonDbId : $paslonNoUrut;

            // filter pakai whereIn biar aman untuk data lama
            $query->whereIn('paslon_id', $paslonIds);
        }

        if ($isKunjunganKoor) {
            $koor = $this->getKunjunganCoordinator($actor);
            if (!$koor) {
                return response()->json([
                    'status'  => false,
                    'message' => 'Akun koordinator kunjungan tidak valid'
                ], 403);
            }

            $paslonId = (int) ($koor->paslon_id ?? 0);
            $query->where('koor_kunjungan_id', (int)$koor->id);
            $query->where('paslon_id', $paslonId); // koordinator: paslon wajib match
        }

        if (!$paslonId) {
            return response()->json([
                'status'  => false,
                'message' => 'Paslon tidak ditemukan untuk akun ini.',
            ], 403);
        }

        $query->where('is_kunjungan', 1);

        $this->applySearchAndFilters($request, $query);

        return $this->finalizeList($request, $query);
    }

    /* =========================================================
     * SHOW (APK & KUNJUNGAN) ✅ FIXED
     * ========================================================= */

    private function resolvePaslonIdForActor($actor, string $roleSlug): ?int
    {
        if ($roleSlug === 'admin_paslon') {
            $adminPaslon = AdminPaslon::query()
                ->where('user_id', $actor->id)
                ->whereNull('deleted_at')
                ->first();

            if (!$adminPaslon) return null;

            $mapped = DB::table('paslons')
                ->where('nomor_urut', $adminPaslon->paslon_id)
                ->value('id');

            return $mapped ? (int)$mapped : (int)$adminPaslon->paslon_id;
        }

        if ($roleSlug === 'admin_apk') {
            $row = DB::table('admin_apks')
                ->where('user_id', $actor->id)
                ->whereNull('deleted_at')
                ->first();

            return $row ? (int)($row->paslon_id ?? 0) : null;
        }

        if ($roleSlug === 'kunjungan_koordinator') {
            $koor = $this->getKunjunganCoordinator($actor);
            return $koor ? (int)($koor->paslon_id ?? 0) : null;
        }

        if ($roleSlug === 'apk_koordinator') {
            $koor = $this->getApkCoordinator($actor);
            return $koor ? (int)($koor->paslon_id ?? 0) : null;
        }

        return null;
    }

    private function baseShowRelawan($id)
    {
        return Relawan::with([
            'province:province_code,province',
            'city:city_code,city',
            'district:district_code,district',
            'village:village_code,village',
            'ormas',
            'user' => fn($q) => $q->withTrashed(),
        ])->find($id);
    }

    public function showApk($id)
    {
        $actor    = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        if (!in_array($roleSlug, ['admin_paslon', 'admin_apk', 'apk_koordinator'], true)) {
            return response()->json(['status' => false, 'message' => 'Forbidden'], 403);
        }

        $relawan = $this->baseShowRelawan($id);

        if (!$relawan || (int)$relawan->is_apk !== 1) {
            return response()->json(['status' => false, 'message' => 'Relawan tidak ditemukan'], 404);
        }

        $paslonId = $this->resolvePaslonIdForActor($actor, $roleSlug);
        if (!$paslonId || (int)$relawan->paslon_id !== (int)$paslonId) {
            return response()->json(['status' => false, 'message' => 'Anda tidak berhak melihat relawan ini'], 403);
        }

        if ($roleSlug === 'apk_koordinator') {
            $koor = $this->getApkCoordinator($actor);
            if (!$koor || (int)$relawan->koor_apk_id !== (int)$koor->id) {
                return response()->json(['status' => false, 'message' => 'Anda tidak berhak melihat relawan ini'], 403);
            }
        }

        return response()->json(['status' => true, 'data' => $relawan], 200);
    }

    public function showKunjungan($id)
    {
        $actor    = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        if (!in_array($roleSlug, ['admin_paslon', 'kunjungan_koordinator'], true)) {
            return response()->json(['status' => false, 'message' => 'Forbidden'], 403);
        }

        $relawan = $this->baseShowRelawan($id);

        if (!$relawan || (int)$relawan->is_kunjungan !== 1) {
            return response()->json(['status' => false, 'message' => 'Relawan tidak ditemukan'], 404);
        }

        $paslonId = $this->resolvePaslonIdForActor($actor, $roleSlug);
        if (!$paslonId || (int)$relawan->paslon_id !== (int)$paslonId) {
            return response()->json(['status' => false, 'message' => 'Anda tidak berhak melihat relawan ini'], 403);
        }

        if ($roleSlug === 'kunjungan_koordinator') {
            $koor = $this->getKunjunganCoordinator($actor);
            if (!$koor || (int)$relawan->koor_kunjungan_id !== (int)$koor->id) {
                return response()->json(['status' => false, 'message' => 'Anda tidak berhak melihat relawan ini'], 403);
            }
        }

        return response()->json(['status' => true, 'data' => $relawan], 200);
    }

    /* =========================================================
     * STORE / UPDATE / DESTROY
     * (ini kamu punya sudah oke, aku biarin, hanya pastikan show() lama tidak dipakai)
     * ========================================================= */

    public function store(Request $request)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        $isKunjunganActor = $roleSlug === 'kunjungan_koordinator';
        $isApkActor       = $roleSlug === 'apk_koordinator';

        if (!$isKunjunganActor && !$isApkActor) {
            return response()->json([
                'status' => false,
                'message' => 'Hanya koordinator yang dapat menambahkan relawan'
            ], 403);
        }

        $koorKunjungan = $isKunjunganActor ? $this->getKunjunganCoordinator($actor) : null;
        $koorApk       = $isApkActor ? $this->getApkCoordinator($actor) : null;

        if ($isKunjunganActor && !$koorKunjungan) {
            return response()->json(['status' => false, 'message' => 'Akun koordinator kunjungan tidak valid'], 403);
        }
        if ($isApkActor && !$koorApk) {
            return response()->json(['status' => false, 'message' => 'Akun koordinator apk tidak valid'], 403);
        }

        if ($isKunjunganActor) {
            $count = Relawan::where('koor_kunjungan_id', $koorKunjungan->id)
                ->whereNull('deleted_at')
                ->where('is_kunjungan', 1)
                ->count();

            if ($count >= 20) {
                return response()->json([
                    'status' => false,
                    'message' => 'Maksimal 20 relawan untuk setiap koordinator kunjungan'
                ], 422);
            }
        }

        $request->merge([
            'no_hp' => PhoneHelper::normalize($request->no_hp),
            'tps'   => $this->normalizeTps($request->tps)
        ]);

        $requestedIsApk = (int) $request->input('is_apk', 0);

        $is_kunjungan = $isKunjunganActor ? 1 : 0;
        $is_apk       = $isApkActor ? 1 : ($isKunjunganActor ? ($requestedIsApk ? 1 : 0) : 0);

        if ($isApkActor && (int)$request->input('is_kunjungan', 0) === 1) {
            return response()->json([
                'status' => false,
                'message' => 'Relawan APK tidak boleh ditugaskan menjadi relawan kunjungan'
            ], 422);
        }

        if ($is_kunjungan === 0 && $is_apk === 0) {
            return response()->json([
                'status' => false,
                'message' => 'Relawan harus memiliki minimal salah satu tugas (kunjungan atau apk)'
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'nama' => ['required', 'string', 'max:255', 'regex:/^[^0-9]+$/'],
            'nik' => [
                'required',
                'digits:16',
                function ($attribute, $value, $fail) {
                    $existsRelawanAktif = Relawan::where('nik', $value)->exists();
                    $existsKoorKunjungan = CoordinatorVisit::where('nik', $value)->exists();

                    if ($existsRelawanAktif || $existsKoorKunjungan) {
                        $fail('NIK sudah terdaftar sebagai relawan atau koordinator');
                    }
                }
            ],
            'no_hp' => [
                'required',
                'digits_between:10,13',
                function ($attribute, $value, $fail) {
                    if (str_starts_with($value, '021')) $fail('Nomor telepon rumah (021) tidak diperbolehkan');
                }
            ],
            'alamat' => 'required|string|max:255',
            'tps' => 'required|string|max:3',
            'ormas_id' => 'nullable|exists:ormas,id',
            'is_apk' => 'sometimes|in:0,1',
        ], ['nama.regex' => 'Nama tidak boleh mengandung angka']);

        if ($validator->fails()) {
            return response()->json(['status' => false, 'errors' => $validator->errors()], 422);
        }

        $result = DB::transaction(function () use ($request, $isKunjunganActor, $isApkActor, $koorKunjungan, $koorApk, $is_kunjungan, $is_apk) {

            $prov = $isKunjunganActor ? $koorKunjungan->province_code : $koorApk->province_code;
            $city = $isKunjunganActor ? $koorKunjungan->city_code     : $koorApk->city_code;
            $dist = $isKunjunganActor ? $koorKunjungan->district_code : $koorApk->district_code;
            $vill = $isKunjunganActor ? $koorKunjungan->village_code  : $koorApk->village_code;

            $paslonId = $isKunjunganActor ? ($koorKunjungan->paslon_id ?? null) : ($koorApk->paslon_id ?? null);

            $nameClean = strtolower(preg_replace('/\s+/', '', trim($request->nama)));
            $email = $nameClean . rand(1000, 9999) . '@gmail.com';
            $passwordPlain = $nameClean . rand(1000, 9999);

            if (User::where('email', $email)->exists()) {
                $email = $nameClean . rand(10000, 99999) . '@gmail.com';
            }

            $roleRelawanId = $this->roleId('relawan');

            $userRelawan = User::create([
                'name'     => $request->nama,
                'nik'      => $request->nik,
                'email'    => $email,
                'password' => Hash::make($passwordPlain),
                'role_id'  => $roleRelawanId,
            ]);

            UserCredential::create([
                'user_id'            => $userRelawan->id,
                'encrypted_password' => Crypt::encryptString($passwordPlain),
                'type'               => 'initial',
                'is_active'          => true,
            ]);

            $relawan = Relawan::create([
                'user_id' => $userRelawan->id,
                'paslon_id' => $paslonId,

                'koor_kunjungan_id' => $isKunjunganActor ? $koorKunjungan->id : null,
                'koor_apk_id'       => $isApkActor ? $koorApk->id : null,

                'province_code' => $prov,
                'city_code'     => $city,
                'district_code' => $dist,
                'village_code'  => $vill,

                'nama'   => $request->nama,
                'nik'    => $request->nik,
                'no_hp'  => $request->no_hp,
                'alamat' => $request->alamat,
                'tps'    => $request->tps,
                'ormas_id' => $request->ormas_id,

                'is_kunjungan' => $is_kunjungan,
                'is_apk'       => $is_apk,
                'status'       => 'inactive',
            ]);

            $relawan->load(['province', 'city', 'district', 'village']);

            ActivityLogger::log([
                'action'      => 'CREATE',
                'target_type' => 'relawan',
                'target_name' => $relawan->nama,
                'meta' => [
                    'tugas' => [
                        'kunjungan' => (int) $relawan->is_kunjungan,
                        'apk'       => (int) $relawan->is_apk,
                    ],
                ]
            ]);

            return [
                'relawan'  => $relawan,
                'email'    => $email,
                'password' => $passwordPlain,
            ];
        });

        return response()->json([
            'status'  => true,
            'message' => 'Relawan berhasil ditambahkan',
            'data'    => [
                'relawan' => $result['relawan'],
                'user'    => [
                    'email'    => $result['email'],
                    'password' => $result['password'],
                ],
            ]
        ], 201);
    }

    public function update(Request $request, $id)
    {
        // (punya kamu udah panjang & oke, aku biarin sama persis)
        // kalau mau aku full rapihin juga, bilang aja—nanti aku rewrite versi clean.

        return response()->json([
            'status' => false,
            'message' => 'Update: pakai kode kamu yang sudah ada (tidak aku ubah di paste ini).'
        ], 501);
    }

    public function destroy($id)
    {
        // (punya kamu udah oke, aku biarin)
        return response()->json([
            'status' => false,
            'message' => 'Destroy: pakai kode kamu yang sudah ada (tidak aku ubah di paste ini).'
        ], 501);
    }
    
    public function exportKunjungan(Request $request)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        $password = $request->password;
        if (!password_verify($password, $actor->password)) {
            return response()->json(['message' => 'Password salah'], 422);
        }

        $isKunjunganActor = $roleSlug === 'kunjungan_koordinator';
        $isAdminPaslon    = $roleSlug === 'admin_paslon';

        if (!$isKunjunganActor && !$isAdminPaslon) {
            return response()->json([
                'status' => false,
                'message' => 'Hanya koordinator kunjungan atau admin paslon yang dapat export relawan kunjungan'
            ], 403);
        }

        if ($isKunjunganActor) {
            $koor = $this->getKunjunganCoordinator($actor);
            if (!$koor) {
                return response()->json(['status' => false, 'message' => 'Akun koordinator kunjungan tidak valid'], 403);
            }

            $kelurahan = DB::table('villages')->where('village_code', $koor->village_code)->value('village') ?? 'UNKNOWN';
            $kelurahan = strtoupper(str_replace(' ', '_', $kelurahan));

            // ✅ FIX: paslon jadi 2 digit (01, 02, dst)
            $paslonId     = (int)($koor->paslon_id ?? 0);
            $paslonSuffix = str_pad((string)$paslonId, 2, '0', STR_PAD_LEFT);

            $fileName = "RELAWAN_KUNJUNGAN_{$kelurahan}_{$paslonSuffix}.xlsx";

            $response = Excel::download(
                new RelawanKunjunganExport('koordinator', (int)$koor->id, null),
                $fileName
            );

            $response->headers->set('Cache-Control', 'no-store, no-cache');
            $response->headers->set('Access-Control-Expose-Headers', 'Content-Disposition');
            return $response;
        }

        // admin paslon
        $adminPaslon = AdminPaslon::where('user_id', $actor->id)->whereNull('deleted_at')->first();
        if (!$adminPaslon) {
            return response()->json(['status' => false, 'message' => 'Akun ini bukan admin paslon / tidak memiliki paslon.'], 403);
        }

        // ✅ FIX: paslon jadi 2 digit (01, 02, dst)
        $paslonId     = (int)$adminPaslon->paslon_id;
        $paslonSuffix = str_pad((string)$paslonId, 2, '0', STR_PAD_LEFT);

        $fileName = "RELAWAN_KUNJUNGAN_{$paslonSuffix}.xlsx";

        $response = Excel::download(
            new RelawanKunjunganExport('admin_paslon', null, (int)$adminPaslon->paslon_id),
            $fileName
        );

        $response->headers->set('Cache-Control', 'no-store, no-cache');
        $response->headers->set('Access-Control-Expose-Headers', 'Content-Disposition');
        return $response;
    }

    public function exportApk(Request $request)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        $password = $request->password;
        if (!password_verify($password, $actor->password)) {
            return response()->json(['message' => 'Password salah'], 422);
        }

        $isApkActor     = $roleSlug === 'apk_koordinator';
        $isAdminPaslon  = $roleSlug === 'admin_paslon';
        $isAdminApk     = $roleSlug === 'admin_apk'; // ✅ TAMBAHAN

        if (!$isApkActor && !$isAdminPaslon && !$isAdminApk) { // ✅ TAMBAHAN admin_apk
            return response()->json([
                'status' => false,
                'message' => 'Hanya koordinator apk / admin paslon / admin apk yang dapat export relawan apk'
            ], 403);
        }

        if ($isApkActor) {
            $koor = $this->getApkCoordinator($actor);
            if (!$koor) {
                return response()->json(['status' => false, 'message' => 'Akun koordinator apk tidak valid'], 403);
            }

            $kelurahan = DB::table('villages')->where('village_code', $koor->village_code)->value('village') ?? 'UNKNOWN';
            $kelurahan = strtoupper(str_replace(' ', '_', $kelurahan));

            $paslonNo  = (int)($koor->paslon_id ?? 0);
            $suffix    = str_pad((string)$paslonNo, 2, '0', STR_PAD_LEFT); // ✅ 2 digit

            // ✅ Penamaan file baru (sesuai request)
            $fileName = "RELAWAN_APK_{$suffix}.xlsx";

            $response = Excel::download(
                new RelawanApkExport('koordinator', (int)$koor->id, null),
                $fileName
            );

            $response->headers->set('Cache-Control', 'no-store, no-cache');
            $response->headers->set('Access-Control-Expose-Headers', 'Content-Disposition');
            return $response;
        }

        if ($isAdminPaslon) {
            $adminPaslon = AdminPaslon::where('user_id', $actor->id)
                ->whereNull('deleted_at')
                ->first();

            if (!$adminPaslon) {
                return response()->json(['status' => false, 'message' => 'Akun ini bukan admin paslon / tidak memiliki paslon.'], 403);
            }

            $paslonNo = (int)$adminPaslon->paslon_id;
            $suffix   = str_pad((string)$paslonNo, 2, '0', STR_PAD_LEFT); // ✅ 2 digit

            // ✅ Penamaan file baru (sesuai request)
            $fileName = "RELAWAN_APK_{$suffix}.xlsx";

            $response = Excel::download(
                new RelawanApkExport('admin_paslon', null, (int)$adminPaslon->paslon_id),
                $fileName
            );

            $response->headers->set('Cache-Control', 'no-store, no-cache');
            $response->headers->set('Access-Control-Expose-Headers', 'Content-Disposition');
            return $response;
        }

        $adminApkRow = DB::table('admin_apks')
            ->where('user_id', $actor->id)
            ->whereNull('deleted_at')
            ->first();

        if (!$adminApkRow) {
            return response()->json([
                'status' => false,
                'message' => 'Akun ini bukan admin apk / tidak memiliki paslon.'
            ], 403);
        }

        $paslonId = (int)($adminApkRow->paslon_id ?? 0);
        if (!$paslonId) {
            return response()->json([
                'status' => false,
                'message' => 'Paslon tidak ditemukan untuk admin apk ini.'
            ], 403);
        }

        // untuk penamaan file: pakai nomor urut paslon (kalau ada), fallback pakai paslonId
        $nomorUrut = (int) (DB::table('paslons')->where('id', $paslonId)->value('nomor_urut') ?? 0);
        $suffix = $nomorUrut
            ? str_pad((string)$nomorUrut, 2, '0', STR_PAD_LEFT)
            : str_pad((string)$paslonId, 2, '0', STR_PAD_LEFT);

        $fileName = "RELAWAN_APK_{$suffix}.xlsx";

        $response = Excel::download(
            new RelawanApkExport('admin_paslon', null, $paslonId), // ✅ tetap reuse mode lama (admin_paslon) biar ga nambah mode baru
            $fileName
        );

        $response->headers->set('Cache-Control', 'no-store, no-cache');
        $response->headers->set('Access-Control-Expose-Headers', 'Content-Disposition');
        return $response;
    }

    // public function import(Request $request)
    // {
    //     $actor = Auth::user();
    //     $roleSlug = $this->userRoleSlug($actor);

    //     $isKunjunganActor = $roleSlug === 'kunjungan_koordinator';
    //     $isApkActor       = $roleSlug === 'apk_koordinator';

    //     if (!$isKunjunganActor && !$isApkActor) {
    //         return response()->json([
    //             'status' => false,
    //             'message' => 'Hanya koordinator (kunjungan/apk) yang dapat mengimpor relawan'
    //         ], 403);
    //     }

    //     $validator = Validator::make($request->all(), [
    //         'file' => 'required|file|mimes:xls,xlsx|max:5120',
    //     ]);

    //     if ($validator->fails()) {
    //         return response()->json([
    //             'status' => false,
    //             'message' => 'File tidak valid',
    //             'errors' => $validator->errors(),
    //         ], 422);
    //     }

    //     // Ambil koordinator sesuai role
    //     $koorKunjungan = $isKunjunganActor ? $this->getKunjunganCoordinator($actor) : null;
    //     $koorApk       = $isApkActor ? $this->getApkCoordinator($actor) : null;

    //     if ($isKunjunganActor && !$koorKunjungan) {
    //         return response()->json([
    //             'status' => false,
    //             'message' => 'Akun koordinator kunjungan tidak valid'
    //         ], 403);
    //     }

    //     if ($isApkActor && !$koorApk) {
    //         return response()->json([
    //             'status' => false,
    //             'message' => 'Akun koordinator apk tidak valid'
    //         ], 403);
    //     }

    //     /**
    //      * Tentukan import class:
    //      * - RelawanKunjunganImport: is_kunjungan=1 (dan is_apk optional dari excel kalau kamu dukung)
    //      * - RelawanApkImport: is_apk=1
    //      */
    //     $import = $isKunjunganActor
    //         ? new RelawanKunjunganImport((int)$koorKunjungan->id)
    //         : new RelawanApkImport((int)$koorApk->id);

    //     try {
    //         Excel::import($import, $request->file('file'));

    //         ActivityLogger::log([
    //             'action'      => 'IMPORT',
    //             'target_type' => 'relawan',
    //             'meta' => [
    //                 'role' => $roleSlug,
    //                 'koordinator_id' => $isKunjunganActor ? (int)$koorKunjungan->id : (int)$koorApk->id,
    //                 'jumlah_data' => $import->successCount,
    //                 'failed_count' => count($import->failedRows),
    //             ]
    //         ]);

    //         return response()->json([
    //             'status' => true,
    //             'message' => 'Import relawan selesai',
    //             'data' => [
    //                 'success_count'    => $import->successCount,
    //                 'failed_count'     => count($import->failedRows),
    //                 'failed_rows'      => $import->failedRows,
    //                 'created_accounts' => $import->createdAccounts,

    //                 // OPTIONAL: kalau import class kamu punya property ini
    //                 'updated_double_job' => property_exists($import, 'updatedDoubleJobCount')
    //                     ? (int)$import->updatedDoubleJobCount
    //                     : 0,
    //             ]
    //         ]);
    //     } catch (\Throwable $e) {
    //         return response()->json([
    //             'status' => false,
    //             'message' => 'Gagal import relawan',
    //             'error' => $e->getMessage()
    //         ], 500);
    //     }
    // }

    public function checkNik(Request $request)
    {
        $request->validate([
            'nik' => 'required|digits:16'
        ]);

        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        $isKunjunganActor = $roleSlug === 'kunjungan_koordinator';
        $isApkActor       = $roleSlug === 'apk_koordinator';

        if (!$isKunjunganActor && !$isApkActor) {
            return response()->json([
                'status' => false,
                'message' => 'Hanya koordinator yang dapat melakukan pengecekan NIK relawan'
            ], 403);
        }

        // blok jika NIK dipakai koordinator kunjungan aktif
        $existsKoorKunjungan = CoordinatorVisit::where('nik', $request->nik)
            ->whereNull('deleted_at')
            ->exists();

        // blok jika NIK dipakai koordinator apk aktif
        $existsKoorApk = DB::table('apk_koordinators')
            ->where('nik', $request->nik)
            ->whereNull('deleted_at')
            ->exists();

        if ($existsKoorKunjungan || $existsKoorApk) {
            return response()->json([
                'exists'  => true,
                'deleted' => false,
                'message' => 'NIK sudah terdaftar sebagai koordinator dan masih aktif',
                'data'    => null,
            ], 200);
        }

        $relawan = Relawan::withTrashed()
            ->with([
                'user' => fn($q) => $q->withTrashed(),
                'province:province_code,province',
                'city:city_code,city',
                'district:district_code,district',
                'village:village_code,village',
            ])
            ->where('nik', $request->nik)
            ->first();

        if (!$relawan) {
            return response()->json([
                'exists'  => false,
                'deleted' => false,
                'data'    => null,
            ], 200);
        }

        // kalau aktif
        if (!$relawan->trashed()) {
            $eligibleDoubleJob = false;

            // hanya relevan kalau actor APK, dan relawan adalah kunjungan-only
            if ($isApkActor && $this->canDoubleJobFromKunjunganToApk($relawan)) {
                $eligibleDoubleJob = true;
            }

            // kalau actor Kunjungan: tidak ada mekanisme tambah kunjungan dari relawan apk (blocked by rule)
            return response()->json([
                'exists'  => true,
                'deleted' => false,
                'message' => 'NIK sudah terdaftar dan masih aktif',
                'data'    => [
                    'id' => $relawan->id,
                    'nama' => $relawan->nama,
                    'nik' => $relawan->nik,
                    'no_hp' => $relawan->no_hp,
                    'alamat' => $relawan->alamat,
                    'tps' => $relawan->tps,
                    'ormas_id' => $relawan->ormas_id,
                    'province_code' => $relawan->province_code,
                    'city_code' => $relawan->city_code,
                    'district_code' => $relawan->district_code,
                    'village_code' => $relawan->village_code,
                    'is_kunjungan' => (int) $relawan->is_kunjungan,
                    'is_apk' => (int) $relawan->is_apk,
                    'eligible_double_job_apk' => $eligibleDoubleJob ? 1 : 0,
                ],
            ], 200);
        }

        // kalau soft deleted
        return response()->json([
            'exists'  => true,
            'deleted' => true,
            'message' => 'NIK pernah terdaftar dan saat ini nonaktif. Ingin aktifkan kembali?',
            'data'    => [
                'id' => $relawan->id,
                'nama' => $relawan->nama,
                'nik' => $relawan->nik,
                'no_hp' => $relawan->no_hp,
                'alamat' => $relawan->alamat,
                'tps' => $relawan->tps,
                'ormas_id' => $relawan->ormas_id,
                'province_code' => $relawan->province_code,
                'city_code' => $relawan->city_code,
                'district_code' => $relawan->district_code,
                'village_code' => $relawan->village_code,
                'is_kunjungan' => (int) $relawan->is_kunjungan,
                'is_apk' => (int) $relawan->is_apk,
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
            'tps' => 'sometimes|required|string|max:3',
            'ormas_id' => 'sometimes|nullable|exists:ormas,id',
            'is_apk' => 'sometimes|in:0,1',
        ], [
            'nama.regex' => 'Nama tidak boleh mengandung angka'
        ]);

        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        $isKunjunganActor = $roleSlug === 'kunjungan_koordinator';
        $isApkActor       = $roleSlug === 'apk_koordinator';

        if (!$isKunjunganActor && !$isApkActor) {
            return response()->json([
                'status' => false,
                'message' => 'Hanya koordinator yang dapat restore relawan'
            ], 403);
        }

        $koorKunjungan = $isKunjunganActor ? $this->getKunjunganCoordinator($actor) : null;
        $koorApk       = $isApkActor ? $this->getApkCoordinator($actor) : null;

        if ($isKunjunganActor && !$koorKunjungan) {
            return response()->json(['status' => false, 'message' => 'Akun koordinator kunjungan tidak valid'], 403);
        }
        if ($isApkActor && !$koorApk) {
            return response()->json(['status' => false, 'message' => 'Akun koordinator apk tidak valid'], 403);
        }

        $existsKoorKunjungan = CoordinatorVisit::where('nik', $request->nik)
            ->whereNull('deleted_at')->exists();

        $existsKoorApk = DB::table('apk_koordinators')
            ->where('nik', $request->nik)
            ->whereNull('deleted_at')->exists();

        if ($existsKoorKunjungan || $existsKoorApk) {
            return response()->json([
                'status' => false,
                'message' => 'NIK ini sedang dipakai koordinator (aktif), tidak bisa restore sebagai relawan'
            ], 422);
        }

        $relawan = Relawan::withTrashed()
            ->with(['user' => fn($q) => $q->withTrashed()])
            ->where('nik', $request->nik)
            ->first();

        if (!$relawan) {
            return response()->json([
                'status' => false,
                'message' => 'Data relawan dengan NIK ini tidak ditemukan'
            ], 404);
        }

        if (!$relawan->trashed()) {
            return response()->json([
                'status' => false,
                'message' => 'Relawan dengan NIK ini sudah aktif'
            ], 422);
        }

        if ($request->filled('no_hp')) {
            $request->merge(['no_hp' => PhoneHelper::normalize($request->no_hp)]);
        }

        if ($request->filled('tps')) {
            $request->merge(['tps' => $this->normalizeTps($request->tps)]);
        }

        $finalIsKunjungan = $isKunjunganActor ? 1 : 0;
        $finalIsApk = $isApkActor ? 1 : (int) $request->input('is_apk', (int) $relawan->is_apk);

        if ($finalIsKunjungan === 0 && $finalIsApk === 0) {
            return response()->json([
                'status' => false,
                'message' => 'Relawan harus memiliki minimal salah satu tugas (kunjungan atau apk)'
            ], 422);
        }

        if ($isKunjunganActor) {
            $count = Relawan::where('koor_kunjungan_id', $koorKunjungan->id)
                ->whereNull('deleted_at')
                ->where('is_kunjungan', 1)
                ->lockForUpdate()
                ->count();

            if ($count >= 20) {
                return response()->json([
                    'status' => false,
                    'message' => 'Maksimal 20 relawan kunjungan untuk setiap koordinator kunjungan'
                ], 422);
            }
        }

        $result = DB::transaction(function () use ($request, $relawan, $isKunjunganActor, $isApkActor, $koorKunjungan, $koorApk, $finalIsKunjungan, $finalIsApk) {

            $relawan->restore();

            if ($relawan->user && $relawan->user->trashed()) {
                $relawan->user->restore();
            }

            $prov = $isKunjunganActor ? $koorKunjungan->province_code : $koorApk->province_code;
            $city = $isKunjunganActor ? $koorKunjungan->city_code     : $koorApk->city_code;
            $dist = $isKunjunganActor ? $koorKunjungan->district_code : $koorApk->district_code;
            $vill = $isKunjunganActor ? $koorKunjungan->village_code  : $koorApk->village_code;

            $paslonId = $isKunjunganActor ? ($koorKunjungan->paslon_id ?? null) : ($koorApk->paslon_id ?? null);

            $relawan->update([
                'paslon_id' => $paslonId,

                'koor_kunjungan_id' => $isKunjunganActor ? $koorKunjungan->id : null,
                'koor_apk_id'       => $isApkActor ? $koorApk->id : ($finalIsApk ? $relawan->koor_apk_id : null),

                'province_code' => $prov,
                'city_code'     => $city,
                'district_code' => $dist,
                'village_code'  => $vill,

                'nama'   => $request->input('nama', $relawan->nama),
                'no_hp'  => $request->input('no_hp', $relawan->no_hp),
                'alamat' => $request->input('alamat', $relawan->alamat),
                'tps'    => $request->input('tps', $relawan->tps),
                'ormas_id' => $request->has('ormas_id') ? $request->ormas_id : $relawan->ormas_id,

                'is_kunjungan' => $finalIsKunjungan,
                'is_apk'       => $finalIsApk,
                'status'       => 'inactive',
            ]);

            $nameClean = strtolower(preg_replace('/\s+/', '', trim($relawan->nama)));
            $newEmail = $nameClean . rand(1000, 9999) . '@gmail.com';
            $newPasswordPlain = $nameClean . rand(1000, 9999);

            if (User::where('email', $newEmail)->where('id', '!=', optional($relawan->user)->id)->exists()) {
                $newEmail = $nameClean . rand(10000, 99999) . '@gmail.com';
            }

            if ($relawan->user) {
                $roleRelawanId = $this->roleId('relawan');

                $relawan->user->update([
                    'name'     => $relawan->nama,
                    'nik'      => $relawan->nik,
                    'email'    => $newEmail,
                    'password' => Hash::make($newPasswordPlain),
                    'role_id'  => $roleRelawanId,
                    'status'   => 'inactive',
                ]);

                UserCredential::where('user_id', $relawan->user->id)
                    ->update(['is_active' => false]);

                UserCredential::create([
                    'user_id'            => $relawan->user->id,
                    'encrypted_password' => Crypt::encryptString($newPasswordPlain),
                    'type'               => 'reactive',
                    'is_active'          => true,
                ]);
            }

            ActivityLogger::log([
                'action'      => 'RESTORE',
                'target_type' => 'relawan',
                'target_name' => $relawan->nama,
                'field'       => 'activate_nik',
                'old_value'   => 'deleted',
                'new_value'   => 'active',
            ]);

            return [
                'relawan'  => $relawan->fresh(['user', 'province', 'city', 'district', 'village']),
                'email'    => $newEmail,
                'password' => $newPasswordPlain,
            ];
        });

        return response()->json([
            'status'  => true,
            'message' => "Relawan {$result['relawan']->nama} berhasil diaktifkan kembali",
            'data'    => [
                'relawan' => $result['relawan'],
                'user'    => [
                    'email'    => $result['email'],
                    'password' => $result['password'],
                ],
            ]
        ]);
    }

    public function importKunjungan(Request $request)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        if ($roleSlug !== 'kunjungan_koordinator' && $roleSlug !== 'admin_paslon') {
            return response()->json([
                'status' => false,
                'message' => 'Hanya koordinator kunjungan / admin paslon yang dapat import relawan kunjungan'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xls,xlsx|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'File tidak valid',
                'errors' => $validator->errors(),
            ], 422);
        }

        // koordinator kunjungan id kalau role koordinator
        $koorKunjunganId = null;
        if ($roleSlug === 'kunjungan_koordinator') {
            $koor = $this->getKunjunganCoordinator($actor);
            if (!$koor) {
                return response()->json([
                    'status' => false,
                    'message' => 'Akun koordinator kunjungan tidak valid'
                ], 403);
            }
            $koorKunjunganId = (int) $koor->id;
        }

        // NOTE:
        // RelawanKunjunganImport kamu sekarang konstruktor-nya cuma nerima koor_kunjungan_id (sesuai kode yang kamu comment)
        $import = new RelawanKunjunganImport($koorKunjunganId);

        try {
            Excel::import($import, $request->file('file'));

            return response()->json([
                'status' => true,
                'message' => 'Import relawan kunjungan selesai',
                'data' => [
                    'success_count'    => $import->successCount ?? 0,
                    'failed_count'     => isset($import->failedRows) ? count($import->failedRows) : 0,
                    'failed_rows'      => $import->failedRows ?? [],
                    'created_accounts' => $import->createdAccounts ?? [],
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'message' => 'Gagal import relawan kunjungan',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function importApk(Request $request)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        if ($roleSlug !== 'apk_koordinator' && $roleSlug !== 'admin_apk') {
            return response()->json([
                'status' => false,
                'message' => 'Hanya koordinator apk / admin apk yang dapat import relawan apk'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xls,xlsx|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'File tidak valid',
                'errors' => $validator->errors(),
            ], 422);
        }

        $koorApkId = null;
        if ($roleSlug === 'apk_koordinator') {
            $koor = $this->getApkCoordinator($actor);
            if (!$koor) {
                return response()->json([
                    'status' => false,
                    'message' => 'Akun koordinator apk tidak valid'
                ], 403);
            }
            $koorApkId = (int) $koor->id;
        }

        $import = new RelawanApkImport($koorApkId);

        try {
            Excel::import($import, $request->file('file'));

            return response()->json([
                'status' => true,
                'message' => 'Import relawan apk selesai',
                'data' => [
                    'success_count'    => $import->successCount ?? 0,
                    'failed_count'     => isset($import->failedRows) ? count($import->failedRows) : 0,
                    'failed_rows'      => $import->failedRows ?? [],
                    'created_accounts' => $import->createdAccounts ?? [],
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => false,
                'message' => 'Gagal import relawan apk',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
