<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UnitItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnitItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(
            UnitItem::query()
                ->select('id', 'name')
                ->orderBy('name')
                ->get()
        );
    }
}
