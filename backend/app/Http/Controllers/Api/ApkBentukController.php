<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApkBentuk;
use App\Models\ApkItem;
use App\Models\History;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApkBentukController extends Controller
{
    public function index(Request $request)
    {
        $q = ApkBentuk::query()
            ->orderBy('category')
            ->orderBy('name');

        if ($request->filled('category')) {
            $q->where('category', $request->category);
        }

        if ($request->filled('active')) {
            $q->where('is_active', (int)$request->active);
        }

        $data = $q->get();

        // HISTORY (log akses list)
        History::create([
            'user_id' => $request->user()->id,
            'role' => (string)$request->user()->role_id,
            'action' => 'READ',
            'target_type' => 'apk_bentuk',
            'target_name' => 'list',
            'meta' => [
                'filters' => [
                    'category' => $request->query('category'),
                    'active' => $request->query('active'),
                ],
                'count' => $data->count(),
            ]
        ]);

        return response()->json(['data' => $data]);
    }

    /**
     * CREATE BENTUK
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'category' => 'required|in:apk,bahan_kampanye',
            'name' => 'required|string|max:120',
        ]);

        return DB::transaction(function () use ($request, $data) {

            // cegah duplikat (category + name)
            $dup = ApkBentuk::where('category', $data['category'])
                ->where('name', $data['name'])
                ->exists();

            if ($dup) {
                return response()->json([
                    'message' => 'Bentuk sudah ada untuk kategori ini.'
                ], 409);
            }

            $bentuk = ApkBentuk::create([
                'category' => $data['category'],
                'name' => $data['name'],
                'is_active' => 1,
            ]);

            History::create([
                'user_id' => $request->user()->id,
                'role' => (string)$request->user()->role_id,
                'action' => 'CREATE',
                'target_type' => 'apk_bentuk',
                'target_name' => $bentuk->name,
                'meta' => [
                    'bentuk_id' => $bentuk->id,
                    'category' => $bentuk->category,
                    'name' => $bentuk->name,
                    'is_active' => $bentuk->is_active,
                ]
            ]);

            return response()->json(['data' => $bentuk], 201);
        });
    }

    /**
     * UPDATE BENTUK
     * category tidak boleh diubah
     */
    public function update(Request $request, $id)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'is_active' => 'nullable|boolean',
        ]);

        return DB::transaction(function () use ($request, $id, $data) {

            $bentuk = ApkBentuk::lockForUpdate()->findOrFail($id);
            $before = $bentuk->toArray();

            // cek duplikat name pada category yg sama
            $dup = ApkBentuk::where('category', $bentuk->category)
                ->where('name', $data['name'])
                ->where('id', '!=', $bentuk->id)
                ->exists();

            if ($dup) {
                return response()->json([
                    'message' => 'Nama bentuk sudah dipakai di kategori ini.'
                ], 409);
            }

            $bentuk->name = $data['name'];

            if (array_key_exists('is_active', $data)) {
                $bentuk->is_active = (int)$data['is_active'];
            }

            $bentuk->save();

            History::create([
                'user_id' => $request->user()->id,
                'role' => (string)$request->user()->role_id,
                'action' => 'UPDATE',
                'target_type' => 'apk_bentuk',
                'target_name' => $bentuk->name,
                'meta' => [
                    'bentuk_id' => $bentuk->id,
                    'before' => $before,
                    'after' => $bentuk->toArray(),
                    'note' => 'category is immutable',
                ]
            ]);

            return response()->json(['data' => $bentuk]);
        });
    }

    /**
     * DELETE BENTUK
     * - kalau masih dipakai item aktif => disable (is_active=0)
     * - kalau tidak dipakai => hard delete
     */
    public function destroy(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {

            $bentuk = ApkBentuk::lockForUpdate()->findOrFail($id);

            $used = ApkItem::where('bentuk_id', $bentuk->id)
                ->where('is_active', 1)
                ->exists();

            if ($used) {
                $before = $bentuk->toArray();

                $bentuk->is_active = 0;
                $bentuk->save();

                History::create([
                    'user_id' => $request->user()->id,
                    'role' => (string)$request->user()->role_id,
                    'action' => 'DISABLE',
                    'target_type' => 'apk_bentuk',
                    'target_name' => $bentuk->name,
                    'meta' => [
                        'bentuk_id' => $bentuk->id,
                        'before' => $before,
                        'after' => $bentuk->toArray(),
                        'reason' => 'still used by active items',
                    ]
                ]);

                return response()->json([
                    'message' => 'Bentuk masih dipakai item. Dinonaktifkan (is_active=0).',
                    'data' => $bentuk
                ]);
            }

            $name = $bentuk->name;
            $before = $bentuk->toArray();

            $bentuk->delete();

            History::create([
                'user_id' => $request->user()->id,
                'role' => (string)$request->user()->role_id,
                'action' => 'DELETE',
                'target_type' => 'apk_bentuk',
                'target_name' => $name,
                'meta' => [
                    'bentuk_id' => $id,
                    'before' => $before,
                ]
            ]);

            return response()->json(['message' => 'Bentuk deleted.']);
        });
    }
}
