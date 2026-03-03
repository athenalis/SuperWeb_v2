<?php

namespace App\Http\Controllers\Api;

use App\Models\City;
use App\Models\Village;
use App\Models\District;
use App\Models\Province;
use App\Models\Pekerjaan;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class WilayahController extends Controller
{
    public function index()
    {
        $provinces = Province::with(['cities.districts.villages'])->get();

        return response()->json([
            'status' => true,
            'data' => $provinces
        ]);
    }

    public function cities($provinceCode)
    {
        $cities = City::where('province_code', $provinceCode)->get();
        return response()->json($cities);
    }

    public function districts($cityCode)
    {
        $districts = District::where('city_code', $cityCode)->get();
        return response()->json($districts);
    }

    public function villages($districtCode)
    {
        $villages = Village::where('district_code', $districtCode)->get();
        return response()->json($villages);
    }

    public function pekerjaan()
    {
        $pekerjaan = Pekerjaan::all();
        return response()->json($pekerjaan);
    }
}
