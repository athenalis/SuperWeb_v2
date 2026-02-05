<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VisitForm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MapVisitController extends Controller
{
    public function mapData(Request $request)
    {
        $user = Auth::user();

        // admin_paslon only (role_id = 2)
        if (!$user || (int) $user->role_id !== 2) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized (admin paslon only)'
            ], 403);
        }

        // ambil paslon_id dari user (sesuaikan jika relasinya beda)
        $paslonId = $user->paslon_id ?? optional($user->adminPaslon)->paslon_id ?? null;

        if (!$paslonId) {
            return response()->json([
                'success' => false,
                'message' => 'Paslon admin tidak ditemukan'
            ], 422);
        }

        $statusVerifikasi = $request->query('status_verifikasi');
        $status = $request->query('status');
        $from = $request->query('from');
        $to = $request->query('to');
        $limit = (int) ($request->query('limit', 5000));
        $limit = max(1, min($limit, 20000));

        $visits = VisitForm::query()
            ->where('kunjungan_forms.paslon_id', $paslonId)

            ->whereNotNull('kunjungan_forms.latitude')
            ->whereNotNull('kunjungan_forms.longitude')
            ->where('kunjungan_forms.latitude', '!=', 0)
            ->where('kunjungan_forms.longitude', '!=', 0)
            ->leftJoin('relawans', 'relawans.id', '=', 'kunjungan_forms.relawan_id')
            ->leftJoin('villages as vg', function ($join) {
                $join->on('vg.village_code', '=', 'relawans.village_code');
            })

            ->leftJoin('kunjungan_koordinators as kk', 'kk.id', '=', 'relawans.koor_kunjungan_id')
            ->leftJoin('keluarga_forms as kf', 'kf.kunjungan_id', '=', 'kunjungan_forms.id')
            ->leftJoin('keluarga_members as km', 'km.keluarga_form_id', '=', 'kf.id')

            ->when($statusVerifikasi, fn ($q) => $q->where('kunjungan_forms.status_verifikasi', $statusVerifikasi))
            ->when($status, fn ($q) => $q->where('kunjungan_forms.status', $status))
            ->when($from, fn ($q) => $q->whereDate('kunjungan_forms.created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('kunjungan_forms.created_at', '<=', $to))

            ->select([
                'kunjungan_forms.id',
                'kunjungan_forms.latitude',
                'kunjungan_forms.longitude',
                'kunjungan_forms.status',
                'kunjungan_forms.status_verifikasi',
                'kunjungan_forms.nama as kepala_keluarga_name',
                'relawans.nama as relawan_name',
                'kk.nama as koordinator_name',
                'relawans.village_code as relawan_village_code',
                'vg.village as relawan_village_name',
                'kunjungan_forms.created_at',
                'kunjungan_forms.completed_at',
            ])
            ->selectRaw('COALESCE(kunjungan_forms.completed_at, kunjungan_forms.created_at) as visited_at')
            ->selectRaw('COUNT(km.id) as jumlah_anggota_keluarga')

            ->groupBy(
                'kunjungan_forms.id',
                'kunjungan_forms.latitude',
                'kunjungan_forms.longitude',
                'kunjungan_forms.status',
                'kunjungan_forms.status_verifikasi',
                'kunjungan_forms.nama',
                'relawans.nama',
                'kk.nama',

                // ✅ wajib digroup kalau MySQL strict
                'relawans.village_code',
                'vg.village',

                'kunjungan_forms.created_at',
                'kunjungan_forms.completed_at'
            )
            ->orderByDesc('kunjungan_forms.created_at')
            ->limit($limit)
            ->get();


        return response()->json([
            'success' => true,
            'paslon_id' => $paslonId,
            'count' => $visits->count(),
            'data' => $visits
        ]);
    }
}
