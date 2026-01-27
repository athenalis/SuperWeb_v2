<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Province;
use App\Models\City;
use App\Models\District;
use App\Models\Village;
use Illuminate\Http\Request;

class WilayahController extends Controller
{
    // Semua provinsi + cascade cities → districts → villages (opsional)
    public function index()
    {
        $provinces = Province::with(['cities.districts.villages'])->get();

        return response()->json([
            'status' => true,
            'data' => $provinces
        ]);
    }

    // Kota berdasarkan province
    public function cities($provinceCode)
    {
        $cities = City::where('province_code', $provinceCode)->get();
        return response()->json($cities);
    }

    // Kecamatan berdasarkan city
    public function districts($cityCode)
    {
        $districts = District::where('city_code', $cityCode)->get();
        return response()->json($districts);
    }

    // Kelurahan berdasarkan district
    public function villages($districtCode)
    {
        $villages = Village::where('district_code', $districtCode)->get();
        return response()->json($villages);
    }

    public function pekerjaan()
    {
        $pekerjaan = \App\Models\Pekerjaan::all();
        return response()->json($pekerjaan);
    }
}
