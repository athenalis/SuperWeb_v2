<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApkItem;
use App\Models\ApkItemStock;
use App\Models\ApkStockTransaction;
use App\Models\History;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApkStockController extends Controller
{
    private function ensureAdminApk(Request $request): void
    {
        if (!$request->user() || (int) $request->user()->role_id !== 3) {
            abort(403, 'Forbidden');
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
        $adminApk = $user?->adminApk;

        if (!$adminApk || !$adminApk->paslon_id) {
            abort(403, 'Admin APK belum terhubung ke paslon.');
        }

        return (int) $adminApk->paslon_id;
    }

    public function stockIn(Request $request)
    {
        $this->ensureAdminApk($request);

        $paslonId = $this->paslonId($request);

        $data = $request->validate([
            'item_id' => 'required|integer|exists:apk_items,id',
            'qty' => 'required|numeric|gt:0',
            'total_cost' => 'nullable|numeric|min:0',
            'note' => 'nullable|string|max:255',
        ]);

        $qty  = (float) $data['qty'];
        $cost = (float) ($data['total_cost'] ?? 0);

        return DB::transaction(function () use ($request, $data, $qty, $cost, $paslonId) {

            $item = ApkItem::lockForUpdate()->findOrFail($data['item_id']);

            if ((int) $item->paslon_id !== (int) $paslonId) {
                abort(403, 'Item ini bukan milik paslon kamu.');
            }

            $beforeStock  = (float) $item->stock;
            $beforeBudget = (float) $item->budget_total;

            ApkStockTransaction::create([
                'paslon_id' => $item->paslon_id,
                'item_id' => $item->id,
                'type' => 'IN',
                'qty' => $qty,
                'total_cost' => $cost,
                'note' => $data['note'] ?? null,
                'created_by' => $request->user()->id,
                'created_at' => now(),
            ]);

            $item->update([
                'stock' => $beforeStock + $qty,
                'budget_total' => $beforeBudget + $cost,
            ]);

            $stock = ApkItemStock::firstOrCreate(
                ['item_id' => $item->id],
                ['qty_current' => 0, 'budget_total' => 0]
            );

            $stock->update([
                'qty_current' => (float) $stock->qty_current + $qty,
                'budget_total' => (float) $stock->budget_total + $cost,
            ]);

            History::create([
                'user_id' => $request->user()->id,
                'role' => $this->roleSlug($request),
                'action' => 'STOCK_IN',
                'target_type' => 'apk_stock',
                'target_name' => $item->name,
                'field' => 'apk_stock',
                'meta' => [
                    'paslon_id' => $paslonId,
                    'item_id' => $item->id,
                    'qty_added' => $qty,
                    'cost_added' => $cost,
                    'stock_before' => $beforeStock,
                    'stock_after' => (float) $item->stock,
                    'budget_before' => $beforeBudget,
                    'budget_after' => (float) $item->budget_total,
                    'note' => $data['note'] ?? null,
                ],
                'paslon_id' => $paslonId,
            ]);

            return response()->json([
                'message' => 'Stock added',
                'data' => $item
            ], 201);
        });
    }
}
