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

    public function index(Request $request)
    {
        $this->ensureAdminApk($request);

        $paslonId = $this->paslonId($request);

        $q = ApkBentuk::query()
            ->orderBy('category')
            ->orderBy('name');

        if ($request->filled('category')) {
            $q->where('category', $request->category);
        }

        if ($request->filled('active')) {
            $q->where('is_active', (int) $request->active);
        }

        $data = $q->get();

        History::create([
            'user_id' => $request->user()->id,
            'role' => $this->roleSlug($request),
            'action' => 'READ',
            'target_type' => 'apk_bentuk',
            'target_name' => 'list',
            'field' => 'apk_bentuk',
            'meta' => [
                'paslon_id' => $paslonId,
                'filters' => [
                    'category' => $request->query('category'),
                    'active' => $request->query('active'),
                ],
                'count' => $data->count(),
            ],
            'paslon_id' => $paslonId,
        ]);

        return response()->json(['data' => $data]);
    }

    public function store(Request $request)
    {
        $this->ensureAdminApk($request);

        $paslonId = $this->paslonId($request);

        $data = $request->validate([
            'category' => 'required|in:apk,bahan_kampanye',
            'name' => 'required|string|max:120',
        ]);

        return DB::transaction(function () use ($request, $data, $paslonId) {

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
                'role' => $this->roleSlug($request),
                'action' => 'CREATE',
                'target_type' => 'apk_bentuk',
                'target_name' => $bentuk->name,
                'field' => 'apk_bentuk',
                'meta' => [
                    'paslon_id' => $paslonId,
                    'bentuk_id' => $bentuk->id,
                    'category' => $bentuk->category,
                    'name' => $bentuk->name,
                    'is_active' => $bentuk->is_active,
                ],
                'paslon_id' => $paslonId,
            ]);

            return response()->json(['data' => $bentuk], 201);
        });
    }

    public function update(Request $request, $id)
    {
        $this->ensureAdminApk($request);

        $paslonId = $this->paslonId($request);

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'is_active' => 'nullable|boolean',
        ]);

        return DB::transaction(function () use ($request, $id, $data, $paslonId) {

            $bentuk = ApkBentuk::lockForUpdate()->findOrFail($id);
            $before = $bentuk->toArray();

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
                $bentuk->is_active = (int) $data['is_active'];
            }

            $bentuk->save();

            History::create([
                'user_id' => $request->user()->id,
                'role' => $this->roleSlug($request),
                'action' => 'UPDATE',
                'target_type' => 'apk_bentuk',
                'target_name' => $bentuk->name,
                'field' => 'apk_bentuk',
                'old_value' => $before['name'] ?? null,
                'new_value' => $bentuk->name,
                'meta' => [
                    'paslon_id' => $paslonId,
                    'bentuk_id' => $bentuk->id,
                    'before' => $before,
                    'after' => $bentuk->toArray(),
                    'note' => 'category is immutable',
                ],
                'paslon_id' => $paslonId,
            ]);

            return response()->json(['data' => $bentuk]);
        });
    }

    public function destroy(Request $request, $id)
    {
        $this->ensureAdminApk($request);

        $paslonId = $this->paslonId($request);

        return DB::transaction(function () use ($request, $id, $paslonId) {

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
                    'role' => $this->roleSlug($request),
                    'action' => 'DISABLE',
                    'target_type' => 'apk_bentuk',
                    'target_name' => $bentuk->name,
                    'field' => 'apk_bentuk',
                    'old_value' => 1,
                    'new_value' => 0,
                    'meta' => [
                        'paslon_id' => $paslonId,
                        'bentuk_id' => $bentuk->id,
                        'before' => $before,
                        'after' => $bentuk->toArray(),
                        'reason' => 'still used by active items',
                    ],
                    'paslon_id' => $paslonId,
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
                'role' => $this->roleSlug($request),
                'action' => 'DELETE',
                'target_type' => 'apk_bentuk',
                'target_name' => $name,
                'field' => 'apk_bentuk',
                'meta' => [
                    'paslon_id' => $paslonId,
                    'bentuk_id' => $id,
                    'before' => $before,
                ],
                'paslon_id' => $paslonId,
            ]);

            return response()->json(['message' => 'Bentuk deleted.']);
        });
    }
}
