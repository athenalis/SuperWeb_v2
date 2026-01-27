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
        // Fix kunjungan_forms
        Schema::table('kunjungan_forms', function (Blueprint $table) {
            if (!Schema::hasColumn('kunjungan_forms', 'score')) {
                $table->integer('score')->nullable()->after('status');
            }
            if (!Schema::hasColumn('kunjungan_forms', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('score');
            }
            if (!Schema::hasColumn('kunjungan_forms', 'completed_by')) {
                $table->unsignedBigInteger('completed_by')->nullable()->after('completed_at');
            }
        });

        // Fix keluarga_members
        Schema::table('keluarga_members', function (Blueprint $table) {
            if (Schema::hasColumn('keluarga_members', 'nik')) {
                $table->string('nik')->nullable()->change();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kunjungan_forms', function (Blueprint $table) {
            $table->dropColumn(['score', 'completed_at', 'completed_by']);
        });

        Schema::table('keluarga_members', function (Blueprint $table) {
            if (Schema::hasColumn('keluarga_members', 'nik')) {
                $table->string('nik')->nullable(false)->change();
            }
        });
    }
};
