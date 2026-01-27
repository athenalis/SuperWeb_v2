<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Platform; // pastikan model Platform ada
use Illuminate\Http\Request;

class ContentPlatformController extends Controller
{
    /**
     * GET /api/platforms
     */
    public function index()
    {
        $platforms = Platform::orderBy('name')->get();
        return response()->json($platforms);
    }
}
