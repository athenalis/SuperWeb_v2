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
    private function userRoleSlug($user): ?string
    {
        if (!empty($user->role_id)) {
            $slug = DB::table('roles')->where('id', $user->role_id)->value('role');
            if (!empty($slug)) return $slug;
        }

        return !empty($user->role) ? $user->role : null;
    }

    private function currentPaslonIdForActor($actor, string $roleSlug): int
    {
        if ($roleSlug === 'kunjungan_koordinator') {
            $koor = $this->getKunjunganCoordinator($actor);
            if (!$koor || !(int)($koor->paslon_id ?? 0)) {
                abort(response()->json([
                    'status'  => false,
                    'message' => 'Akun koordinator kunjungan tidak valid / tidak punya paslon.',
                ], 403));
            }
            return (int) $koor->paslon_id;
        }

        if ($roleSlug === 'apk_koordinator') {
            $koor = $this->getApkCoordinator($actor);
            if (!$koor || !(int)($koor->paslon_id ?? 0)) {
                abort(response()->json([
                    'status'  => false,
                    'message' => 'Akun koordinator apk tidak valid / tidak punya paslon.',
                ], 403));
            }
            return (int) $koor->paslon_id;
        }

        abort(response()->json([
            'status'  => false,
            'message' => 'Forbidden',
        ], 403));
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
        return ((int)$relawan->is_kunjungan === 1) && ((int)$relawan->is_apk === 0);
    }

    public function doubleJobToApkFromKunjungan(Request $request, $id)
    {
        $actor    = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        if ($roleSlug !== 'kunjungan_koordinator') {
            return response()->json([
                'status'  => false,
                'message' => 'Forbidden',
            ], 403);
        }

        $koorKunjungan = $this->getKunjunganCoordinator($actor);
        if (!$koorKunjungan) {
            return response()->json([
                'status'  => false,
                'message' => 'Akun koordinator kunjungan tidak valid',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'koor_apk_id' => ['required', 'integer'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => false,
                'message' => 'Validasi gagal',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $relawan = Relawan::where('id', (int)$id)->whereNull('deleted_at')->first();
        if (!$relawan) {
            return response()->json([
                'status'  => false,
                'message' => 'Relawan tidak ditemukan',
            ], 404);
        }

        if ((int)$relawan->koor_kunjungan_id !== (int)$koorKunjungan->id) {
            return response()->json([
                'status'  => false,
                'message' => 'Anda tidak berhak mengubah relawan ini',
            ], 403);
        }

        if ((int)$relawan->is_apk === 1) {
            return response()->json([
                'status'  => false,
                'message' => 'Relawan sudah double job / sudah menjadi Relawan APK',
                'eligible' => false,
                'already_double_job' => true,
                'data'    => [
                    'relawan' => $relawan,
                ],
            ], 422);
        }

        if (!$this->canDoubleJobFromKunjunganToApk($relawan)) {
            return response()->json([
                'status'  => false,
                'message' => 'Relawan tidak eligible untuk double job. Hanya boleh dari Kunjungan (aktif) ke APK (belum).',
                'eligible' => false,
                'already_double_job' => false,
                'data'    => [
                    'relawan' => $relawan,
                ],
            ], 422);
        }

        $koorApk = DB::table('apk_koordinators')
            ->where('id', (int)$request->koor_apk_id)
            ->whereNull('deleted_at')
            ->first();

        if (!$koorApk) {
            return response()->json([
                'status'  => false,
                'message' => 'Koordinator APK tujuan tidak ditemukan / tidak aktif',
                'eligible' => true,
                'already_double_job' => false,
            ], 422);
        }

        if ((int)$koorApk->paslon_id !== (int)$relawan->paslon_id) {
            return response()->json([
                'status'  => false,
                'message' => 'Koordinator APK tujuan tidak satu paslon dengan relawan',
                'eligible' => true,
                'already_double_job' => false,
            ], 422);
        }

        if (
            (string)$koorApk->province_code !== (string)$relawan->province_code ||
            (string)$koorApk->city_code     !== (string)$relawan->city_code ||
            (string)$koorApk->district_code !== (string)$relawan->district_code ||
            (string)$koorApk->village_code  !== (string)$relawan->village_code
        ) {
            return response()->json([
                'status'  => false,
                'message' => 'Koordinator APK tujuan tidak satu wilayah dengan relawan',
                'eligible' => true,
                'already_double_job' => false,
            ], 422);
        }

        $updated = DB::transaction(function () use ($relawan, $koorApk) {
            $relawan->update([
                'is_apk'      => 1,
                'koor_apk_id' => (int)$koorApk->id,
            ]);

            ActivityLogger::log([
                'action'      => 'UPDATE',
                'target_type' => 'relawan',
                'target_name' => $relawan->nama,
                'field'       => 'double_job',
                'old_value'   => 'kunjungan_only',
                'new_value'   => 'kunjungan+apk',
                'meta'        => [
                    'koor_apk_id' => (int)$koorApk->id,
                ],
            ]);

            return $relawan->fresh();
        });

        return response()->json([
            'status'  => true,
            'message' => 'Relawan berhasil dijadikan double job (Kunjungan + APK)',
            'eligible' => false,
            'already_double_job' => true,
            'data'    => [
                'relawan' => $updated,
            ],
        ], 200);
    }

    public function eligibleApkKoordinatorsForRelawan(Request $request, $id)
    {
        $actor    = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        if ($roleSlug !== 'kunjungan_koordinator') {
            return response()->json([
                'status'  => false,
                'message' => 'Forbidden',
            ], 403);
        }

        $koorKunjungan = $this->getKunjunganCoordinator($actor);
        if (!$koorKunjungan) {
            return response()->json([
                'status'  => false,
                'message' => 'Akun koordinator kunjungan tidak valid',
            ], 403);
        }

        $relawan = Relawan::where('id', (int)$id)
            ->whereNull('deleted_at')
            ->first();

        if (!$relawan) {
            return response()->json([
                'status'  => false,
                'message' => 'Relawan tidak ditemukan',
            ], 404);
        }

        if ((int)$relawan->koor_kunjungan_id !== (int)$koorKunjungan->id) {
            return response()->json([
                'status'  => false,
                'message' => 'Anda tidak berhak melihat relawan ini',
            ], 403);
        }

        $meta = [
            'relawan_id' => (int)$relawan->id,
            'paslon_id'  => (int)$relawan->paslon_id,
            'wilayah'    => [
                'province_code' => (string)$relawan->province_code,
                'city_code'     => (string)$relawan->city_code,
                'district_code' => (string)$relawan->district_code,
                'village_code'  => (string)$relawan->village_code,
            ],
            'flags' => [
                'is_kunjungan' => (int)$relawan->is_kunjungan,
                'is_apk'       => (int)$relawan->is_apk,
                'koor_apk_id'  => $relawan->koor_apk_id ? (int)$relawan->koor_apk_id : null,
            ],
        ];

        if ((int)$relawan->is_apk === 1) {
            return response()->json([
                'status'  => true,
                'message' => 'Relawan sudah double job / sudah menjadi Relawan APK',
                'eligible' => false,
                'already_double_job' => true,
                'has_koor_options' => false,
                'data'    => [],
                'meta'    => $meta,
            ], 200);
        }

        if (!$this->canDoubleJobFromKunjunganToApk($relawan)) {
            return response()->json([
                'status'  => true,
                'message' => 'Relawan tidak eligible untuk double job. Hanya boleh dari Kunjungan (aktif) ke APK (belum).',
                'eligible' => false,
                'already_double_job' => false,
                'has_koor_options' => false,
                'data'    => [],
                'meta'    => $meta,
            ], 200);
        }

        $koors = DB::table('apk_koordinators')
            ->select([
                'id',
                'user_id',
                'nama',
                'nik',
                'no_hp',
                'paslon_id',
                'province_code',
                'city_code',
                'district_code',
                'village_code',
            ])
            ->whereNull('deleted_at')
            ->where('paslon_id', (int)$relawan->paslon_id)
            ->where('province_code', (string)$relawan->province_code)
            ->where('city_code', (string)$relawan->city_code)
            ->where('district_code', (string)$relawan->district_code)
            ->where('village_code', (string)$relawan->village_code)
            ->orderByDesc('id')
            ->get();

        if ($koors->isEmpty()) {
            return response()->json([
                'status'  => true,
                'message' => 'Tidak ada koordinator APK yang 1 wilayah tersedia.',
                'eligible' => true,
                'already_double_job' => false,
                'has_koor_options' => false,
                'data'    => [],
                'meta'    => $meta,
            ], 200);
        }

        return response()->json([
            'status'  => true,
            'message' => 'Relawan eligible untuk dijadikan double job (Kunjungan + APK)',
            'eligible' => true,
            'already_double_job' => false,
            'has_koor_options' => true,
            'data'    => $koors,
            'meta'    => $meta,
        ], 200);
    }

    private function baseQueryRelawan()
    {
        $q = Relawan::query()
            ->with([
                'province:province_code,province',
                'city:city_code,city',
                'district:district_code,district',
                'village:village_code,village',
            ]);

        if (method_exists(Relawan::class, 'visitForms')) {
            $q->withCount('visitForms');
        }

        return $q;
    }

    private function applySearchAndFilters(Request $request, $query)
    {
        if ($request->filled('search')) $searchValue = $request->search;
        if ($request->filled('keyword')) $searchValue = $request->keyword;

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

        $koor = null; 

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
            $query->where('koor_apk_id', (int) $koor->id);
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

        if ($request->filled('per_page')) {
            $perPage = max(1, (int) $request->per_page);
            $data = $query->orderByDesc('id')->paginate($perPage);

            $data->getCollection()->each(function ($item) {
                $item->makeHidden(['tps']);
            });
        } else {
            $data = $query->orderByDesc('id')->get();

            $data->each(function ($item) {
                $item->makeHidden(['tps']);
            });
        }

        return response()->json([
            'status' => true,
            'data'   => $data
        ]);
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

            $paslonId = $paslonDbId ? (int)$paslonDbId : $paslonNoUrut;

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
            $query->where('paslon_id', $paslonId); 
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

        $relawan = Relawan::with([
            'province:province_code,province',
            'city:city_code,city',
            'district:district_code,district',
            'village:village_code,village',
            'ormas',
            'user' => fn($q) => $q->withTrashed(),

            'koordinatorApk' => fn($q) => $q->with(['user' => fn($qq) => $qq->withTrashed()]),
        ])->find($id);

        if (!$relawan || (int) $relawan->is_apk !== 1) {
            return response()->json(['status' => false, 'message' => 'Relawan tidak ditemukan'], 404);
        }

        $paslonId = $this->resolvePaslonIdForActor($actor, $roleSlug);
        if (!$paslonId || (int) $relawan->paslon_id !== (int) $paslonId) {
            return response()->json(['status' => false, 'message' => 'Anda tidak berhak melihat relawan ini'], 403);
        }

        if ($roleSlug === 'apk_koordinator') {
            $koor = $this->getApkCoordinator($actor);
            if (!$koor || (int) $relawan->koor_apk_id !== (int) $koor->id) {
                return response()->json(['status' => false, 'message' => 'Anda tidak berhak melihat relawan ini'], 403);
            }
        }

        $relawan->makeHidden(['tps']);

        $koorName = $relawan->koordinatorApk?->user?->name;

        return response()->json([
            'status' => true,
            'data'   => $relawan,
            'koor'   => [
                'type' => 'apk',
                'id'   => $relawan->koor_apk_id,
                'name' => $koorName,
            ],
        ], 200);
    }

    public function showKunjungan($id)
    {
        $actor    = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        if (!in_array($roleSlug, ['admin_paslon', 'kunjungan_koordinator'], true)) {
            return response()->json(['status' => false, 'message' => 'Forbidden'], 403);
        }

        $relawan = Relawan::with([
            'province:province_code,province',
            'city:city_code,city',
            'district:district_code,district',
            'village:village_code,village',
            'ormas',
            'user' => fn($q) => $q->withTrashed(),

            'koordinatorKunjungan' => fn($q) => $q->with(['user' => fn($qq) => $qq->withTrashed()]),
        ])->find($id);

        if (!$relawan || (int) $relawan->is_kunjungan !== 1) {
            return response()->json(['status' => false, 'message' => 'Relawan tidak ditemukan'], 404);
        }

        $paslonId = $this->resolvePaslonIdForActor($actor, $roleSlug);
        if (!$paslonId || (int) $relawan->paslon_id !== (int) $paslonId) {
            return response()->json(['status' => false, 'message' => 'Anda tidak berhak melihat relawan ini'], 403);
        }

        if ($roleSlug === 'kunjungan_koordinator') {
            $koor = $this->getKunjunganCoordinator($actor);
            if (!$koor || (int) $relawan->koor_kunjungan_id !== (int) $koor->id) {
                return response()->json(['status' => false, 'message' => 'Anda tidak berhak melihat relawan ini'], 403);
            }
        }

        $koorName = $relawan->koordinatorKunjungan?->user?->name;

        return response()->json([
            'status' => true,
            'data'   => $relawan,
            'koor'   => [
                'type' => 'kunjungan',
                'id'   => $relawan->koor_kunjungan_id,
                'name' => $koorName,
            ],
        ], 200);
    }

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
            'tps'   => $isKunjunganActor ? $this->normalizeTps($request->tps) : null,
        ]);

        $requestedIsApk = (int) $request->input('is_apk', 0);

        $is_kunjungan = $isKunjunganActor ? 1 : 0;
        $is_apk       = $isApkActor ? 1 : ($isKunjunganActor ? ($requestedIsApk ? 1 : 0) : 0);

        if ($isApkActor && (int) $request->input('is_kunjungan', 0) === 1) {
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
                    $existsRelawanAktif   = Relawan::where('nik', $value)->exists();
                    $existsKoorKunjungan  = CoordinatorVisit::where('nik', $value)->exists();

                    $existsKoorApk = DB::table('apk_koordinators')
                        ->where('nik', $value)
                        ->whereNull('deleted_at')
                        ->exists();

                    if ($existsRelawanAktif || $existsKoorKunjungan || $existsKoorApk) {
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

            'tps' => $isKunjunganActor ? 'required|string|max:3' : 'nullable|string|max:3',

            'ormas_id' => 'nullable|exists:ormas,id',
            'is_apk' => 'sometimes|in:0,1',
        ], ['nama.regex' => 'Nama tidak boleh mengandung angka']);

        if ($validator->fails()) {
            return response()->json(['status' => false, 'errors' => $validator->errors()], 422);
        }

        $result = DB::transaction(function () use (
            $request,
            $isKunjunganActor,
            $isApkActor,
            $koorKunjungan,
            $koorApk,
            $is_kunjungan,
            $is_apk
        ) {

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

                'tps'    => $isKunjunganActor ? $request->tps : null,

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
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        $isKunjunganActor = $roleSlug === 'kunjungan_koordinator';
        $isApkActor       = $roleSlug === 'apk_koordinator';

        if (!$isKunjunganActor && !$isApkActor) {
            return response()->json(['status' => false, 'message' => 'Hanya koordinator yang dapat mengubah relawan'], 403);
        }

        $relawan = Relawan::with(['user'])->find($id);
        if (!$relawan) {
            return response()->json(['status' => false, 'message' => 'Relawan tidak ditemukan'], 404);
        }

        if ($isKunjunganActor) {
            $koor = $this->getKunjunganCoordinator($actor);
            if (!$koor || (int)$relawan->koor_kunjungan_id !== (int)$koor->id) {
                return response()->json(['status' => false, 'message' => 'Anda tidak berhak mengubah relawan ini'], 403);
            }
        }

        if ($isApkActor) {
            $koor = $this->getApkCoordinator($actor);
            if (!$koor || (int)$relawan->koor_apk_id !== (int)$koor->id) {
                return response()->json(['status' => false, 'message' => 'Anda tidak berhak mengubah relawan ini'], 403);
            }
        }

        $request->merge([
            'no_hp' => PhoneHelper::normalize($request->no_hp),
            'tps'   => $isKunjunganActor ? $this->normalizeTps($request->tps) : null,
        ]);

        $validator = Validator::make($request->all(), [
            'nama' => ['required', 'string', 'max:255', 'regex:/^[^0-9]+$/'],
            'nik'  => [
                'required',
                'digits:16',
                function ($attribute, $value, $fail) use ($relawan) {
                    $existsRelawan = Relawan::where('nik', $value)->where('id', '!=', $relawan->id)->exists();
                    $existsKoorKunjungan = CoordinatorVisit::where('nik', $value)->exists();
                    $existsKoorApk = DB::table('apk_koordinators')
                        ->where('nik', $value)
                        ->whereNull('deleted_at')
                        ->exists();

                    if ($existsRelawan || $existsKoorKunjungan || $existsKoorApk) {
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

            'tps' => $isKunjunganActor ? 'required|string|max:3' : 'nullable|string|max:3',

            'ormas_id' => 'nullable|exists:ormas,id',
            'is_apk' => 'sometimes|in:0,1',
        ], ['nama.regex' => 'Nama tidak boleh mengandung angka']);

        if ($validator->fails()) {
            return response()->json(['status' => false, 'errors' => $validator->errors()], 422);
        }

        $result = DB::transaction(function () use ($request, $relawan, $actor, $isKunjunganActor, $isApkActor) {

            $oldData = $relawan->only(['nama', 'nik', 'no_hp', 'alamat', 'tps', 'ormas_id', 'is_kunjungan', 'is_apk']);

            $newIsKunjungan = $isKunjunganActor ? 1 : 0;

            $newIsApk = $isApkActor ? 1 : (int)$request->input('is_apk', (int)$relawan->is_apk);

            if ($isApkActor && $newIsKunjungan === 1) {
                return ['blocked' => true, 'message' => 'Relawan APK tidak boleh ditugaskan menjadi relawan kunjungan'];
            }

            if ($newIsKunjungan === 0 && $newIsApk === 0) {
                return ['blocked' => true, 'message' => 'Relawan harus memiliki minimal salah satu tugas (kunjungan atau apk)'];
            }

            if ($isKunjunganActor) {
                $koor = $this->getKunjunganCoordinator($actor);
                $prov = $koor->province_code;
                $city = $koor->city_code;
                $dist = $koor->district_code;
                $vill = $koor->village_code;
            } else {
                $koor = $this->getApkCoordinator($actor);
                $prov = $koor->province_code;
                $city = $koor->city_code;
                $dist = $koor->district_code;
                $vill = $koor->village_code;
            }

            $nameChanged = ($oldData['nama'] ?? null) !== $request->nama;

            $relawan->update([
                'nama'   => $request->nama,
                'nik'    => $request->nik,
                'no_hp'  => $request->no_hp,
                'alamat' => $request->alamat,

                'tps'    => $isKunjunganActor ? $request->tps : null,

                'ormas_id' => $request->ormas_id,

                'province_code' => $prov,
                'city_code'     => $city,
                'district_code' => $dist,
                'village_code'  => $vill,

                'is_kunjungan' => $newIsKunjungan,
                'is_apk'       => $newIsApk,
            ]);

            $newEmail = null;
            $newPasswordPlain = null;

            if ($relawan->user) {
                $userUpdate = [
                    'name' => $request->nama,
                    'nik'  => $request->nik,
                    'role_id' => $this->roleId('relawan'),
                ];

                if ($nameChanged) {
                    $nameClean = strtolower(preg_replace('/\s+/', '', trim($request->nama)));
                    $newEmail = $nameClean . rand(1000, 9999) . '@gmail.com';
                    $newPasswordPlain = $nameClean . rand(1000, 9999);

                    if (User::where('email', $newEmail)->where('id', '!=', $relawan->user->id)->exists()) {
                        $newEmail = $nameClean . rand(10000, 99999) . '@gmail.com';
                    }

                    $userUpdate['email'] = $newEmail;
                    $userUpdate['password'] = Hash::make($newPasswordPlain);

                    UserCredential::where('user_id', $relawan->user->id)->update(['is_active' => false]);

                    UserCredential::create([
                        'user_id'            => $relawan->user->id,
                        'encrypted_password' => Crypt::encryptString($newPasswordPlain),
                        'type'               => 'reactive',
                        'is_active'          => true,
                    ]);
                }

                $relawan->user->update($userUpdate);
            }

            foreach ($oldData as $field => $oldValue) {
                $newValue = $relawan->$field;
                if ((string)$oldValue !== (string)$newValue) {
                    ActivityLogger::log([
                        'action'      => 'UPDATE',
                        'target_type' => 'relawan',
                        'target_name' => $relawan->nama,
                        'field'       => $field,
                        'old_value'   => $oldValue,
                        'new_value'   => $newValue,
                    ]);
                }
            }

            return [
                'blocked' => false,
                'relawan' => $relawan->fresh()->load('ormas'),
                'name_changed' => $nameChanged,
                'email' => $newEmail,
                'password' => $newPasswordPlain,
            ];
        });

        if (!empty($result['blocked'])) {
            return response()->json(['status' => false, 'message' => $result['message']], 422);
        }

        $userPayload = null;
        if (!empty($result['name_changed'])) {
            $userPayload = ['email' => $result['email'], 'password' => $result['password']];
        }

        return response()->json([
            'status'  => true,
            'message' => 'Relawan berhasil diperbarui',
            'data'    => [
                'relawan' => $result['relawan'],
                'user'    => $userPayload,
            ]
        ]);
    }

    public function destroy($id)
    {
        $user = Auth::user();
        $roleSlug = $this->userRoleSlug($user);

        $relawan = Relawan::with([
            'village',
            'district',
            'city',
            'koordinatorKunjungan',
            'koordinatorApk',
            'user'
        ])->find($id);

        if (!$relawan) {
            return response()->json([
                'status' => false,
                'message' => 'Relawan tidak ditemukan'
            ], 404);
        }

        if (!in_array($roleSlug, ['kunjungan_koordinator', 'apk_koordinator'], true)) {
            return response()->json([
                'status' => false,
                'message' => 'Anda tidak memiliki akses menghapus relawan'
            ], 403);
        }

        if ($roleSlug === 'kunjungan_koordinator') {

            if ((int) $relawan->is_kunjungan !== 1) {
                return response()->json([
                    'status' => false,
                    'message' => 'Relawan ini bukan relawan kunjungan'
                ], 403);
            }

            $koor = $this->getKunjunganCoordinator($user);

            if (
                !$koor ||
                (int) $relawan->koor_kunjungan_id !== (int) $koor->id
            ) {
                return response()->json([
                    'status' => false,
                    'message' => 'Anda tidak berhak menghapus relawan ini'
                ], 403);
            }
        }

        if ($roleSlug === 'apk_koordinator') {

            if ((int) $relawan->is_apk !== 1) {
                return response()->json([
                    'status' => false,
                    'message' => 'Relawan ini bukan relawan APK'
                ], 403);
            }

            $koor = $this->getApkCoordinator($user);

            if (
                !$koor ||
                (int) $relawan->koor_apk_id !== (int) $koor->id
            ) {
                return response()->json([
                    'status' => false,
                    'message' => 'Anda tidak berhak menghapus relawan ini'
                ], 403);
            }
        }

        $visitCount = VisitForm::where('relawan_id', $relawan->id)->count();

        if ($visitCount > 0) {
            return response()->json([
                'status' => false,
                'message' => "Relawan ini masih mempunyai {$visitCount} data kunjungan"
            ], 422);
        }

        $nama = $relawan->nama;
        $wilayah = [
            'kelurahan' => $relawan->village->village ?? null,
            'kecamatan' => $relawan->district->district ?? null,
            'kota'      => $relawan->city->city ?? null,
        ];

        ActivityLogger::log([
            'action'      => 'DELETE',
            'target_type' => 'relawan',
            'target_name' => $nama,
            'meta'        => $wilayah,
        ]);

        DB::transaction(function () use ($relawan) {
            $relawan->delete();

            if ($relawan->user) {
                $relawan->user->delete();
            }
        });

        return response()->json([
            'status'  => true,
            'message' => 'Relawan berhasil dihapus'
        ]);
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

        $adminPaslon = AdminPaslon::where('user_id', $actor->id)->whereNull('deleted_at')->first();
        if (!$adminPaslon) {
            return response()->json(['status' => false, 'message' => 'Akun ini bukan admin paslon / tidak memiliki paslon.'], 403);
        }

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
        $isAdminApk     = $roleSlug === 'admin_apk'; 

        if (!$isApkActor && !$isAdminPaslon && !$isAdminApk) { 
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
            $suffix    = str_pad((string)$paslonNo, 2, '0', STR_PAD_LEFT); 

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
            $suffix   = str_pad((string)$paslonNo, 2, '0', STR_PAD_LEFT); 

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

        $nomorUrut = (int) (DB::table('paslons')->where('id', $paslonId)->value('nomor_urut') ?? 0);
        $suffix = $nomorUrut
            ? str_pad((string)$nomorUrut, 2, '0', STR_PAD_LEFT)
            : str_pad((string)$paslonId, 2, '0', STR_PAD_LEFT);

        $fileName = "RELAWAN_APK_{$suffix}.xlsx";

        $response = Excel::download(
            new RelawanApkExport('admin_paslon', null, $paslonId), 
            $fileName
        );

        $response->headers->set('Cache-Control', 'no-store, no-cache');
        $response->headers->set('Access-Control-Expose-Headers', 'Content-Disposition');
        return $response;
    }

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
                'status'  => false,
                'message' => 'Hanya koordinator yang dapat melakukan pengecekan NIK relawan'
            ], 403);
        }

        $paslonId = $this->currentPaslonIdForActor($actor, $roleSlug);

        $existsKoorKunjungan = CoordinatorVisit::where('nik', $request->nik)
            ->whereNull('deleted_at')
            ->exists();

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

        $activeHere = Relawan::query()
            ->where('paslon_id', $paslonId)
            ->where('nik', $request->nik)
            ->whereNull('deleted_at')
            ->first();

        if ($activeHere) {
            $eligibleDoubleJob = false;
            if ($isApkActor && $this->canDoubleJobFromKunjunganToApk($activeHere)) {
                $eligibleDoubleJob = true;
            }

            return response()->json([
                'exists'  => true,
                'deleted' => false,
                'message' => 'NIK sudah terdaftar dan masih aktif di paslon ini.',
                'data'    => [
                    'id' => $activeHere->id,
                    'nama' => $activeHere->nama,
                    'nik' => $activeHere->nik,
                    'no_hp' => $activeHere->no_hp,
                    'alamat' => $activeHere->alamat,
                    'tps' => $activeHere->tps,
                    'ormas_id' => $activeHere->ormas_id,
                    'province_code' => $activeHere->province_code,
                    'city_code' => $activeHere->city_code,
                    'district_code' => $activeHere->district_code,
                    'village_code' => $activeHere->village_code,
                    'is_kunjungan' => (int) $activeHere->is_kunjungan,
                    'is_apk' => (int) $activeHere->is_apk,
                    'eligible_double_job_apk' => $eligibleDoubleJob ? 1 : 0,
                ],
            ], 200);
        }

        $softDeleted = Relawan::withTrashed()
            ->with([
                'user' => fn($q) => $q->withTrashed(),
                'province:province_code,province',
                'city:city_code,city',
                'district:district_code,district',
                'village:village_code,village',
            ])
            ->where('nik', $request->nik)
            ->whereNotNull('deleted_at')
            ->orderByDesc('deleted_at')
            ->first();

        if ($softDeleted) {
            return response()->json([
                'exists'  => true,
                'deleted' => true,
                'message' => 'NIK pernah terdaftar dan saat ini nonaktif (soft delete). Bisa direstore ke paslon ini.',
                'data'    => [
                    'id' => $softDeleted->id,
                    'nama' => $softDeleted->nama,
                    'nik' => $softDeleted->nik,

                    'no_hp' => $softDeleted->no_hp,
                    'alamat' => $softDeleted->alamat,
                    'tps' => $softDeleted->tps, 
                    'ormas_id' => $softDeleted->ormas_id,
                    'province_code' => $softDeleted->province_code,
                    'city_code' => $softDeleted->city_code,
                    'district_code' => $softDeleted->district_code,
                    'village_code' => $softDeleted->village_code,
                    'is_kunjungan' => (int) $softDeleted->is_kunjungan,
                    'is_apk' => (int) $softDeleted->is_apk,

                    'old_paslon_id' => (int) $softDeleted->paslon_id,
                ],
            ], 200);
        }

        return response()->json([
            'exists'  => false,
            'deleted' => false,
            'data'    => null,
        ], 200);
    }

    public function restoreByNik(Request $request)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        $isKunjunganActor = $roleSlug === 'kunjungan_koordinator';
        $isApkActor       = $roleSlug === 'apk_koordinator';

        if (!$isKunjunganActor && !$isApkActor) {
            return response()->json([
                'status'  => false,
                'message' => 'Hanya koordinator yang dapat restore relawan'
            ], 403);
        }

        $paslonId = $this->currentPaslonIdForActor($actor, $roleSlug);

        $validator = Validator::make($request->all(), [
            'nik'   => 'required|digits:16',

            'nama'   => 'sometimes|required|string|max:255|regex:/^[^0-9]+$/',
            'no_hp'  => 'sometimes|required|digits_between:10,13',
            'alamat' => 'sometimes|required|string|max:255',

            'tps' => $isKunjunganActor
                ? 'sometimes|required|string|max:3'
                : 'nullable|string|max:3',

            'ormas_id' => 'sometimes|nullable|exists:ormas,id',
            'is_apk'   => 'sometimes|in:0,1',
        ], [
            'nama.regex' => 'Nama tidak boleh mengandung angka'
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => false, 'errors' => $validator->errors()], 422);
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
                'status'  => false,
                'message' => 'NIK ini sedang dipakai koordinator (aktif), tidak bisa restore sebagai relawan'
            ], 422);
        }

        $alreadyActiveInTarget = Relawan::query()
            ->where('paslon_id', $paslonId)
            ->where('nik', $request->nik)
            ->whereNull('deleted_at')
            ->exists();

        if ($alreadyActiveInTarget) {
            return response()->json([
                'status'  => false,
                'message' => 'NIK sudah terdaftar dan aktif di paslon ini'
            ], 422);
        }

        $relawan = Relawan::withTrashed()
            ->with(['user' => fn($q) => $q->withTrashed()])
            ->where('nik', $request->nik)
            ->whereNotNull('deleted_at')
            ->orderByDesc('deleted_at')
            ->first();

        if (!$relawan) {
            return response()->json([
                'status'  => false,
                'message' => 'Data NIK tidak ditemukan / tidak ada yang soft delete'
            ], 404);
        }

        if ($request->filled('no_hp')) {
            $request->merge(['no_hp' => PhoneHelper::normalize($request->no_hp)]);
        }

        if ($isApkActor) {
            $request->merge(['tps' => null]);
        } else {
            if ($request->has('tps')) {
                $request->merge(['tps' => $this->normalizeTps($request->tps)]);
            }
        }

        $newEmail = null;
        $newPasswordPlain = null;

        $result = DB::transaction(function () use (
            $request,
            $relawan,
            $paslonId,
            $isKunjunganActor,
            $isApkActor,
            $koorKunjungan,
            $koorApk,
            &$newEmail,
            &$newPasswordPlain
        ) {

            if ($isKunjunganActor) {
                $count = Relawan::query()
                    ->where('koor_kunjungan_id', (int)$koorKunjungan->id)
                    ->whereNull('deleted_at')
                    ->where('is_kunjungan', 1)
                    ->lockForUpdate()
                    ->count();

                if ($count >= 20) {
                    return [
                        'blocked' => true,
                        'message' => 'Maksimal 20 relawan kunjungan untuk setiap koordinator kunjungan'
                    ];
                }
            }

            $relawan->restore();

            if ($relawan->user && method_exists($relawan->user, 'restore') && $relawan->user->trashed()) {
                $relawan->user->restore();
            }

            $prov = $isKunjunganActor ? $koorKunjungan->province_code : $koorApk->province_code;
            $city = $isKunjunganActor ? $koorKunjungan->city_code     : $koorApk->city_code;
            $dist = $isKunjunganActor ? $koorKunjungan->district_code : $koorApk->district_code;
            $vill = $isKunjunganActor ? $koorKunjungan->village_code  : $koorApk->village_code;

            $finalNama = $request->input('nama', $relawan->nama);

            $finalTps = null;
            if ($isKunjunganActor) {
                $candidate = $request->has('tps')
                    ? $request->input('tps')   
                    : $relawan->tps;          
                $finalTps = $this->normalizeTps($candidate);
            } else {
                $finalTps = null;
            }

            $finalIsKunjungan = $isKunjunganActor ? 1 : 0;
            $finalIsApk       = $isApkActor ? 1 : (int) $request->input('is_apk', (int) $relawan->is_apk);

            if ($finalIsKunjungan === 0 && $finalIsApk === 0) {
                return [
                    'blocked' => true,
                    'message' => 'Relawan harus memiliki minimal salah satu tugas (kunjungan atau apk)'
                ];
            }

            $relawan->update([
                'paslon_id' => $paslonId,

                'koor_kunjungan_id' => $isKunjunganActor ? (int)$koorKunjungan->id : null,
                'koor_apk_id'       => $isApkActor ? (int)$koorApk->id : ($finalIsApk ? $relawan->koor_apk_id : null),

                'province_code' => $prov,
                'city_code'     => $city,
                'district_code' => $dist,
                'village_code'  => $vill,

                'nama'     => $finalNama,
                'no_hp'    => $request->input('no_hp', $relawan->no_hp),
                'alamat'   => $request->input('alamat', $relawan->alamat),
                'tps'      => $finalTps,
                'ormas_id' => $request->has('ormas_id') ? $request->ormas_id : $relawan->ormas_id,

                'is_kunjungan' => $finalIsKunjungan,
                'is_apk'       => $finalIsApk,
                'status'       => 'inactive',
            ]);

            $nameClean = strtolower(trim((string) $finalNama));
            $nameClean = preg_replace('/\s+/', '', $nameClean);
            $nameClean = preg_replace('/[^a-z0-9]/', '', $nameClean);
            if ($nameClean === '') $nameClean = 'user';

            do {
                $newEmail = $nameClean . rand(1000, 9999) . '@gmail.com';
            } while (
                User::where('email', $newEmail)
                    ->when($relawan->user, fn($q) => $q->where('id', '!=', $relawan->user->id))
                    ->exists()
            );

            $newPasswordPlain = $nameClean . rand(1000, 9999);

            $roleRelawanId = $this->roleId('relawan');

            if ($relawan->user) {
                $relawan->user->update([
                    'name'     => $finalNama,
                    'nik'      => $relawan->nik,
                    'email'    => $newEmail,
                    'password' => Hash::make($newPasswordPlain),
                    'role_id'  => $roleRelawanId,
                    'status'   => 'inactive',
                ]);

                UserCredential::where('user_id', $relawan->user->id)
                    ->update([
                        'is_active' => 0,
                        'used_at'   => now(),
                    ]);

                UserCredential::create([
                    'user_id'            => $relawan->user->id,
                    'encrypted_password' => Crypt::encryptString($newPasswordPlain),
                    'type'               => 'reactive',
                    'is_active'          => 1,
                    'used_at'            => null,
                ]);
            } else {
                $userRelawan = User::create([
                    'name'     => $finalNama,
                    'nik'      => $relawan->nik,
                    'email'    => $newEmail,
                    'password' => Hash::make($newPasswordPlain),
                    'role_id'  => $roleRelawanId,
                    'status'   => 'inactive',
                ]);

                $relawan->update(['user_id' => $userRelawan->id]);

                UserCredential::create([
                    'user_id'            => $userRelawan->id,
                    'encrypted_password' => Crypt::encryptString($newPasswordPlain),
                    'type'               => 'reactive',
                    'is_active'          => 1,
                    'used_at'            => null,
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
                'blocked' => false,
                'relawan' => $relawan->fresh(['user', 'province', 'city', 'district', 'village']),
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
            'message' => "Relawan {$result['relawan']->nama} berhasil diaktifkan kembali",
            'data'    => [
                'relawan' => $result['relawan'],
                'user'    => [
                    'email'    => $newEmail,
                    'password' => $newPasswordPlain,
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
