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
        Schema::table('keluarga_members', function (Blueprint $table) {
            if (!Schema::hasColumn('keluarga_members', 'tanggal_lahir')) {
                $table->date('tanggal_lahir')->nullable()->after('nik');
            }
            if (!Schema::hasColumn('keluarga_members', 'pendidikan')) {
                $table->string('pendidikan')->nullable()->after('pekerjaan');
            }
            // Make umur nullable if it exists, as we will use tanggal_lahir
            if (Schema::hasColumn('keluarga_members', 'umur')) {
                $table->integer('umur')->nullable()->change();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('keluarga_members', function (Blueprint $table) {
            $table->dropColumn(['tanggal_lahir', 'pendidikan']);
        });
    }
};
