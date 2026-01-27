<?php

namespace App\Http\Controllers\Api;

use App\Models\VisitForm;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;

class MapVisitController extends Controller
{
    public function mapData(Request $request)
    {
        $statusVerifikasi = $request->status_verifikasi; // optional

        $visits = VisitForm::query()
            ->join('relawans', 'relawans.id', '=', 'kunjungan_forms.relawan_id')
            ->join('villages', 'villages.village_code', '=', 'relawans.village_code')

            // ✅ SELF JOIN relawans sebagai koordinator
            ->leftJoin('koordinators', 'koordinators.id', '=', 'relawans.koordinator_id')

            ->when($statusVerifikasi, function ($q) use ($statusVerifikasi) {
                $q->where('kunjungan_forms.status_verifikasi', $statusVerifikasi);
            })
            ->select(
                // kelurahan
                'relawans.village_code',
                'villages.village as village_name',

                // koordinator
                'relawans.koordinator_id',
                'koordinators.nama as koordinator_name',

                // agregasi
                DB::raw('COUNT(kunjungan_forms.id) as total_kunjungan'),
                DB::raw("SUM(CASE WHEN kunjungan_forms.status_verifikasi = 'accepted' THEN 1 ELSE 0 END) as completed"),
                DB::raw("SUM(CASE WHEN kunjungan_forms.status_verifikasi = 'pending' THEN 1 ELSE 0 END) as pending"),
                DB::raw("SUM(CASE WHEN kunjungan_forms.status_verifikasi = 'rejected' THEN 1 ELSE 0 END) as rejected")
            )
            ->groupBy(
                'relawans.village_code',
                'villages.village',
                'relawans.koordinator_id',
                'koordinators.nama'
            )
            ->get();

        return response()->json([
            'success' => true,
            'data' => $visits
        ]);
    }
}
