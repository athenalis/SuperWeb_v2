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
        if (!$request->user() || (int)$request->user()->role_id !== 3) {
            abort(403, 'Forbidden: only admin_apk can access this.');
        }
    }

    public function index(Request $request)
    {
        $this->ensureAdminApk($request);

        return response()->json([
            'data' => ApkItem::with(['bentuk','unit'])
                ->where('is_active', 1)
                ->orderByDesc('id')
                ->paginate(20)
        ]);
    }

    public function store(Request $request)
    {
        $this->ensureAdminApk($request);

        $data = $request->validate([
            'paslon_id' => 'required|integer',
            'bentuk_id' => 'required|integer',
            'unit_id'   => 'required|integer',
            'name'      => 'required|string|max:180',

            'initial_stock'  => 'nullable|numeric|min:0',
            'initial_budget' => 'nullable|numeric|min:0',

            'budget_note' => 'nullable|string|max:255',
            'description' => 'nullable|string',
        ]);

        $initialStock  = (float)($data['initial_stock'] ?? 0);
        $initialBudget = (float)($data['initial_budget'] ?? 0);

        return DB::transaction(function () use ($request, $data, $initialStock, $initialBudget) {

            $item = ApkItem::create([
                'paslon_id' => $data['paslon_id'],
                'bentuk_id' => $data['bentuk_id'],
                'unit_id'   => $data['unit_id'],
                'name'      => $data['name'],
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

            // kalau ada stock awal → catat sebagai transaksi IN
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
                'role' => (string)$request->user()->role_id,
                'action' => 'CREATE',
                'target_type' => 'apk_item',
                'target_name' => $item->name,
                'meta' => [
                    'item_id' => $item->id,
                    'initial_stock' => $initialStock,
                    'initial_budget' => $initialBudget,
                ]
            ]);

            return response()->json(['data' => $item], 201);
        });
    }

    public function update(Request $request, ApkItem $apkItem)
    {
        $this->ensureAdminApk($request);

        $data = $request->validate([
            'bentuk_id' => 'sometimes|integer',
            'unit_id'   => 'sometimes|integer',
            'name'      => 'sometimes|string|max:180',
            'budget_note' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        return DB::transaction(function () use ($request, $apkItem, $data) {

            $before = $apkItem->toArray();
            $apkItem->update($data);

            History::create([
                'user_id' => $request->user()->id,
                'role' => (string)$request->user()->role_id,
                'action' => 'UPDATE',
                'target_type' => 'apk_item',
                'target_name' => $apkItem->name,
                'meta' => [
                    'before' => $before,
                    'after' => $apkItem->toArray(),
                ]
            ]);

            return response()->json(['data' => $apkItem]);
        });
    }

    public function destroy(Request $request, ApkItem $apkItem)
    {
        $this->ensureAdminApk($request);

        return DB::transaction(function () use ($request, $apkItem) {

            $apkItem->update(['is_active' => 0]);

            History::create([
                'user_id' => $request->user()->id,
                'role' => (string)$request->user()->role_id,
                'action' => 'DELETE',
                'target_type' => 'apk_item',
                'target_name' => $apkItem->name,
                'meta' => ['item_id' => $apkItem->id]
            ]);

            return response()->json(['message' => 'Item deleted']);
        });
    }
}
