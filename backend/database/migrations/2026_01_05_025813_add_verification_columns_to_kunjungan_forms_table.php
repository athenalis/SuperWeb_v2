<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('kunjungan_forms', function (Blueprint $table) {
            if (!Schema::hasColumn('kunjungan_forms', 'komentar_verifikasi')) {
                $table->text('komentar_verifikasi')->nullable()->after('status_verifikasi');
            }
            if (!Schema::hasColumn('kunjungan_forms', 'verified_by')) {
                $table->unsignedBigInteger('verified_by')->nullable()->after('komentar_verifikasi');
            }
            if (!Schema::hasColumn('kunjungan_forms', 'verified_at')) {
                $table->timestamp('verified_at')->nullable()->after('verified_by');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kunjungan_forms', function (Blueprint $table) {
            if (Schema::hasColumn('kunjungan_forms', 'komentar_verifikasi')) {
                $table->dropColumn('komentar_verifikasi');
            }
            if (Schema::hasColumn('kunjungan_forms', 'verified_by')) {
                $table->dropColumn('verified_by');
            }
            if (Schema::hasColumn('kunjungan_forms', 'verified_at')) {
                $table->dropColumn('verified_at');
            }
        });
    }
};
