<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApkTotalBudget;
use App\Models\AdminPaslon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ApkBudgetController extends Controller
{
    private function roleName($user): ?string
    {
        $user->loadMissing('role');
        return $user->role?->role; 
    }

    private function requireKoordinator($user)
    {
        $coor = $user->apkKoordinator;
        if (!$coor) {
            abort(response()->json([
                'status' => false,
                'message' => 'Akun ini belum terdaftar sebagai Koordinator APK'
            ], 403));
        }
        return $coor;
    }

    private function requireKurir($user)
    {
        $kurir = $user->apkKurir;
        if (!$kurir) {
            abort(response()->json([
                'status' => false,
                'message' => 'Akun ini belum terdaftar sebagai Kurir APK'
            ], 403));
        }
        return $kurir;
    }

    private function requireAdminApk($user)
    {
        $admin = $user->adminApk;
        if (!$admin) {
            abort(response()->json([
                'status' => false,
                'message' => 'Akun ini belum terdaftar sebagai Admin APK'
            ], 403));
        }
        return $admin;
    }

    private function currentAdminPaslon(): AdminPaslon
    {
        $adminPaslon = AdminPaslon::where('user_id', Auth::id())
            ->whereNull('deleted_at')
            ->first();

        if (!$adminPaslon || !$adminPaslon->paslon_id) {
            abort(response()->json([
                'status' => false,
                'message' => 'Admin paslon tidak ditemukan / tidak valid'
            ], 403));
        }

        return $adminPaslon;
    }

    private function currentPaslonIdFromLogin(): int
    {
        $user = Auth::user();
        if (!$user) {
            abort(response()->json([
                'status' => false,
                'message' => 'Unauthorized'
            ], 401));
        }

        $role = $this->roleName($user);

        if ($role === 'apk_koordinator') {
            $coor = $this->requireKoordinator($user);
            if (!$coor->paslon_id) {
                abort(response()->json([
                    'status' => false,
                    'message' => 'Koordinator APK tidak punya paslon_id'
                ], 403));
            }
            return (int) $coor->paslon_id;
        }

        if ($role === 'apk_kurir') {
            $kurir = $this->requireKurir($user);
            if (!$kurir->paslon_id) {
                abort(response()->json([
                    'status' => false,
                    'message' => 'Kurir APK tidak punya paslon_id'
                ], 403));
            }
            return (int) $kurir->paslon_id;
        }

        if ($role === 'admin_paslon') {
            return (int) $this->currentAdminPaslon()->paslon_id;
        }

        if ($role === 'admin_apk') {
            $admin = $this->requireAdminApk($user);
            if (!$admin->paslon_id) {
                abort(response()->json([
                    'status' => false,
                    'message' => 'Admin APK tidak punya paslon_id'
                ], 403));
            }
            return (int) $admin->paslon_id;
        }

        abort(response()->json([
            'status' => false,
            'message' => 'Role tidak valid untuk akses budget APK'
        ], 403));
    }

    public function index(Request $request)
    {
        $paslonId = $this->currentPaslonIdFromLogin();

        $totalBudget = (float) (ApkTotalBudget::query()
            ->where('paslon_id', $paslonId)
            ->value('amount') ?? 0);

        $budgetTerpakai = (float) DB::table('apk_items')
            ->where('paslon_id', $paslonId)
            ->sum('budget_total');

        $sisa = $totalBudget - $budgetTerpakai;

        return response()->json([
            'status' => true,
            'data' => [
                'paslon_id' => $paslonId,
                'total_budget' => number_format($totalBudget, 2, '.', ''),
                'budget_terpakai' => number_format($budgetTerpakai, 2, '.', ''),
                'sisa_budget' => number_format($sisa, 2, '.', ''),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $paslonId = $this->currentPaslonIdFromLogin();

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0'],
        ]);

        $row = ApkTotalBudget::query()->updateOrCreate(
            ['paslon_id' => $paslonId],
            ['amount' => $data['amount']]
        );

        return response()->json([
            'status' => true,
            'message' => 'Total budget APK berhasil disimpan',
            'data' => [
                'paslon_id' => (int) $row->paslon_id,
                'amount' => number_format((float) $row->amount, 2, '.', ''),
            ],
        ]);
    }
}
