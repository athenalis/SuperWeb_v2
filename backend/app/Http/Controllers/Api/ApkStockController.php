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
        if (!$request->user() || (int)$request->user()->role_id !== 3) {
            abort(403, 'Forbidden');
        }
    }

    public function stockIn(Request $request)
    {
        $this->ensureAdminApk($request);

        $data = $request->validate([
            'item_id' => 'required|integer',
            'qty' => 'required|numeric|gt:0',
            'total_cost' => 'nullable|numeric|min:0',
            'note' => 'nullable|string|max:255',
        ]);

        $qty  = (float)$data['qty'];
        $cost = (float)($data['total_cost'] ?? 0);

        return DB::transaction(function () use ($request, $data, $qty, $cost) {

            $item = ApkItem::lockForUpdate()->findOrFail($data['item_id']);

            $beforeStock = (float)$item->stock;
            $beforeBudget = (float)$item->budget_total;

            // TRANSAKSI
            $tx = ApkStockTransaction::create([
                'paslon_id' => $item->paslon_id,
                'item_id' => $item->id,
                'type' => 'IN',
                'qty' => $qty,
                'total_cost' => $cost,
                'note' => $data['note'] ?? null,
                'created_by' => $request->user()->id,
                'created_at' => now(),
            ]);

            // UPDATE ITEM
            $item->update([
                'stock' => $beforeStock + $qty,
                'budget_total' => $beforeBudget + $cost,
            ]);

            // SYNC SUMMARY
            $stock = ApkItemStock::firstOrCreate(
                ['item_id' => $item->id],
                ['qty_current' => 0, 'budget_total' => 0]
            );

            $stock->update([
                'qty_current' => (float)$stock->qty_current + $qty,
                'budget_total' => (float)$stock->budget_total + $cost,
            ]);

            // HISTORY
            History::create([
                'user_id' => $request->user()->id,
                'role' => (string)$request->user()->role_id,
                'action' => 'STOCK_IN',
                'target_type' => 'apk_stock',
                'target_name' => $item->name,
                'meta' => [
                    'qty_added' => $qty,
                    'cost_added' => $cost,
                    'stock_before' => $beforeStock,
                    'stock_after' => $item->stock,
                ]
            ]);

            return response()->json([
                'message' => 'Stock added',
                'data' => $item
            ], 201);
        });
    }
}
