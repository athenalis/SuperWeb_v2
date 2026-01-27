<?php

namespace App\Http\Controllers\Api;

use App\Models\Ormas;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class OrmasController extends Controller
{
    public function index()
    {
        return response()->json([
            'status' => true,
            'data' => Ormas::select('id', 'nama_ormas')->orderBy('nama_ormas')->get()
        ]);
    }
}
