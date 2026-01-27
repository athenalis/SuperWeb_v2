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
            if (!Schema::hasColumn('keluarga_members', 'penghasilan')) {
                $table->string('penghasilan')->nullable()->after('pendidikan');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('keluarga_members', function (Blueprint $table) {
            if (Schema::hasColumn('keluarga_members', 'penghasilan')) {
                $table->dropColumn('penghasilan');
            }
        });
    }
};
