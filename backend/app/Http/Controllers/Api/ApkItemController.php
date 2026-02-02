<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApkItem;
use App\Models\ApkItemStock;
use App\Models\ApkStockTransaction;
use App\Models\History;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApkItemController extends Controller
{
    private function ensureAdminApk(Request $request): void
    {
        if (!$request->user() || (int) $request->user()->role_id !== 3) {
            abort(403, 'Forbidden: only admin_apk can access this.');
        }
    }

    private function roleSlug(Request $request): string
    {
        $slug = DB::table('roles')->where('id', $request->user()->role_id)->value('role');
        if (!$slug) abort(500, 'Role slug not found in roles table.');
        return (string) $slug;
    }

    private function paslonId(Request $request): int
    {
        $user = $request->user();
        $adminApk = $user?->adminApk; // relasi: User::adminApk()

        if (!$adminApk || !$adminApk->paslon_id) {
            abort(403, 'Admin APK belum terhubung ke paslon.');
        }

        return (int) $adminApk->paslon_id;
    }

    public function index(Request $request)
    {
        $this->ensureAdminApk($request);

        $paslonId = $this->paslonId($request);

        return response()->json([
            'data' => ApkItem::with(['bentuk', 'unit'])
                ->where('is_active', 1)
                ->where('paslon_id', $paslonId)
                ->orderByDesc('id')
                ->paginate(20)
        ]);
    }

    public function store(Request $request)
    {
        $this->ensureAdminApk($request);

        $data = $request->validate([
            'bentuk_id' => 'required|integer|exists:apk_bentuks,id',
            'unit_id'   => 'required|integer|exists:units,id',
            'name'      => 'required|string|max:180',

            'initial_stock'  => 'nullable|numeric|min:0',
            'initial_budget' => 'nullable|numeric|min:0',

            'budget_note' => 'nullable|string|max:255',
            'description' => 'nullable|string',
        ]);

        $initialStock  = (float) ($data['initial_stock'] ?? 0);
        $initialBudget = (float) ($data['initial_budget'] ?? 0);

        return DB::transaction(function () use ($request, $data, $initialStock, $initialBudget) {

            $paslonId = $this->paslonId($request);

            $item = ApkItem::create([
                'paslon_id' => $paslonId,
                'bentuk_id' => $data['bentuk_id'],
                'unit_id'   => $data['unit_id'],
                'name'      => $data['name'],

                // ⚠️ HAPUS user_id karena kolomnya tidak ada di tabel apk_items
                // 'user_id' => $request->user()->id,

                'stock' => $initialStock,
                'budget_total' => $initialBudget,

                'budget_note' => $data['budget_note'] ?? null,
                'description' => $data['description'] ?? null,
                'is_active' => 1,
            ]);

            // sync stock summary
            ApkItemStock::updateOrCreate(
                ['item_id' => $item->id],
                ['qty_current' => $initialStock, 'budget_total' => $initialBudget]
            );

            // catat initial stock sebagai transaksi IN
            if ($initialStock > 0 || $initialBudget > 0) {
                ApkStockTransaction::create([
                    'paslon_id' => $item->paslon_id,
                    'item_id' => $item->id,
                    'type' => 'IN',
                    'qty' => $initialStock,
                    'total_cost' => $initialBudget,
                    'note' => 'Initial stock',
                    'created_by' => $request->user()->id,
                    'created_at' => now(),
                ]);
            }

            // HISTORY
            History::create([
                'user_id' => $request->user()->id,
                'role' => $this->roleSlug($request),
                'action' => 'CREATE',
                'target_type' => 'apk_item',
                'target_name' => $item->name,
                'field' => 'apk_item',
                'meta' => [
                    'paslon_id' => $paslonId,
                    'item_id' => $item->id,
                    'bentuk_id' => $item->bentuk_id,
                    'unit_id' => $item->unit_id,
                    'initial_stock' => $initialStock,
                    'initial_budget' => $initialBudget,
                ],
                'paslon_id' => $paslonId,
            ]);

            return response()->json(['data' => $item], 201);
        });
    }

    public function update(Request $request, ApkItem $apkItem)
    {
        $this->ensureAdminApk($request);

        $paslonId = $this->paslonId($request);
        if ((int) $apkItem->paslon_id !== (int) $paslonId) {
            abort(403, 'Item ini bukan milik paslon kamu.');
        }

        $data = $request->validate([
            'bentuk_id' => 'sometimes|integer|exists:apk_bentuks,id',
            'unit_id'   => 'sometimes|integer|exists:units,id',
            'name'      => 'sometimes|string|max:180',
            'budget_note' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        return DB::transaction(function () use ($request, $apkItem, $data, $paslonId) {

            $before = $apkItem->toArray();
            $apkItem->update($data);

            History::create([
                'user_id' => $request->user()->id,
                'role' => $this->roleSlug($request),
                'action' => 'UPDATE',
                'target_type' => 'apk_item',
                'target_name' => $apkItem->name,
                'field' => 'apk_item',
                'meta' => [
                    'paslon_id' => $paslonId,
                    'before' => $before,
                    'after' => $apkItem->toArray(),
                ],
                'paslon_id' => $paslonId,
            ]);

            return response()->json(['data' => $apkItem]);
        });
    }

    public function destroy(Request $request, ApkItem $apkItem)
    {
        $this->ensureAdminApk($request);

        return DB::transaction(function () use ($request, $apkItem) {

            $paslonId = $this->paslonId($request);
            if ((int) $apkItem->paslon_id !== (int) $paslonId) {
                abort(403, 'Item ini bukan milik paslon kamu.');
            }

            $apkItem->update(['is_active' => 0]);

            History::create([
                'user_id' => $request->user()->id,
                'role' => $this->roleSlug($request),
                'action' => 'DELETE',
                'target_type' => 'apk_item',
                'target_name' => $apkItem->name,
                'field' => 'apk_item',
                'meta' => [
                    'paslon_id' => $paslonId,
                    'item_id' => $apkItem->id
                ],
                'paslon_id' => $paslonId,
            ]);

            return response()->json(['message' => 'Item deleted']);
        });
    }
}
