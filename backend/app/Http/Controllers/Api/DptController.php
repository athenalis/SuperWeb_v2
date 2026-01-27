<?php

namespace App\Http\Controllers\Api;

use App\Models\Dpt;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DptController extends Controller
{
    private function legendDensityVillage(): array
    {
        return [
            [
                'min'   => 56001,
                'max'   => 70000,
                'color' => '#bd0026',
                'label' => 'Prioritas Utama (56 – 70 rb)',
            ],
            [
                'min'   => 40001,
                'max'   => 56000,
                'color' => '#f03b20',
                'label' => 'Prioritas Tinggi (40 – 56 rb)',
            ],
            [
                'min'   => 25001,
                'max'   => 40000,
                'color' => '#fd8d3c',
                'label' => 'Prioritas Sedang (25 – 40 rb)',
            ],
            [
                'min'   => 12001,
                'max'   => 25000,
                'color' => '#fecc5c',
                'label' => 'Prioritas Rendah (12 – 25 rb)',
            ],
            [
                'min'   => 1,
                'max'   => 12000,
                'color' => '#ffffb2',
                'label' => 'Prioritas Sangat Rendah (1 – 12 rb)',
            ],
            [
                'min'   => 0,
                'max'   => 0,
                'color' => '#acacacff',
                'label' => 'Tidak diklasifikasikan',
            ],
        ];
    }

    private function legendDensityDistrict(): array
    {
        return [
            [
                'min'   => 320001,
                'max'   => 400000,
                'color' => '#bd0026',
                'label' => 'Prioritas Utama (320 – 400 rb)',
            ],
            [
                'min'   => 240001,
                'max'   => 320000,
                'color' => '#f03b20',
                'label' => 'Prioritas Tinggi (240 – 320 rb)',
            ],
            [
                'min'   => 160001,
                'max'   => 240000,
                'color' => '#fd8d3c',
                'label' => 'Prioritas Sedang (160 – 240 rb)',
            ],
            [
                'min'   => 80001,
                'max'   => 160000,
                'color' => '#fecc5c',
                'label' => 'Prioritas Rendah (80 – 160 rb)',
            ],
            [
                'min'   => 1,
                'max'   => 80000,
                'color' => '#ffffb2',
                'label' => 'Prioritas Sangat Rendah (0 – 80 rb)',
            ],
            [
                'min'   => 0,
                'max'   => 0,
                'color' => '#acacacff',
                'label' => 'Tidak diklasifikasikan',
            ],
        ];
    }

    private function legendDensityCity(): array
    {
        return [
            [
                'min'   => 12001,
                'max'   => 15000,
                'color' => '#bd0026',
                'label' => 'Prioritas Utama (12 – 15 rb)',
            ],
            [
                'min'   => 9001,
                'max'   => 12000,
                'color' => '#f03b20',
                'label' => 'Prioritas Tinggi (9 – 12 rb)',
            ],
            [
                'min'   => 6001,
                'max'   => 9000,
                'color' => '#fd8d3c',
                'label' => 'Prioritas Sedang (6 – 9 rb)',
            ],
            [
                'min'   => 3001,
                'max'   => 6000,
                'color' => '#fecc5c',
                'label' => 'Prioritas Rendah (3 – 6 rb)',
            ],
            [
                'min'   => 1,
                'max'   => 3000,
                'color' => '#ffffb2',
                'label' => 'Prioritas Sangat Rendah (0 – 3 rb)',
            ],
            [
                'min'   => 0,
                'max'   => 0,
                'color' => '#acacacff',
                'label' => 'Tidak diklasifikasikan',
            ],
        ];
    }

    private function legendInfoFromDensity(float $density, array $legend): array
    {
        foreach ($legend as $r) {
            if ($density >= $r['min'] && $density <= $r['max']) {
                return [
                    'color' => $r['color'],
                    'label' => $r['label'],
                ];
            }
        }

        return [
            'color' => '#ffffb2',
            'label' => 'Tidak Diklasifikasikan',
        ];
    }

    private function priorityTextFromLabel(string $label): string
    {
        if (str_contains($label, 'Utama')) return 'Prioritas Utama';
        if (str_contains($label, 'Tinggi')) return 'Prioritas Tinggi';
        if (str_contains($label, 'Sedang')) return 'Prioritas Sedang';
        if (str_contains($label, 'Rendah') && !str_contains($label, 'Sangat'))
            return 'Prioritas Rendah';
        if (str_contains($label, 'Sangat'))
            return 'Prioritas Sangat Rendah';

        return 'Tidak Diklasifikasikan';
    }

    public function dptVillage()
    {
        $cacheKey = 'map:dpt:density:village';

        return Cache::remember($cacheKey, now()->addHours(6), function () {

            $legend = $this->legendDensityVillage();

            $rows = DB::table('dpt_summary_villages')
                ->select(
                    'province',
                    'city',
                    'district',
                    'village',
                    'area_km2',
                    'total_dpt',
                    'density'
                )
                ->orderByDesc('density')
                ->get();

            $data = $rows->map(function ($item) use ($legend) {
                $legendInfo = $this->legendInfoFromDensity($item->density, $legend);

                return [
                    'province'  => $item->province,
                    'city'      => $item->city,
                    'district'  => $item->district,
                    'village'   => $item->village,
                    'area_km2'  => (float) $item->area_km2,
                    'total_dpt' => (int) $item->total_dpt,
                    'density'   => (float) $item->density,
                    'color'     => $legendInfo['color'],
                    'priority'  => $this->priorityTextFromLabel($legendInfo['label']),
                ];
            });

            return [
                'level'  => 'village',
                'count'  => $data->count(),
                'legend' => $legend,
                'data'   => $data,
            ];
        });
    }

    public function dptDistrict()
    {
        $cacheKey = 'map:dpt:density:district';

        return Cache::remember($cacheKey, now()->addHours(6), function () {

            $legend = $this->legendDensityDistrict();

            $rows = DB::table('dpt_summary_districts')
                ->select(
                    'province',
                    'city',
                    'district',
                    'area_km2',
                    'total_dpt',
                    'density'
                )
                ->orderByDesc('density')
                ->get();

            $data = $rows->map(function ($item) use ($legend) {
                $legendInfo = $this->legendInfoFromDensity($item->density, $legend);

                return [
                    'province'  => $item->province,
                    'city'      => $item->city,
                    'district'  => $item->district,
                    'area_km2'  => (float) $item->area_km2,
                    'total_dpt' => (int) $item->total_dpt,
                    'density'   => (float) $item->density,
                    'color'     => $legendInfo['color'],
                    'priority'  => $this->priorityTextFromLabel($legendInfo['label']),
                ];
            });

            return [
                'level'  => 'district',
                'count'  => $data->count(),
                'legend' => $legend,
                'data'   => $data,
            ];
        });
    }

    public function dptCity()
    {
        $cacheKey = 'map:dpt:density:city';

        return Cache::remember($cacheKey, now()->addHours(6), function () {

            $legend = $this->legendDensityCity();

            $rows = DB::table('dpt_summary_cities')
                ->select(
                    'province',
                    'city',
                    'area_km2',
                    'total_dpt',
                    'density'
                )
                ->orderByDesc('density')
                ->get();

            $data = $rows->map(function ($item) use ($legend) {
                $legendInfo = $this->legendInfoFromDensity($item->density, $legend);

                return [
                    'province'  => $item->province,
                    'city'      => $item->city,
                    'area_km2'  => (float) $item->area_km2,
                    'total_dpt' => (int) $item->total_dpt,
                    'density'   => (float) $item->density,
                    'color'     => $legendInfo['color'],
                    'priority'  => $this->priorityTextFromLabel($legendInfo['label']),
                ];
            });

            return [
                'level'  => 'city',
                'count'  => $data->count(),
                'legend' => $legend,
                'data'   => $data,
            ];
        });
    }
}
