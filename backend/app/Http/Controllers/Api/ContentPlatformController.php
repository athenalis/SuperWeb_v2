<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Platform;
use Illuminate\Http\Request;

class ContentPlatformController extends Controller
{
    public function index()
    {
        $platforms = Platform::orderBy('name')->get();
        return response()->json($platforms);
    }
}
