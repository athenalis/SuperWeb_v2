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
        Schema::table('apk_requests', function (Blueprint $table) {
            $table->string('photo_proof')->nullable()->after('pickup_address');
        });

        // Add ARRIVED status
        DB::table('apk_request_statuses')->insertOrIgnore([
            'code' => 'ARRIVED',
            'name' => 'Sampai Tujuan',
            'sort_order' => 55, // Between PICKED_UP (50) and DELIVERED (60)? Assuming orders.
            'is_final' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('apk_requests', function (Blueprint $table) {
            $table->dropColumn('photo_proof');
        });

        DB::table('apk_request_statuses')->where('code', 'ARRIVED')->delete();
    }
};
