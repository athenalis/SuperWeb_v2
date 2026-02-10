<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminApk;
use App\Models\ApkRequest;
use App\Models\ApkRequestItem;
use App\Models\ApkRequestStatus;
use App\Models\User;
use App\Notifications\ApkRequestNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ApkRequestController extends Controller
{
    /* =====================================================
       Helpers
       ===================================================== */

    private function roleName($user): ?string
    {
        $user->loadMissing('role');
        return $user->role?->role; // apk_koordinator / admin_apk / apk_kurir / admin_paslon
    }

    private function requireKoordinator($user)
    {
        $coor = $user->apkKoordinator;
        if (!$coor) {
            abort(response()->json([
                'status' => false,
                'message' => 'Akun ini belum terdaftar sebagai Koordinator APK'
            ], 403));
        }
        return $coor;
    }

    private function requireKurir($user)
    {
        $kurir = $user->apkKurir;
        if (!$kurir) {
            abort(response()->json([
                'status' => false,
                'message' => 'Akun ini belum terdaftar sebagai Kurir APK'
            ], 403));
        }
        return $kurir;
    }

    private function requireAdminApk($user)
    {
        $admin = $user->adminApk;
        if (!$admin) {
            abort(response()->json([
                'status' => false,
                'message' => 'Akun ini belum terdaftar sebagai Admin APK'
            ], 403));
        }
        return $admin;
    }

    private function getSingleAdminApk(): ?AdminApk
    {
        return AdminApk::whereNull('deleted_at')
            ->where('status', 'active')
            ->first() ?? AdminApk::whereNull('deleted_at')->first();
    }

    private function generateRequestNo(): string
    {
        $date = now()->format('Ymd');

        $last = ApkRequest::whereNotNull('request_no')
            ->where('request_no', 'like', "APK-$date-%")
            ->orderBy('id', 'desc')
            ->first();

        $next = 1;
        if ($last && preg_match('/APK-\d{8}-(\d+)/', $last->request_no, $m)) {
            $next = (int) $m[1] + 1;
        }

        return 'APK-' . $date . '-' . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function withDetailRelations(): array
    {
        return [
            'status:id,code,name',
            'items.item.bentuk',
            'items.unit',
            'histories.status:id,code,name',
            'coordinator:id,nama,no_hp,alamat',
            'courier:id,nama,no_hp',
            'admin:id,nama,no_hp',
        ];
    }

    private function withListRelations(): array
    {
        return [
            'status:id,code,name',
            'items.item.bentuk',
            'items.unit',
            'coordinator:id,nama,no_hp,alamat',
            'courier:id,nama,no_hp',
            'admin:id,nama,no_hp',
        ];
    }

    /* =====================================================
       LIST & DETAIL
       ===================================================== */

    public function index(Request $request)
    {
        $user = auth()->user();
        $role = $this->roleName($user);

        $query = ApkRequest::query()
            ->with($this->withListRelations())
            ->latest();

        if ($request->filled('status')) {
            $statusCode = $request->status;
            $query->whereHas('status', fn($q) => $q->where('code', $statusCode));
        }

        if ($role === 'apk_koordinator') {
            $coor = $this->requireKoordinator($user);
            $query->where('coordinator_id', $coor->id);
        } elseif ($role === 'apk_kurir') {
            $kurir = $this->requireKurir($user);
            $query->where('courier_id', $kurir->id);
        } else {
            // admin_apk / admin_paslon -> lihat semua
        }

        return response()->json([
            'status' => true,
            'data'   => $query->get(),
        ]);
    }

    public function show($id)
    {
        $user = auth()->user();
        $role = $this->roleName($user);

        $apkRequest = ApkRequest::with($this->withDetailRelations())->findOrFail($id);

        if ($role === 'apk_koordinator') {
            $coor = $this->requireKoordinator($user);
            abort_if((int) $apkRequest->coordinator_id !== (int) $coor->id, 403, 'Tidak punya akses');
        }

        if ($role === 'apk_kurir') {
            $kurir = $this->requireKurir($user);
            abort_if((int) $apkRequest->courier_id !== (int) $kurir->id, 403, 'Tidak punya akses');
        }

        // Fix: Explicitly check for admin_apk role
        // if ($role === 'admin_apk') {
        //     $this->requireAdminApk($user);
        //     // Admin APK has full access to view, so no additional checks needed here
        //     // unless you want to restrict to specific assignments if multi-tenancy exists
        // }

        return response()->json([
            'status' => true,
            'data'   => $apkRequest
        ]);
    }

    /* =====================================================
       KOORDINATOR
       ===================================================== */

    public function store(Request $request)
    {
        $request->validate([
            'pickup_address'     => 'required|string',
            'description'        => 'nullable|string',
            'items'              => 'required|array|min:1',
            'items.*.item_id'    => 'required|integer|exists:apk_items,id',
            'items.*.qty'        => 'required|numeric|min:0.01',
            'items.*.unit_id'    => 'required|integer|exists:units,id',
            'items.*.note'       => 'nullable|string',
        ]);

        $user = auth()->user();
        $role = $this->roleName($user);

        if ($role !== 'apk_koordinator') {
            return response()->json(['status' => false, 'message' => 'Akses ditolak (bukan Koordinator APK)'], 403);
        }

        $coor = $this->requireKoordinator($user);

        $singleAdmin = $this->getSingleAdminApk();
        if (!$singleAdmin) {
            return response()->json([
                'status'  => false,
                'message' => 'Admin APK belum ada (admin_apks kosong)'
            ], 500);
        }

        $created = DB::transaction(function () use ($request, $coor, $singleAdmin, $user) {
            $statusSubmitted = ApkRequestStatus::where('code', 'SUBMITTED')->firstOrFail();

            $apkRequest = ApkRequest::create([
                'request_no'        => $this->generateRequestNo(),
                'coordinator_id'    => $coor->id,
                'admin_id'          => $singleAdmin->id,
                'pickup_address'    => $request->pickup_address,
                'description'       => $request->description,
                'current_status_id' => $statusSubmitted->id,
                'revision_no'       => 1,
            ]);

            foreach ($request->items as $item) {
                ApkRequestItem::create([
                    'apk_request_id' => $apkRequest->id,
                    'item_id'        => $item['item_id'],
                    'qty'            => $item['qty'],
                    'unit_id'        => $item['unit_id'],
                    'note'           => $item['note'] ?? null,
                ]);
            }

            $apkRequest->setStatusByCode('SUBMITTED', (int) $user->id, 'Request dibuat');

            // penting: fresh + load relasi biar notif & response lengkap
            $fresh = $apkRequest->fresh([
                'status:id,code,name',
                'items.item.bentuk',
                'items.unit',
                'coordinator:id,nama,no_hp,alamat',
                'courier:id,nama,no_hp',
                'admin:id,nama,no_hp',
            ]);

            // Notif ke SEMUA Admin APK (Active atau Assigned + Role Based)
            $adminApkUserIds = AdminApk::whereNull('deleted_at')
                ->where('status', 'active')
                ->pluck('user_id')
                ->toArray();

            $roleAdminApk = \App\Models\Role::where('role', 'admin_apk')->first();
            $roleAdminUserIds = $roleAdminApk ? User::where('role_id', $roleAdminApk->id)->pluck('id')->toArray() : [];

            // Gabungkan ID dari tabel admin_apks dan user dengan role admin_apk
            $targetUserIds = array_unique(array_merge($adminApkUserIds, $roleAdminUserIds));

            if (!empty($targetUserIds)) {
                $usersToNotify = User::whereIn('id', $targetUserIds)->get();
                foreach ($usersToNotify as $usr) {
                    $usr->notify(new ApkRequestNotification('apk_request', $fresh));
                }
            }

            return $fresh;
        });

        return response()->json([
            'status'  => true,
            'message' => 'Request berhasil diajukan',
            'data'    => $created
        ], 201);
    }

    public function reviseItems(Request $request, $id)
    {
        $request->validate([
            'items'           => 'required|array|min:1',
            'items.*.item_id' => 'required|integer|exists:apk_items,id',
            'items.*.qty'     => 'required|numeric|min:0.01',
            'items.*.unit_id' => 'required|integer|exists:units,id',
            'items.*.note'    => 'nullable|string',
        ]);

        $user = auth()->user();
        $role = $this->roleName($user);

        if ($role !== 'apk_koordinator') {
            return response()->json(['status' => false, 'message' => 'Akses ditolak (bukan Koordinator APK)'], 403);
        }

        $coor = $this->requireKoordinator($user);

        $apkRequest = ApkRequest::where('id', $id)
            ->where('coordinator_id', $coor->id)
            ->firstOrFail();

        if (!$apkRequest->isStatus('REJECTED')) {
            abort(403, 'Request tidak bisa direvisi (status harus REJECTED)');
        }

        DB::transaction(function () use ($apkRequest, $request, $user) {
            $apkRequest->items()->delete();

            foreach ($request->items as $item) {
                ApkRequestItem::create([
                    'apk_request_id' => $apkRequest->id,
                    'item_id'        => $item['item_id'],
                    'qty'            => $item['qty'],
                    'unit_id'        => $item['unit_id'],
                    'note'           => $item['note'] ?? null,
                ]);
            }

            $apkRequest->setStatusByCode('REVISED', (int) $user->id, 'Items direvisi');
        });

        // (opsional) notif ke admin: revised
        $fresh = ApkRequest::with($this->withListRelations())->find($id);
        if ($fresh && $fresh->admin?->user_id) {
            $adminUser = User::find($fresh->admin->user_id);
            if ($adminUser) {
                $adminUser->notify(new ApkRequestNotification('apk_request_revised', $fresh));
            }
        }

        return response()->json(['status' => true, 'message' => 'Item berhasil direvisi']);
    }

    public function resubmit($id)
    {
        $user = auth()->user();
        $role = $this->roleName($user);

        if ($role !== 'apk_koordinator') {
            return response()->json(['status' => false, 'message' => 'Akses ditolak (bukan Koordinator APK)'], 403);
        }

        $coor = $this->requireKoordinator($user);

        $apkRequest = ApkRequest::where('id', $id)
            ->where('coordinator_id', $coor->id)
            ->firstOrFail();

        if (!$apkRequest->isStatus('REVISED')) {
            abort(403, 'Request belum direvisi (status harus REVISED)');
        }

        DB::transaction(function () use ($apkRequest, $user) {
            $apkRequest->increment('revision_no');
            $apkRequest->setStatusByCode('SUBMITTED', (int) $user->id, 'Resubmitted');
        });

        // notif ke admin: submitted lagi (opsional)
        // notif ke SEMUA Admin APK (Assignments + Role Fallback)
        $fresh = ApkRequest::with($this->withListRelations())->find($id);

        $usersToNotify = collect();

        // 1. Assigned Admin
        if ($fresh && $fresh->admin && $fresh->admin->user) {
            $usersToNotify->push($fresh->admin->user);
        }

        // 2. Role Fallback
        $adminRole = \Illuminate\Support\Facades\DB::table('roles')->where('role', 'admin_apk')->first();
        if ($adminRole) {
            $roleUsers = User::where('role_id', $adminRole->id)->get();
            $usersToNotify = $usersToNotify->merge($roleUsers);
        }

        // 3. Notify Unique
        $usersToNotify->unique('id')->each(function ($usr) use ($fresh) {
            $usr->notify(new ApkRequestNotification('apk_request_revised', $fresh));
        });

        return response()->json(['status' => true, 'message' => 'Request berhasil diajukan ulang']);
    }

    /* =====================================================
       ADMIN APK
       ===================================================== */

    public function approve(Request $request, $id)
    {
        $request->validate([
            'courier_id' => [
                'required',
                Rule::exists('apk_kurirs', 'id')
                    ->whereNull('deleted_at')
                    ->where('status', 'active'),
            ],
            'pickup_address'      => 'required|string',
            'pickup_scheduled_at' => 'required|date',
        ]);

        $user = auth()->user();
        $role = $this->roleName($user);

        if ($role !== 'admin_apk') {
            return response()->json(['status' => false, 'message' => 'Akses ditolak (bukan Admin APK)'], 403);
        }

        $admin = $this->requireAdminApk($user);

        $apkRequest = ApkRequest::with(['items', 'status'])->findOrFail($id);

        if (!in_array($apkRequest->status?->code, ['SUBMITTED', 'REVISED'], true)) {
            abort(403, 'Request tidak bisa disetujui (status harus SUBMITTED atau REVISED)');
        }

        DB::transaction(function () use ($apkRequest, $request, $admin, $user) {
            $apkRequest->update([
                'admin_id'            => $admin->id,
                'courier_id'          => $request->courier_id,
                'pickup_address'      => $request->pickup_address,
                'pickup_scheduled_at' => $request->pickup_scheduled_at,
            ]);

            $apkRequest->setStatusByCode('APPROVED', (int) $user->id, 'Disetujui admin');

            foreach ($apkRequest->items as $it) {
                DB::table('apk_stock_transactions')->insert([
                    'paslon_id'       => $admin->paslon_id,
                    'item_id'         => $it->item_id,
                    'type'            => 'OUT',
                    'qty'             => $it->qty,
                    'note'            => 'OUT untuk request_no ' . ($apkRequest->request_no ?? $apkRequest->id),
                    'total_cost'      => null,
                    'created_by'      => (int) $user->id,              // admin yang approve
                    'coordinator_id'  => (int) $apkRequest->coordinator_id, // ✅ koor yg request
                    'created_at'      => now(),
                ]);
            }
        });

        // Hapus notifikasi terkait request ini untuk user yang sedang login (Admin)
        // Agar "langsung ilang notifnya" dari inbox
        $user->notifications()
            ->where('data->apk_request_id', $id)
            ->delete();

        $fresh = ApkRequest::with($this->withDetailRelations())->find($id);

        // notif ke koordinator
        $coordinatorUser = User::whereHas('apkKoordinator', fn($q) => $q->where('id', $fresh->coordinator_id))->first();
        if ($coordinatorUser) {
            $coordinatorUser->notify(new ApkRequestNotification('apk_request_approved', $fresh));
        }

        // (opsional) notif ke kurir (yang dipilih)
        $courierUser = User::whereHas('apkKurir', fn($q) => $q->where('id', $fresh->courier_id))->first();
        if ($courierUser) {
            $courierUser->notify(new ApkRequestNotification('apk_request_assigned', $fresh));
        }

        return response()->json([
            'status'  => true,
            'message' => 'Request disetujui',
            'data'    => $fresh,
        ]);
    }

    public function reject(Request $request, $id)
    {
        $request->validate([
            'message' => 'required|string',
        ]);

        $user = auth()->user();
        $role = $this->roleName($user);

        if ($role !== 'admin_apk') {
            return response()->json(['status' => false, 'message' => 'Akses ditolak (bukan Admin APK)'], 403);
        }

        $this->requireAdminApk($user);

        $apkRequest = ApkRequest::with(['status', 'coordinator'])->findOrFail($id);

        if (!in_array($apkRequest->status?->code, ['SUBMITTED', 'REVISED'], true)) {
            abort(403, 'Request tidak bisa ditolak (status harus SUBMITTED atau REVISED)');
        }

        $apkRequest->setStatusByCode('REJECTED', (int) $user->id, $request->message);

        // Hapus notifikasi terkait request ini untuk user yang sedang login (Admin)
        $user->notifications()
            ->where('data->apk_request_id', $id)
            ->delete();

        $fresh = ApkRequest::with($this->withDetailRelations())->find($id);

        $coordinatorUser = User::whereHas('apkKoordinator', fn($q) => $q->where('id', $fresh->coordinator_id))->first();
        if ($coordinatorUser) {
            $coordinatorUser->notify(new ApkRequestNotification('apk_request_rejected', $fresh, $request->message));
        }

        return response()->json(['status' => true, 'message' => 'Request ditolak']);
    }

    /* =====================================================
       KURIR
       ===================================================== */

    public function pickup($id)
    {
        $user = auth()->user();
        $role = $this->roleName($user);

        if ($role !== 'apk_kurir') {
            return response()->json(['status' => false, 'message' => 'Akses ditolak (bukan Kurir APK)'], 403);
        }

        $kurir = $this->requireKurir($user);

        $apkRequest = ApkRequest::where('id', $id)
            ->where('courier_id', $kurir->id)
            ->firstOrFail();

        if (!$apkRequest->isStatus('APPROVED')) {
            abort(403, 'Request belum bisa diambil (status harus APPROVED)');
        }

        $apkRequest->setStatusByCode('PICKED_UP', (int) $user->id, 'Pesanan diambil kurir');

        // notif ke koordinator (opsional)
        $fresh = ApkRequest::with($this->withDetailRelations())->find($id);
        $coordinatorUser = User::whereHas('apkKoordinator', fn($q) => $q->where('id', $fresh->coordinator_id))->first();
        if ($coordinatorUser) {
            $coordinatorUser->notify(new ApkRequestNotification('apk_request_picked_up', $fresh));
        }

        return response()->json(['status' => true, 'message' => 'Barang sudah diambil']);
    }

    public function arrive($id)
    {
        $user = auth()->user();
        $role = $this->roleName($user);

        if ($role !== 'apk_kurir') {
            return response()->json(['status' => false, 'message' => 'Akses ditolak (bukan Kurir APK)'], 403);
        }

        $kurir = $this->requireKurir($user);

        $apkRequest = ApkRequest::where('id', $id)
            ->where('courier_id', $kurir->id)
            ->firstOrFail();

        if (!$apkRequest->isStatus('PICKED_UP')) {
            abort(403, 'Tidak bisa konfirmasi sampai (status harus PICKED_UP)');
        }

        $apkRequest->setStatusByCode('ARRIVED', (int) $user->id, 'Barang sampai tujuan');

        // notif ke koordinator (opsional)
        $fresh = ApkRequest::with($this->withDetailRelations())->find($id);
        $coordinatorUser = User::whereHas('apkKoordinator', fn($q) => $q->where('id', $fresh->coordinator_id))->first();
        if ($coordinatorUser) {
            $coordinatorUser->notify(new ApkRequestNotification('apk_request_arrived', $fresh));
        }

        return response()->json(['status' => true, 'message' => 'Konfirmasi sampai berhasil']);
    }

    /* =====================================================
       KOORDINATOR FINAL
       ===================================================== */

    public function delivered($id)
    {
        $user = auth()->user();
        $role = $this->roleName($user);

        if ($role !== 'apk_koordinator') {
            return response()->json(['status' => false, 'message' => 'Akses ditolak (bukan Koordinator APK)'], 403);
        }

        $coor = $this->requireKoordinator($user);

        $apkRequest = ApkRequest::where('id', $id)
            ->where('coordinator_id', $coor->id)
            ->firstOrFail();

        if (!$apkRequest->isStatus('ARRIVED') && !$apkRequest->isStatus('PICKED_UP')) {
            abort(403, 'Tidak bisa konfirmasi diterima (status harus ARRIVED atau PICKED_UP)');
        }

        $apkRequest->setStatusByCode('DELIVERED', (int) $user->id, 'Barang diterima koordinator');

        // notif ke admin (opsional)
        $fresh = ApkRequest::with($this->withDetailRelations())->find($id);
        if ($fresh && $fresh->admin?->user_id) {
            $adminUser = User::find($fresh->admin->user_id);
            if ($adminUser) {
                $adminUser->notify(new ApkRequestNotification('apk_request_delivered', $fresh));
            }
        }

        return response()->json(['status' => true, 'message' => 'Barang sudah diterima']);
    }

    public function destroy($id)
    {
        $user = auth()->user();
        $role = $this->roleName($user);

        if ($role !== 'apk_koordinator') {
            return response()->json(['status' => false, 'message' => 'Forbidden'], 403);
        }

        $coor = $this->requireKoordinator($user);
        $apkRequest = ApkRequest::where('id', $id)->where('coordinator_id', $coor->id)->firstOrFail();

        // Allow delete only if not approved yet
        if (in_array($apkRequest->status?->code, ['APPROVED', 'PICKED_UP', 'ARRIVED', 'DELIVERED'])) {
            return response()->json([
                'status' => false,
                'message' => 'Permintaan yang sudah diproses tidak dapat dihapus'
            ], 403);
        }

        DB::transaction(function () use ($apkRequest) {
            $apkRequest->items()->delete();
            $apkRequest->histories()->delete();
            $apkRequest->delete();
        });

        return response()->json(['status' => true, 'message' => 'Permintaan berhasil dihapus']);
    }
}
