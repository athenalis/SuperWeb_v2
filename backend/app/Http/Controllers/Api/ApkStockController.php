<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class ApkStockController extends Controller
{
    private function adminApkPaslonId(int $userId): ?int
    {
        $paslonId = DB::table('admin_apks')
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->value('paslon_id');

        return $paslonId ? (int)$paslonId : null;
    }

    public function stockIn(Request $request)
    {
        return $this->transaction($request, 'IN');
    }

    public function stockOut(Request $request)
    {
        return $this->transaction($request, 'OUT');
    }

    public function stockAdjust(Request $request)
    {
        return $this->transaction($request, 'ADJUST');
    }

    private function transaction(Request $request, string $type)
    {
        $rules = [
            'item_id' => 'required|integer',
            'qty' => 'required|numeric|min:0.001',
            'note' => 'nullable|string|max:255',
        ];

        // total_cost cuma relevan untuk IN (budget bertambah)
        if ($type === 'IN') {
            $rules['total_cost'] = 'nullable|numeric|min:0';
        }

        $request->validate($rules);

        $user = auth()->user();
        $paslonId = $this->adminApkPaslonId($user->id);
        if (!$paslonId) {
            return response()->json(['status'=>false,'message'=>'Paslon tidak ditemukan'], 403);
        }

        DB::transaction(function () use ($request, $user, $paslonId, $type) {

            $item = DB::table('apk_items')
                ->where('id', $request->item_id)
                ->where('paslon_id', $paslonId)
                ->lockForUpdate()
                ->first();

            if (!$item) abort(404, 'Item tidak ditemukan');

            $stockRow = DB::table('apk_item_stocks')
                ->where('item_id', $request->item_id)
                ->lockForUpdate()
                ->first();

            $qtyBefore = (float)($stockRow?->qty_current ?? 0);
            $budgetBefore = (float)($stockRow?->budget_total ?? 0);

            $qty = (float)$request->qty;

            if ($type === 'OUT' && $qtyBefore < $qty) {
                abort(422, 'Stock tidak cukup');
            }

            $qtyAfter = match ($type) {
                'IN' => $qtyBefore + $qty,
                'OUT' => $qtyBefore - $qty,
                'ADJUST' => $qty, // set langsung
                default => abort(422, 'Type tidak valid'),
            };

            // budget bertambah hanya saat IN
            $budgetAdd = 0.0;
            if ($type === 'IN') {
                $budgetAdd = $request->total_cost !== null ? max(0.0, (float)$request->total_cost) : 0.0;
            }

            $budgetAfter = $budgetBefore + $budgetAdd;

            // 1) simpan transaksi
            DB::table('apk_stock_transactions')->insert([
                'paslon_id' => $paslonId,
                'item_id' => $request->item_id,
                'type' => $type,
                'qty' => $qty,
                'note' => $request->note,
                'total_cost' => ($type === 'IN' && $budgetAdd > 0) ? $budgetAdd : null,
                'created_by' => $user->id,
                'created_at' => now(),
            ]);

            // 2) update ringkasan
            DB::table('apk_item_stocks')->updateOrInsert(
                ['item_id' => $request->item_id],
                [
                    'qty_current' => $qtyAfter,
                    'budget_total' => $budgetAfter,
                    'updated_at' => now(),
                ]
            );

            // 3) sync ke apk_items (ini yang kamu minta: stock & budget berubah)
            DB::table('apk_items')->where('id', $request->item_id)->update([
                'stock' => $qtyAfter,
                'budget_total' => $budgetAfter,
                'updated_at' => now(),
            ]);

            // 4) history transaksi
            ActivityLogger::log([
                'action' => 'CREATE',
                'target_type' => 'apk_stock',
                'target_name' => $item->name,
                'meta' => [
                    'item_id' => $request->item_id,
                    'type' => $type,
                    'qty' => (string)$qty,
                    'qty_before' => (string)$qtyBefore,
                    'qty_after' => (string)$qtyAfter,
                    'budget_add' => (string)$budgetAdd,
                    'budget_before' => (string)$budgetBefore,
                    'budget_after' => (string)$budgetAfter,
                    'note' => $request->note,
                ],
                'paslon_id' => (int)$paslonId,
            ]);
        });

        return response()->json([
            'status' => true,
            'message' => "Transaksi stock {$type} berhasil",
        ]);
    }
}
