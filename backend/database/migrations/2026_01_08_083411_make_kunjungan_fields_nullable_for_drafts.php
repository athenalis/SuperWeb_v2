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
            $table->date('tanggal')->nullable()->change();
            $table->integer('umur')->nullable()->change();
            $table->string('pendidikan')->nullable()->change();
            $table->string('pekerjaan')->nullable()->change();
            $table->string('penghasilan')->nullable()->change();
            $table->string('foto_ktp')->nullable()->change();
            $table->text('alamat')->nullable()->change();
            $table->decimal('latitude', 10, 8)->nullable()->change();
            $table->decimal('longitude', 11, 8)->nullable()->change();
        });

        Schema::table('family_forms', function (Blueprint $table) {
            $table->text('alamat_keluarga')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No need for down for this fix
    }
};
