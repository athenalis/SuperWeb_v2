<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('kunjungan_forms', function (Blueprint $table) {
            if (!Schema::hasColumn('kunjungan_forms', 'tanggal')) {
                $table->date('tanggal')->nullable();
            }
            if (!Schema::hasColumn('kunjungan_forms', 'pekerjaan')) {
                $table->string('pekerjaan')->nullable(); // String based on controller usage
            }
            if (!Schema::hasColumn('kunjungan_forms', 'status')) {
                $table->string('status')->default('draft');
            }
            if (!Schema::hasColumn('kunjungan_forms', 'offline_id')) {
                $table->string('offline_id')->nullable()->unique();
            }
            if (!Schema::hasColumn('kunjungan_forms', 'created_by')) {
                $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kunjungan_forms', function (Blueprint $table) {
            $table->dropColumn(['tanggal', 'pekerjaan', 'status', 'offline_id', 'created_by']);
        });
    }
};
