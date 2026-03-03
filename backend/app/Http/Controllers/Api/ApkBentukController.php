<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\ActivityLogger;
use App\Models\ApkBentuk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApkBentukController extends Controller
{
    public function index(Request $request)
    {
        $query = ApkBentuk::query()->orderByDesc('id');

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }
        if ($request->filled('is_active')) {
            $query->where('is_active', (int)$request->is_active);
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
            'category' => 'required|in:apk,bahan_kampanye',
            'name' => 'required|string|max:120',
            'is_active' => 'nullable|boolean',
        ]);

        $bentuk = ApkBentuk::create([
            'category' => $request->category,
            'name' => $request->name,
            'is_active' => $request->boolean('is_active', true),
        ]);

        ActivityLogger::log([
            'action' => 'CREATE',
            'target_type' => 'apk_bentuk',
            'target_name' => $bentuk->name,
            'meta' => [
                'category' => $bentuk->category,
                'is_active' => $bentuk->is_active ? 1 : 0,
            ],
        ]);

        return response()->json([
            'status' => true,
            'message' => 'Bentuk berhasil ditambahkan',
            'data' => $bentuk,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'category' => 'nullable|in:apk,bahan_kampanye',
            'name' => 'nullable|string|max:120',
            'is_active' => 'nullable|boolean',
        ]);

        $bentuk = ApkBentuk::findOrFail($id);
        $old = $bentuk->getAttributes();

        $bentuk->fill($request->only(['category','name','is_active']));
        $bentuk->save();

        foreach (['category','name','is_active'] as $field) {
            if (array_key_exists($field, $request->all()) && (string)($old[$field] ?? '') !== (string)($bentuk->$field ?? '')) {
                ActivityLogger::log([
                    'action' => 'UPDATE',
                    'target_type' => 'apk_bentuk',
                    'target_name' => $bentuk->name,
                    'field' => $field,
                    'old_value' => $old[$field] ?? null,
                    'new_value' => $bentuk->$field,
                ]);
            }
        }

        return response()->json([
            'status' => true,
            'message' => 'Bentuk berhasil diperbarui',
            'data' => $bentuk,
        ]);
    }

    public function destroy($id)
    {
        $bentuk = ApkBentuk::findOrFail($id);

        $bentuk->is_active = false;
        $bentuk->save();

        ActivityLogger::log([
            'action' => 'DELETE',
            'target_type' => 'apk_bentuk',
            'target_name' => $bentuk->name,
            'meta' => ['hard_delete' => false],
        ]);

        return response()->json([
            'status' => true,
            'message' => 'Bentuk berhasil dinonaktifkan',
        ]);
    }
}
