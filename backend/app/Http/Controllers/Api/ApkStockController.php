<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\ActivityLogger;
use App\Models\ApkStockTransaction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ApkStockController extends Controller
{
    private function roleName(User $user): ?string
    {
        $user->loadMissing('role');
        return $user->role?->role; // admin_apk / admin_paslon / apk_koordinator / apk_kurir
    }

    private function requireAdminApk(User $user)
    {
        $row = $user->adminApk;
        if (!$row) {
            abort(response()->json([
                'status' => false,
                'message' => 'Akun ini belum terdaftar sebagai Admin APK'
            ], 403));
        }
        return $row;
    }

    private function requireKoordinator(User $user)
    {
        $row = $user->apkKoordinator;
        if (!$row) {
            abort(response()->json([
                'status' => false,
                'message' => 'Akun ini belum terdaftar sebagai Koordinator APK'
            ], 403));
        }
        return $row;
    }

    private function requireKurir(User $user)
    {
        $row = $user->apkKurir;
        if (!$row) {
            abort(response()->json([
                'status' => false,
                'message' => 'Akun ini belum terdaftar sebagai Kurir APK'
            ], 403));
        }
        return $row;
    }

    private function requireAdminPaslon(User $user)
    {
        $row = $user->adminPaslon;
        if (!$row) {
            abort(response()->json([
                'status' => false,
                'message' => 'Admin paslon tidak ditemukan / tidak valid'
            ], 403));
        }
        return $row;
    }

    private function currentPaslonId(): int
    {
        $user = Auth::user();
        if (!$user) {
            abort(response()->json(['status' => false, 'message' => 'Unauthorized'], 401));
        }

        $role = $this->roleName($user);

        if ($role === 'admin_apk') {
            $admin = $this->requireAdminApk($user);
            if (!$admin->paslon_id) {
                abort(response()->json(['status' => false, 'message' => 'Paslon tidak ditemukan'], 403));
            }
            return (int) $admin->paslon_id;
        }

        if ($role === 'apk_koordinator') {
            $coor = $this->requireKoordinator($user);
            if (!$coor->paslon_id) {
                abort(response()->json(['status' => false, 'message' => 'Paslon tidak ditemukan'], 403));
            }
            return (int) $coor->paslon_id;
        }

        if ($role === 'apk_kurir') {
            $kurir = $this->requireKurir($user);
            if (!$kurir->paslon_id) {
                abort(response()->json(['status' => false, 'message' => 'Paslon tidak ditemukan'], 403));
            }
            return (int) $kurir->paslon_id;
        }

        if ($role === 'admin_paslon') {
            $ap = $this->requireAdminPaslon($user);
            if (!$ap->paslon_id) {
                abort(response()->json(['status' => false, 'message' => 'Paslon tidak ditemukan'], 403));
            }
            return (int) $ap->paslon_id;
        }

        abort(response()->json([
            'status' => false,
            'message' => 'Role tidak valid'
        ], 403));
    }

    public function history(Request $request)
    {
        $request->validate([
            'item_id' => 'nullable|integer',
            'type' => 'nullable|in:' . ApkStockTransaction::TYPE_IN . ',' . ApkStockTransaction::TYPE_OUT . ',' . ApkStockTransaction::TYPE_ADJUST,
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date|after_or_equal:date_from',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $paslonId = $this->currentPaslonId();
        $perPage = (int) ($request->per_page ?? 15);

        $q = ApkStockTransaction::query()
            ->where('paslon_id', (int) $paslonId);

        if ($request->filled('item_id')) {
            $q->where('item_id', (int) $request->item_id);
        }

        if ($request->filled('type')) {
            $q->where('type', (string) $request->type);
        }

        if ($request->filled('date_from')) {
            $q->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $q->whereDate('created_at', '<=', $request->date_to);
        }

        $q->with([
            'item:id,name,paslon_id',
            'creator:id,name,email',
            'coordinator:id,nama',
        ]);

        $rows = $q->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        $rows->getCollection()->transform(function (ApkStockTransaction $t) {
            $actorName = $t->type === ApkStockTransaction::TYPE_OUT
                ? ($t->coordinator?->nama ?? null)
                : ($t->creator?->name ?? null);

            return [
                'id' => $t->id,
                'paslon_id' => $t->paslon_id,
                'item_id' => $t->item_id,
                'type' => $t->type,
                'qty' => (string) $t->qty,
                'note' => $t->note,
                'total_cost' => $t->total_cost !== null ? (string) $t->total_cost : null,
                'created_by' => $t->created_by,
                'coordinator_id' => $t->coordinator_id,
                'created_at' => $t->created_at,

                'actor_name' => $actorName,

                'item' => $t->item,
                'creator' => $t->creator,
                'coordinator' => $t->coordinator,
            ];
        });

        return response()->json([
            'status' => true,
            'data' => $rows,
        ]);
    }

    public function stockIn(Request $request)
    {
        return $this->transaction($request, ApkStockTransaction::TYPE_IN);
    }

    public function stockOut(Request $request)
    {
        return $this->transaction($request, ApkStockTransaction::TYPE_OUT);
    }

    public function stockAdjust(Request $request)
    {
        return $this->transaction($request, ApkStockTransaction::TYPE_ADJUST);
    }

    private function transaction(Request $request, string $type)
    {
        $rules = [
            'item_id' => 'required|integer',
            'qty' => 'required|numeric|min:0.001',
            'note' => 'nullable|string|max:255',
        ];

        if ($type === ApkStockTransaction::TYPE_IN) {
            $rules['total_cost'] = 'nullable|numeric|min:0';
        }

        if ($type === ApkStockTransaction::TYPE_OUT) {
            $rules['coordinator_id'] = 'required|integer|exists:apk_koordinators,id';
        }

        $request->validate($rules);

        $user = Auth::user();
        if (!$user) {
            return response()->json(['status' => false, 'message' => 'Unauthorized'], 401);
        }

        $paslonId = $this->currentPaslonId();

        DB::transaction(function () use ($request, $user, $paslonId, $type) {
            $item = DB::table('apk_items')
                ->where('id', (int) $request->item_id)
                ->where('paslon_id', (int) $paslonId)
                ->lockForUpdate()
                ->first();

            if (!$item) {
                abort(response()->json([
                    'status' => false,
                    'message' => 'Item tidak ditemukan'
                ], 404));
            }

            $stockRow = DB::table('apk_item_stocks')
                ->where('item_id', (int) $request->item_id)
                ->lockForUpdate()
                ->first();

            $qtyBefore = (float) ($stockRow?->qty_current ?? 0);
            $budgetBefore = (float) ($stockRow?->budget_total ?? 0);

            $qty = (float) $request->qty;

            if ($type === ApkStockTransaction::TYPE_OUT && $qtyBefore < $qty) {
                abort(response()->json([
                    'status' => false,
                    'message' => 'Stock tidak cukup'
                ], 422));
            }

            $qtyAfter = match ($type) {
                ApkStockTransaction::TYPE_IN => $qtyBefore + $qty,
                ApkStockTransaction::TYPE_OUT => $qtyBefore - $qty,
                ApkStockTransaction::TYPE_ADJUST => $qty,
                default => abort(response()->json([
                    'status' => false,
                    'message' => 'Type tidak valid'
                ], 422)),
            };

            $budgetAdd = 0.0;
            if ($type === ApkStockTransaction::TYPE_IN) {
                $budgetAdd = $request->total_cost !== null
                    ? max(0.0, (float) $request->total_cost)
                    : 0.0;
            }

            $budgetAfter = $budgetBefore + $budgetAdd;

            DB::table('apk_stock_transactions')->insert([
                'paslon_id' => (int) $paslonId,
                'item_id' => (int) $request->item_id,
                'type' => $type,
                'qty' => $qty,
                'note' => $request->note,
                'total_cost' => ($type === ApkStockTransaction::TYPE_IN && $budgetAdd > 0) ? $budgetAdd : null,
                'created_by' => (int) $user->id,
                'coordinator_id' => $type === ApkStockTransaction::TYPE_OUT ? (int) $request->coordinator_id : null,
                'created_at' => now(),
            ]);

            DB::table('apk_item_stocks')->updateOrInsert(
                ['item_id' => (int) $request->item_id],
                [
                    'qty_current' => $qtyAfter,
                    'budget_total' => $budgetAfter,
                    'updated_at' => now(),
                ]
            );

            DB::table('apk_items')->where('id', (int) $request->item_id)->update([
                'stock' => $qtyAfter,
                'budget_total' => $budgetAfter,
                'updated_at' => now(),
            ]);

            ActivityLogger::log([
                'action' => 'CREATE',
                'target_type' => 'apk_stock',
                'target_name' => $item->name,
                'meta' => [
                    'item_id' => (int) $request->item_id,
                    'type' => $type,
                    'qty' => (string) $qty,
                    'qty_before' => (string) $qtyBefore,
                    'qty_after' => (string) $qtyAfter,
                    'budget_add' => (string) $budgetAdd,
                    'budget_before' => (string) $budgetBefore,
                    'budget_after' => (string) $budgetAfter,
                    'note' => $request->note,
                    'coordinator_id' => $type === ApkStockTransaction::TYPE_OUT ? (int) $request->coordinator_id : null,
                ],
                'paslon_id' => (int) $paslonId,
            ]);
        });

        return response()->json([
            'status' => true,
            'message' => "Transaksi stock {$type} berhasil",
        ]);
    }

    public function historyItem(Request $request, int $id)
    {
        $request->validate([
            'type' => 'nullable|in:' . ApkStockTransaction::TYPE_IN . ',' . ApkStockTransaction::TYPE_OUT . ',' . ApkStockTransaction::TYPE_ADJUST,
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date|after_or_equal:date_from',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $paslonId = $this->currentPaslonId();
        $perPage = (int) ($request->per_page ?? 15);

        $exists = DB::table('apk_items')
            ->where('id', (int) $id)
            ->where('paslon_id', (int) $paslonId)
            ->exists();

        if (!$exists) {
            return response()->json([
                'status' => false,
                'message' => 'Item tidak ditemukan'
            ], 404);
        }

        $q = ApkStockTransaction::query()
            ->where('paslon_id', (int) $paslonId)
            ->where('item_id', (int) $id);

        if ($request->filled('type')) {
            $q->where('type', (string) $request->type);
        }

        if ($request->filled('date_from')) {
            $q->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $q->whereDate('created_at', '<=', $request->date_to);
        }

        $q->with([
            'item:id,name,paslon_id',
            'creator:id,name,email',
            'coordinator:id,nama',
        ]);

        $rows = $q->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        $rows->getCollection()->transform(function (ApkStockTransaction $t) {
            $actorName = $t->type === ApkStockTransaction::TYPE_OUT
                ? ($t->coordinator?->nama ?? null)
                : ($t->creator?->name ?? null);

            return [
                'id' => $t->id,
                'paslon_id' => $t->paslon_id,
                'item_id' => $t->item_id,
                'type' => $t->type,
                'qty' => (string) $t->qty,
                'note' => $t->note,
                'total_cost' => $t->total_cost !== null ? (string) $t->total_cost : null,
                'created_by' => $t->created_by,
                'coordinator_id' => $t->coordinator_id,
                'created_at' => $t->created_at,

                'actor_name' => $actorName,

                'item' => $t->item,
                'creator' => $t->creator,
                'coordinator' => $t->coordinator,
            ];
        });

        return response()->json([
            'status' => true,
            'data' => $rows,
        ]);
    }
}
