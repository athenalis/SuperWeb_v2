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
        Schema::table('kepuasan_answers', function (Blueprint $table) {
            // Change existing booleans to integers for Likert scale
            $table->integer('tau_paslon')->nullable()->change();
            $table->integer('ingin_memilih')->nullable()->change();

            // Add new Likert scale fields
            $table->integer('tau_informasi')->nullable()->after('tau_paslon');
            $table->integer('tau_visi_misi')->nullable()->after('tau_informasi');
            $table->integer('tau_program_kerja')->nullable()->after('tau_visi_misi');
            $table->integer('tau_rekam_jejak')->nullable()->after('tau_program_kerja');

            $table->integer('percaya')->nullable()->after('pernah_dikunjungi');
            $table->integer('harapan')->nullable()->after('percaya');
            $table->integer('pertimbangan')->nullable()->after('harapan');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kepuasan_answers', function (Blueprint $table) {
            $table->boolean('tau_paslon')->nullable()->change();
            $table->boolean('ingin_memilih')->nullable()->change();

            $table->dropColumn([
                'tau_informasi',
                'tau_visi_misi',
                'tau_program_kerja',
                'tau_rekam_jejak',
                'percaya',
                'harapan',
                'pertimbangan'
            ]);
        });
    }
};
