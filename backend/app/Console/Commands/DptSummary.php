<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DptSummary extends Command
{
    protected $signature = 'dpt:summary {level=city}';
    protected $description = 'Generate DPT summary (city | district | village) using region names';

    public function handle()
    {
        $level = strtoupper($this->argument('level'));

        match ($level) {
            'CITY'     => $this->summaryCity(),
            'DISTRICT' => $this->summaryDistrict(),
            'VILLAGE'  => $this->summaryVillage(),
            default    => $this->error('Level harus city | district | village'),
        };

        $this->info("DPT summary {$level} selesai");
    }

    private function summaryCity()
    {
        DB::table('dpt_summary_cities')->truncate();

        DB::insert("
            INSERT INTO dpt_summary_cities
            SELECT
                r.province,
                r.city,
                r.area_km2,
                COUNT(d.id) AS total_dpt,
                IF(r.area_km2 > 0, ROUND(COUNT(d.id)/r.area_km2, 2), 0),
                NOW()
            FROM regions r
            LEFT JOIN dpt d
                ON d.city = r.city
            WHERE r.level = 'CITY'
            GROUP BY r.province, r.city, r.area_km2
        ");
    }

    private function summaryDistrict()
    {
        DB::table('dpt_summary_districts')->truncate();

        DB::insert("
            INSERT INTO dpt_summary_districts
            (
                province,
                city,
                district,
                area_km2,
                total_dpt,
                density,
                updated_at
            )
            SELECT
                r.province,
                r.city,
                r.district,
                r.area_km2,
                COUNT(d.id) AS total_dpt,
                IF(r.area_km2 > 0,
                    ROUND(COUNT(d.id) / r.area_km2, 2),
                    0
                ) AS density,
                NOW()
            FROM regions r
            LEFT JOIN dpt d
                ON REPLACE(TRIM(UPPER(d.province)), '.', '') = REPLACE(TRIM(UPPER(r.province)), '.', '')
            AND REPLACE(TRIM(UPPER(d.city)), '.', '')     = REPLACE(TRIM(UPPER(r.city)), '.', '')
            AND REPLACE(TRIM(UPPER(d.district)), '.', '') = REPLACE(TRIM(UPPER(r.district)), '.', '')
            WHERE r.level = 'DISTRICT'
            GROUP BY
                r.province,
                r.city,
                r.district,
                r.area_km2
        ");
    }

    private function summaryVillage()
    {
        DB::table('dpt_summary_villages')->truncate();

        DB::insert("
            INSERT INTO dpt_summary_villages
            (
                province,
                city,
                district,
                village,
                area_km2,
                total_dpt,
                density,
                updated_at
            )
            SELECT
                TRIM(UPPER(r.province)) AS province,
                TRIM(UPPER(r.city))     AS city,
                REPLACE(TRIM(UPPER(r.district)), '.', '') AS district,
                TRIM(UPPER(r.village))  AS village,
                r.area_km2,
                COUNT(d.id) AS total_dpt,
                IF(r.area_km2 > 0,
                    ROUND(COUNT(d.id) / r.area_km2, 2),
                    0
                ) AS density,
                NOW()
            FROM regions r
            LEFT JOIN dpt d
                ON REPLACE(TRIM(UPPER(d.province)), '.', '') = REPLACE(TRIM(UPPER(r.province)), '.', '')
            AND REPLACE(TRIM(UPPER(d.city)), '.', '')     = REPLACE(TRIM(UPPER(r.city)), '.', '')
            AND REPLACE(TRIM(UPPER(d.district)), '.', '') = REPLACE(TRIM(UPPER(r.district)), '.', '')
            AND REPLACE(TRIM(UPPER(d.village)), '.', '')  = REPLACE(TRIM(UPPER(r.village)), '.', '')
            WHERE r.level = 'VILLAGE'
            GROUP BY
                r.province,
                r.city,
                r.district,
                r.village,
                r.area_km2
        ");
    }
}
