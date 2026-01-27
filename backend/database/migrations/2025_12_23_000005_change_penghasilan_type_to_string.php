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
            // Change penghasilan to string if it exists and is int
            // We use raw SQL or check type to be safe, but change() should handle it if doctrine/dbal is present
            // In Laravel 10+, native change is supported for most cases
            $table->string('penghasilan')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('keluarga_members', function (Blueprint $table) {
            $table->integer('penghasilan')->nullable()->change();
        });
    }
};
