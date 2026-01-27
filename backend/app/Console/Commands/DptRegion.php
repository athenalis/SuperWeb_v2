<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Region;

class DptRegion extends Command
{
    protected $signature = 'dpt:region {level=village}';
    protected $description = 'Import region area from GeoJSON using region names';

    public function handle()
    {
        $level = strtoupper($this->argument('level'));

        if (!in_array($level, ['VILLAGE', 'DISTRICT', 'CITY'])) {
            $this->error('Support level: village | district | city');
            return;
        }

        $fileMap = [
            'VILLAGE'  => 'id31_dki_jakarta_village.geojson',
            'DISTRICT' => 'id31_dki_jakarta_district.geojson',
            'CITY'     => 'id31_dki_jakarta.geojson',
        ];

        $file = storage_path('app/geojson/' . $fileMap[$level]);

        $this->processGeojson($file, $level);

        $this->info("Import region {$level} selesai");
    }

    private function normalize(string $value): string
    {
        return trim(mb_strtoupper($value));
    }

    private function normalizeCity(string $value): string
    {
        $value = trim(mb_strtoupper($value));

        $map = [
            'KOTA JAKARTA UTARA'   => 'KOTA ADM. JAKARTA UTARA',
            'KOTA JAKARTA PUSAT'   => 'KOTA ADM. JAKARTA PUSAT',
            'KOTA JAKARTA BARAT'   => 'KOTA ADM. JAKARTA BARAT',
            'KOTA JAKARTA TIMUR'   => 'KOTA ADM. JAKARTA TIMUR',
            'KOTA JAKARTA SELATAN' => 'KOTA ADM. JAKARTA SELATAN',
            'KEPULAUAN SERIBU' => 'KAB. ADM. KEP. SERIBU',
            'KOTA ADM. JAKARTA TIMUR'   => 'KOTA ADM. JAKARTA TIMUR',
            'KOTA ADM. JAKARTA BARAT'   => 'KOTA ADM. JAKARTA BARAT',
            'KOTA ADM. JAKARTA SELATAN' => 'KOTA ADM. JAKARTA SELATAN',
            'KOTA ADM. JAKARTA UTARA'   => 'KOTA ADM. JAKARTA UTARA',
            'KOTA ADM. JAKARTA PUSAT'   => 'KOTA ADM. JAKARTA PUSAT',
            'ADM. KEP. SERIBU'          => 'KAB. ADM. KEP. SERIBU',
        ];

        return $map[$value] ?? $value;
    }

    private function normalizeDistrict(string $value): string
    {
        $value = trim(mb_strtoupper($value));

        $key = str_replace(' ', '', $value);

        $map = [
            'GROGOLPETAMBURAN' => 'GROGOL PERTAMBURAN',
            'KRAMATJATI' => 'KRAMATJATI',
            'MAMPANGPRAPATAN' => 'MAMPANG PRAPATAN',
            'PULOGADUNG' => 'PULOGADUNG',
            'SETIABUDI' => 'SETIABUDI',
            'PALMERAH' => 'PAL MERAH',
            'KALIDERES' => 'KALIDERES',
            'KEPULAUANSERIBUUTARA' => 'KEPULAUAN SERIBU UTARA',
            'KEPULAUANSERIBUSELATAN' => 'KEPULAUAN SERIBU SELATAN.',
        ];

        return $map[$key] ?? $value;
    }

    private function normalizeVillage(string $value): string
    {
        $value = trim(mb_strtoupper($value));

        $key = str_replace(' ', '', $value);

        $map = [
            'HALIMPERDANAKUSUMAH' => 'HALIM PERDANA KUSUMA',
            'PAPANGO'            => 'PAPANGGO',
            'KAMPUNGTENGAH'      => 'TENGAH',
            'PALMERIEM'          => 'PALMERIAM',
            'TANJUNGPRIUK'       => 'TANJUNG PRIOK',
            'WIJAYAKESUMA'       => 'WIJAYA KUSUMA',
            'HARAPANMULYA'       => 'HARAPAN MULIA',
            'PREPEDAN'           => 'TEGAL ALUR',
            'BALEKAMBANG'       => 'BALEKAMBANG',
            'JATIPULO'       => 'JATIPULO',
            'KALIBARU'       => 'KALIBARU',
            'KALIANYAR'       => 'KALI ANYAR',
            'KALIDERES'       => 'KALIDERES',
            'KRAMATJATI'       => 'KRAMATJATI',
            'PINANGRANTI'       => 'PINANGRANTI',
            'RAWASARI'       => 'RAWASARI',
            'RAWABADAKSELATAN'       => 'RAWA BADAK SELATAN',
            'RAWABADAKUTARA'       => 'RAWA BADAK UTARA',
            'SUKAPURA'       => 'SUKAPURA',
        ];

        if (isset($map[$key])) {
            return $map[$key];
        }
        return $value;
    }

    private function processGeojson(string $path, string $level)
    {
        $json = json_decode(file_get_contents($path), true);

        foreach ($json['features'] as $feature) {
            $this->processFeature($feature, $level);
        }
    }

    private function processFeature(array $feature, string $level)
    {
        $props    = $feature['properties'];
        $geometry = $feature['geometry'];

        $province = $this->normalize(
            $props['province'] 
            ?? $props['WADMPR'] 
            ?? 'DKI JAKARTA'
        );

        $cityRaw = $props['regency']
            ?? $props['city']
            ?? $props['WADMKK']
            ?? null;

        if (!$cityRaw) {
            return;
        }

        $city = $this->normalizeCity($cityRaw);

        $district = null;
        $village  = null;

        if ($level === 'DISTRICT' || $level === 'VILLAGE') {
            if (isset($props['district'])) {
                if (stripos($props['district'], 'DANAU') !== false) {
                    return;
                }
                $district = $this->normalizeDistrict($props['district']);
            }
        }

        if ($level === 'VILLAGE') {
            if (stripos($props['village'], 'DANAU') !== false) {
                return;
            }
            $village = $this->normalizeVillage($props['village']);
        }

        $areaKm2 = $this->calculateArea($geometry);

        Region::updateOrCreate(
            [
                'province' => $province,
                'city'     => $city,
                'district' => $district,
                'village'  => $village,
                'level'    => $level,
            ],
            [
                'area_km2' => round($areaKm2, 4),
            ]
        );
    }

    private function calculateArea(array $geometry): float
    {
        $area = 0;

        if ($geometry['type'] === 'Polygon') {
            $area = $this->polygonArea($geometry['coordinates'][0]);
        }

        if ($geometry['type'] === 'MultiPolygon') {
            foreach ($geometry['coordinates'] as $polygon) {
                $area += $this->polygonArea($polygon[0]);
            }
        }

        return abs($area);
    }

    private function polygonArea(array $points): float
    {
        $earthRadius = 6371; // km
        $area = 0;

        for ($i = 0; $i < count($points) - 1; $i++) {
            $lon1 = deg2rad($points[$i][0]);
            $lat1 = deg2rad($points[$i][1]);
            $lon2 = deg2rad($points[$i + 1][0]);
            $lat2 = deg2rad($points[$i + 1][1]);

            $area += ($lon2 - $lon1) * (2 + sin($lat1) + sin($lat2));
        }

        return ($area * $earthRadius * $earthRadius) / 2;
    }
}