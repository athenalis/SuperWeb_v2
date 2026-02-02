<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\ActivityLogger;
use App\Models\ApkItem;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ApkItemController extends Controller
{
    private function adminApkPaslonId(int $userId): ?int
    {
        $paslonId = DB::table('admin_apks')
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->value('paslon_id');

        return $paslonId ? (int)$paslonId : null;
    }

    public function index(Request $request)
    {
        /** @var User|null $user */
        $user = Auth::user();
        if (!$user) {
            return response()->json(['status' => false, 'message' => 'Unauthorized'], 401);
        }

        $paslonId = $this->adminApkPaslonId($user->id);
        if (!$paslonId) {
            return response()->json(['status' => false, 'message' => 'Paslon tidak ditemukan'], 403);
        }

        $query = ApkItem::query()
            ->where('paslon_id', $paslonId)
            ->with(['bentuk:id,name,category', 'unit:id,name,symbol', 'stock:item_id,qty_current,budget_total'])
            ->orderByDesc('id');

        if ($request->filled('is_active')) {
            $query->where('is_active', (int)$request->is_active);
        }
        if ($request->filled('bentuk_id')) {
            $query->where('bentuk_id', (int)$request->bentuk_id);
        }
        if ($request->filled('search')) {
            $kw = $request->search;
            $query->where('name', 'like', "%{$kw}%");
        }

        return response()->json([
            'status' => true,
            'data' => $query->get(),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'bentuk_id' => 'required|integer|exists:apk_bentuks,id',
            'name' => 'required|string|max:180',
            'unit_id' => 'required|integer|exists:units,id',
            'stock' => 'nullable|numeric|min:0',
            'budget_total' => 'nullable|numeric|min:0',
            'budget_note' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        /** @var User|null $user */
        $user = Auth::user();
        if (!$user) {
            return response()->json(['status' => false, 'message' => 'Unauthorized'], 401);
        }

        $paslonId = $this->adminApkPaslonId($user->id);
        if (!$paslonId) {
            return response()->json(['status' => false, 'message' => 'Paslon tidak ditemukan'], 403);
        }

        $item = DB::transaction(function () use ($request, $user, $paslonId) {
            $stock = $request->has('stock') ? (float)$request->stock : 0;
            $budget = $request->has('budget_total') ? (float)$request->budget_total : 0;

            $item = ApkItem::create([
                'paslon_id' => $paslonId,
                'bentuk_id' => $request->bentuk_id,
                'name' => $request->name,
                'unit_id' => $request->unit_id,
                'user_id' => $user->id,
                'stock' => $stock,                 // default 0
                'budget_total' => $budget,          // default 0
                'budget_note' => $request->budget_note,
                'description' => $request->description,
                'is_active' => $request->boolean('is_active', true),
            ]);

            DB::table('apk_item_stocks')->updateOrInsert(
                ['item_id' => $item->id],
                [
                    'qty_current' => $stock,
                    'budget_total' => $budget,
                    'updated_at' => now(),
                ]
            );

            ActivityLogger::log([
                'action' => 'CREATE',
                'target_type' => 'apk_item',
                'target_name' => $item->name,
                'meta' => [
                    'item_id' => $item->id,
                    'stock_awal' => (string)$stock,
                    'budget_awal' => (string)$budget,
                ],
                'paslon_id' => (int)$paslonId,
            ]);

            return $item;
        });

        $item->load(['bentuk:id,name,category', 'unit:id,name,symbol', 'stock:item_id,qty_current,budget_total']);

        return response()->json([
            'status' => true,
            'message' => 'Barang berhasil ditambahkan',
            'data' => $item,
        ], 201);
    }

    public function update(Request $request, ApkItem $apkItem)
    {
        $request->validate([
            'bentuk_id' => 'nullable|integer|exists:apk_bentuks,id',
            'name' => 'nullable|string|max:180',
            'unit_id' => 'nullable|integer|exists:units,id',
            'budget_note' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            // sengaja tidak izinkan update stock/budget_total di sini (biar lewat transaksi)
        ]);

        /** @var User|null $user */
        $user = Auth::user();
        if (!$user) {
            return response()->json(['status' => false, 'message' => 'Unauthorized'], 401);
        }

        $paslonId = $this->adminApkPaslonId($user->id);
        if (!$paslonId) {
            return response()->json(['status' => false, 'message' => 'Paslon tidak ditemukan'], 403);
        }

        if ((int)$apkItem->paslon_id !== (int)$paslonId) {
            return response()->json(['status' => false, 'message' => 'Forbidden'], 403);
        }

        $old = $apkItem->getAttributes();

        $apkItem->fill($request->only(['bentuk_id','name','unit_id','budget_note','description','is_active']));
        $apkItem->save();

        foreach (['bentuk_id','name','unit_id','budget_note','description','is_active'] as $field) {
            if (array_key_exists($field, $request->all()) && (string)($old[$field] ?? '') !== (string)($apkItem->$field ?? '')) {
                ActivityLogger::log([
                    'action' => 'UPDATE',
                    'target_type' => 'apk_item',
                    'target_name' => $apkItem->name,
                    'field' => $field,
                    'old_value' => $old[$field] ?? null,
                    'new_value' => $apkItem->$field,
                    'paslon_id' => (int)$paslonId,
                ]);
            }
        }

        $apkItem->load(['bentuk:id,name,category', 'unit:id,name,symbol', 'stock:item_id,qty_current,budget_total']);

        return response()->json([
            'status' => true,
            'message' => 'Barang berhasil diperbarui',
            'data' => $apkItem,
        ]);
    }

    public function destroy(ApkItem $apkItem)
    {
        /** @var User|null $user */
        $user = Auth::user();
        if (!$user) {
            return response()->json(['status' => false, 'message' => 'Unauthorized'], 401);
        }

        $paslonId = $this->adminApkPaslonId($user->id);
        if (!$paslonId) {
            return response()->json(['status' => false, 'message' => 'Paslon tidak ditemukan'], 403);
        }

        if ((int)$apkItem->paslon_id !== (int)$paslonId) {
            return response()->json(['status' => false, 'message' => 'Forbidden'], 403);
        }

        $apkItem->is_active = false;
        $apkItem->save();

        ActivityLogger::log([
            'action' => 'DELETE',
            'target_type' => 'apk_item',
            'target_name' => $apkItem->name,
            'meta' => ['hard_delete' => false, 'item_id' => $apkItem->id],
            'paslon_id' => (int)$paslonId,
        ]);

        return response()->json([
            'status' => true,
            'message' => 'Barang berhasil dinonaktifkan',
        ]);
    }
}
