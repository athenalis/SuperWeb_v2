<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminPaslon;
use App\Models\ContentPlan;
use App\Models\TotalBudget;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class BudgetController extends Controller
{
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

    private function currentPaslonId(): int
    {
        return (int) $this->currentAdminPaslon()->paslon_id;
    }

    public function index()
    {
        $paslonId = $this->currentPaslonId();

        $budgetRow = TotalBudget::where('paslon_id', $paslonId)->first();

        $used = ContentPlan::query()
            ->where('paslon_id', $paslonId)
            ->get()
            ->sum(fn ($cp) => (float) $cp->total_budget);

        $total = (float) ($budgetRow->amount ?? 0);
        $remaining = $total - $used;

        return response()->json([
            'status' => true,
            'data' => [
                'paslon_id' => $paslonId,
                'total_budget' => $total,
                'used_budget' => $used,
                'remaining_budget' => $remaining,
            ]
        ]);
    }

    // /**
    //  * PUT /budget
    //  * Set total budget paslon ini
    //  */
    // public function update(Request $request)
    // {
    //     $paslonId = $this->currentPaslonId();

    //     $validated = $request->validate([
    //         'amount' => 'required|numeric|min:0'
    //     ]);

    //     $row = TotalBudget::updateOrCreate(
    //         ['paslon_id' => $paslonId],
    //         ['amount' => $validated['amount']]
    //     );

    //     return response()->json([
    //         'status' => true,
    //         'message' => 'Total budget berhasil diperbarui',
    //         'data' => $row
    //     ]);
    // }
}
