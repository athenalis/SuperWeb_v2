<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class ContentTypeController extends Controller
{
    public function index(Request $request)
    {
        $types = DB::table('content_types as ct')
            ->join('content_type_platform as ctp', 'ct.id', '=', 'ctp.content_type_id')
            ->select('ct.id', 'ct.name', 'ctp.platform_id')
            ->orderBy('ct.name')
            ->get();

        $map = [];
        foreach ($types as $t) {
            if (!isset($map[$t->platform_id])) {
                $map[$t->platform_id] = [];
            }
            $map[$t->platform_id][] = [
                'id' => $t->id,
                'name' => $t->name
            ];
        }

        return response()->json($map);
    }
}
