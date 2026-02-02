<?php

namespace App\Http\Controllers;

use App\Models\ApkRequest;
use App\Models\ApkRequestItem;
use App\Models\ApkRequestStatus;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApkRequestController extends Controller
{
    /* =====================================================
       KOORDINATOR
       ===================================================== */

    // 1️⃣ Koordinator submit request pertama
    public function store(Request $request)
    {
        $request->validate([
            'items'              => 'required|array|min:1',
            'items.*.item_id'    => 'required|integer|exists:apk_items,id',
            'items.*.qty'        => 'required|numeric|min:0.01',
            'items.*.unit_id'    => 'required|integer|exists:units,id',
            'items.*.note'       => 'nullable|string',
        ]);

        $coordinator = auth()->user()->coordinatorApk; // relasi user → coordinator

        DB::transaction(function () use ($request, $coordinator) {

            $statusSubmitted = ApkRequestStatus::where('code', 'SUBMITTED')->firstOrFail();

            $apkRequest = ApkRequest::create([
                'coordinator_id'   => $coordinator->id,
                'current_status_id'=> $statusSubmitted->id,
                'revision_no'      => 1,
            ]);

            foreach ($request->items as $item) {
                ApkRequestItem::create([
                    'apk_request_id' => $apkRequest->id,
                    'item_id'        => $item['item_id'],
                    'qty'            => $item['qty'],
                    'unit_id'        => $item['unit_id'],
                    'note'           => $item['note'] ?? null,
                ]);
            }

            $apkRequest->setStatusByCode(
                'SUBMITTED',
                'COORDINATOR',
                $coordinator->id
            );
        });

        return response()->json(['message' => 'Request berhasil diajukan']);
    }

    // 2️⃣ Koordinator revise items (HANYA kalau REJECTED)
    public function reviseItems(Request $request, $id)
    {
        $request->validate([
            'items'           => 'required|array|min:1',
            'items.*.item_id' => 'required|integer|exists:apk_items,id',
            'items.*.qty'     => 'required|numeric|min:0.01',
            'items.*.unit_id' => 'required|integer|exists:units,id',
        ]);

        $coordinator = auth()->user()->coordinatorApk;

        $apkRequest = ApkRequest::where('id', $id)
            ->where('coordinator_id', $coordinator->id)
            ->firstOrFail();

        if (! $apkRequest->isStatus('REJECTED')) {
            abort(403, 'Request tidak bisa direvisi');
        }

        DB::transaction(function () use ($apkRequest, $request, $coordinator) {

            // hapus items lama
            $apkRequest->items()->delete();

            // insert items baru
            foreach ($request->items as $item) {
                ApkRequestItem::create([
                    'apk_request_id' => $apkRequest->id,
                    'item_id'        => $item['item_id'],
                    'qty'            => $item['qty'],
                    'unit_id'        => $item['unit_id'],
                ]);
            }

            $apkRequest->setStatusByCode(
                'REVISED',
                'COORDINATOR',
                $coordinator->id,
                'Items direvisi'
            );
        });

        return response()->json(['message' => 'Item berhasil direvisi']);
    }

    // 3️⃣ Koordinator submit ulang
    public function resubmit($id)
    {
        $coordinator = auth()->user()->coordinatorApk;

        $apkRequest = ApkRequest::where('id', $id)
            ->where('coordinator_id', $coordinator->id)
            ->firstOrFail();

        if (! $apkRequest->isStatus('REVISED')) {
            abort(403, 'Request belum direvisi');
        }

        DB::transaction(function () use ($apkRequest, $coordinator) {
            $apkRequest->increment('revision_no');

            $apkRequest->setStatusByCode(
                'SUBMITTED',
                'COORDINATOR',
                $coordinator->id,
                'Resubmitted'
            );
        });

        return response()->json(['message' => 'Request berhasil diajukan ulang']);
    }

    /* =====================================================
       ADMIN
       ===================================================== */

    // 4️⃣ Admin approve
    public function approve(Request $request, $id)
    {
        $request->validate([
            'courier_id'    => 'required|exists:apk_kurirs,id',
            'pickup_address'=> 'required|string',
        ]);

        $admin = auth()->user()->adminApk;

        $apkRequest = ApkRequest::findOrFail($id);

        if (! $apkRequest->isStatus('SUBMITTED')) {
            abort(403, 'Request tidak bisa disetujui');
        }

        DB::transaction(function () use ($apkRequest, $request, $admin) {

            $apkRequest->update([
                'admin_id'      => $admin->id,
                'courier_id'    => $request->courier_id,
                'pickup_address'=> $request->pickup_address,
            ]);

            $apkRequest->setStatusByCode(
                'APPROVED',
                'ADMIN',
                $admin->id
            );
        });

        return response()->json(['message' => 'Request disetujui']);
    }

    // 5️⃣ Admin reject
    public function reject(Request $request, $id)
    {
        $request->validate([
            'message' => 'required|string',
        ]);

        $admin = auth()->user()->adminApk;

        $apkRequest = ApkRequest::findOrFail($id);

        if (! $apkRequest->isStatus('SUBMITTED')) {
            abort(403, 'Request tidak bisa ditolak');
        }

        $apkRequest->setStatusByCode(
            'REJECTED',
            'ADMIN',
            $admin->id,
            $request->message
        );

        return response()->json(['message' => 'Request ditolak']);
    }

    /* =====================================================
       KURIR
       ===================================================== */

    // 6️⃣ Kurir pickup barang
    public function pickup($id)
    {
        $kurir = auth()->user()->courierApk;

        $apkRequest = ApkRequest::where('id', $id)
            ->where('courier_id', $kurir->id)
            ->firstOrFail();

        if (! $apkRequest->isStatus('APPROVED')) {
            abort(403, 'Request belum bisa diambil');
        }

        $apkRequest->setStatusByCode(
            'PICKED_UP',
            'COURIER',
            $kurir->id
        );

        return response()->json(['message' => 'Barang sudah diambil']);
    }

    /* =====================================================
       KOORDINATOR (FINAL)
       ===================================================== */

    // 7️⃣ Koordinator konfirmasi sampai
    public function delivered($id)
    {
        $coordinator = auth()->user()->coordinatorApk;

        $apkRequest = ApkRequest::where('id', $id)
            ->where('coordinator_id', $coordinator->id)
            ->firstOrFail();

        if (! $apkRequest->isStatus('PICKED_UP')) {
            abort(403, 'Request belum diambil kurir');
        }

        $apkRequest->setStatusByCode(
            'DELIVERED',
            'COORDINATOR',
            $coordinator->id
        );

        return response()->json(['message' => 'Barang sudah sampai']);
    }
}
