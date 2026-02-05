<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminApk;
use App\Models\ApkRequest;
use App\Models\ApkRequestItem;
use App\Models\ApkRequestStatus;
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
        // kalau admin apk cuma 1, ambil yang active dulu
        return AdminApk::whereNull('deleted_at')
            ->where('status', 'active')
            ->first() ?? AdminApk::whereNull('deleted_at')->first();
    }

    private function generateRequestNo(): string
    {
        // contoh: APK-20260203-0001
        $date = now()->format('Ymd');

        $last = ApkRequest::whereNotNull('request_no')
            ->where('request_no', 'like', "APK-$date-%")
            ->orderBy('id', 'desc')
            ->first();

        $next = 1;
        if ($last && preg_match('/APK-\d{8}-(\d+)/', $last->request_no, $m)) {
            $next = (int)$m[1] + 1;
        }

        return 'APK-' . $date . '-' . str_pad((string)$next, 4, '0', STR_PAD_LEFT);
    }

    /* =====================================================
       LIST & DETAIL (NO PAGINATE)
       ===================================================== */

    public function index(Request $request)
    {
        $user = auth()->user();
        $role = $this->roleName($user);

        $query = ApkRequest::query()
            ->with([
                'status:id,code,name',
                'items.item.bentuk',  // include bentuk relation
                'items.unit',
                'coordinator:id,nama,no_hp',
                'courier:id,nama,no_hp',
                'admin:id,nama,no_hp',
            ])
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

        $apkRequest = ApkRequest::with([
            'status:id,code,name',
            'items.item.bentuk',
            'items.unit',
            'histories.status:id,code,name',
            'coordinator:id,nama,no_hp,alamat',
            'courier:id,nama,no_hp',
            'admin:id,nama,no_hp',
        ])->findOrFail($id);

        if ($role === 'apk_koordinator') {
            $coor = $this->requireKoordinator($user);
            abort_if($apkRequest->coordinator_id !== $coor->id, 403, 'Tidak punya akses');
        }

        if ($role === 'apk_kurir') {
            $kurir = $this->requireKurir($user);
            abort_if((int)$apkRequest->courier_id !== (int)$kurir->id, 403, 'Tidak punya akses');
        }

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

        // admin apk cuma 1 => isi admin_id dari awal
        $singleAdmin = $this->getSingleAdminApk();
        if (!$singleAdmin) {
            return response()->json([
                'status' => false,
                'message' => 'Admin APK belum ada (admin_apks kosong)'
            ], 500);
        }

        $created = null;

        DB::transaction(function () use ($request, $coor, $singleAdmin, $user, &$created) {
            $statusSubmitted = ApkRequestStatus::where('code', 'SUBMITTED')->firstOrFail();

            $requestNo = $this->generateRequestNo();

            $apkRequest = ApkRequest::create([
                'request_no'        => $requestNo,
                'coordinator_id'    => $coor->id,
                'admin_id'          => $singleAdmin->id, // ✅ langsung isi
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

            // ✅ history pakai changed_by = users.id (int)
            $apkRequest->setStatusByCode('SUBMITTED', (int)$user->id, 'Request dibuat');

            $created = $apkRequest->fresh(['status', 'items.item', 'items.unit', 'coordinator', 'admin']);
        });

        return response()->json([
            'status'  => true,
            'message' => 'Request berhasil diajukan',
            'data'    => $created
        ]);
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

        if (! $apkRequest->isStatus('REJECTED')) {
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

            $apkRequest->setStatusByCode('REVISED', (int)$user->id, 'Items direvisi');
        });

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

        if (! $apkRequest->isStatus('REVISED')) {
            abort(403, 'Request belum direvisi (status harus REVISED)');
        }

        DB::transaction(function () use ($apkRequest, $user) {
            $apkRequest->increment('revision_no');
            $apkRequest->setStatusByCode('SUBMITTED', (int)$user->id, 'Resubmitted');
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
                    ->where('status', 'active'), // ✅ cuma kurir active
            ],
            'pickup_address'       => 'required|string',
            'pickup_scheduled_at'  => 'required|date', // ✅ wajib isi tgl/jam
        ]);

        $user = auth()->user();
        $role = $this->roleName($user);

        if ($role !== 'admin_apk') {
            return response()->json(['status' => false, 'message' => 'Akses ditolak (bukan Admin APK)'], 403);
        }

        $admin = $this->requireAdminApk($user);

        $apkRequest = ApkRequest::with(['items', 'status'])->findOrFail($id);

        $allowed = in_array($apkRequest->status?->code, ['SUBMITTED', 'REVISED'], true);
        if (! $allowed) {
            abort(403, 'Request tidak bisa disetujui (status harus SUBMITTED atau REVISED)');
        }

        DB::transaction(function () use ($apkRequest, $request, $admin, $user) {

            $apkRequest->update([
                'admin_id'            => $admin->id,
                'courier_id'          => $request->courier_id,
                'pickup_address'      => $request->pickup_address,
                'pickup_scheduled_at' => $request->pickup_scheduled_at, // ✅ simpan tgl
            ]);

            $apkRequest->setStatusByCode('APPROVED', (int)$user->id, 'Disetujui admin');

            foreach ($apkRequest->items as $it) {
                DB::table('apk_stock_transactions')->insert([
                    'paslon_id'   => $admin->paslon_id,
                    'item_id'     => $it->item_id,
                    'type'        => 'OUT',
                    'qty'         => $it->qty,
                    'note'        => 'OUT untuk request_no ' . ($apkRequest->request_no ?? $apkRequest->id),
                    'total_cost'  => null,
                    'created_by'  => (int)$user->id,
                    'created_at'  => now(),
                ]);
            }
        });

        // ✅ return data lengkap biar FE enak update UI setelah approve
        $fresh = ApkRequest::with([
            'status:id,code,name',
            'items.item',
            'items.unit',
            'coordinator:id,nama,no_hp,alamat',
            'courier:id,nama,no_hp',
            'admin:id,nama,no_hp',
        ])->find($id);

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

        $apkRequest = ApkRequest::with('status')->findOrFail($id);

        $allowed = in_array($apkRequest->status?->code, ['SUBMITTED', 'REVISED'], true);
        if (! $allowed) {
            abort(403, 'Request tidak bisa ditolak (status harus SUBMITTED atau REVISED)');
        }

        $apkRequest->setStatusByCode('REJECTED', (int)$user->id, $request->message);

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

        if (! $apkRequest->isStatus('APPROVED')) {
            abort(403, 'Request belum bisa diambil (status harus APPROVED)');
        }

        $apkRequest->setStatusByCode('PICKED_UP', (int)$user->id, 'Pesanan diambil kurir');

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

        if (! $apkRequest->isStatus('PICKED_UP')) {
            abort(403, 'Tidak bisa konfirmasi sampai (status harus PICKED_UP)');
        }

        $apkRequest->setStatusByCode('ARRIVED', (int)$user->id, 'Barang sampai tujuan');

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

        if (! $apkRequest->isStatus('ARRIVED') && ! $apkRequest->isStatus('PICKED_UP')) {
            abort(403, 'Tidak bisa konfirmasi diterima (status harus ARRIVED atau PICKED_UP)');
        }

        $apkRequest->setStatusByCode('DELIVERED', (int)$user->id, 'Barang diterima koordinator');

        return response()->json(['status' => true, 'message' => 'Barang sudah diterima']);
    }
}
