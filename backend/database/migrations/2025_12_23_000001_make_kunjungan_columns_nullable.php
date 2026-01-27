<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $fks = [
            'kunjungan_forms_pekerjaan_id_foreign',
            'kunjungan_forms_task_id_foreign',
            'kunjungan_forms_relawan_id_foreign',
            'kunjungan_forms_campaign_id_foreign'
        ];

        foreach ($fks as $fk) {
            $exists = DB::select("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_NAME = 'kunjungan_forms' AND CONSTRAINT_NAME = ? AND TABLE_SCHEMA = DATABASE()", [$fk]);

            if (!empty($exists)) {
                Schema::table('kunjungan_forms', function (Blueprint $table) use ($fk) {
                    $table->dropForeign($fk);
                });
            }
        }

        Schema::table('kunjungan_forms', function (Blueprint $table) {
            // Task ID might be missing in ad-hoc kunjungan
            $table->unsignedBigInteger('task_id')->nullable()->change();

            // Relawan ID might be redundant
            $table->unsignedBigInteger('relawan_id')->nullable()->change();

            // Campaign ID might not be set initially
            $table->unsignedBigInteger('campaign_id')->nullable()->change();

            // Pekerjaan converted to string input, so ID is optional
            $table->unsignedBigInteger('pekerjaan_id')->nullable()->change();

            // Ensure status_verifikasi has default
            if (Schema::hasColumn('kunjungan_forms', 'status_verifikasi')) {
                $table->string('status_verifikasi')->default('pending')->change();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No down
    }
};
