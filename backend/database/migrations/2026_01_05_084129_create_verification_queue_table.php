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
        Schema::create('verification_queue', function (Blueprint $table) {
            $table->id();
            $table->foreignId('koordinator_id')->constrained('relawans')->onDelete('cascade');
            $table->foreignId('last_relawan_id')->nullable()->constrained('relawans')->onDelete('set null');
            $table->integer('batch_count')->default(0);
            $table->timestamp('last_notified_at')->nullable();
            $table->timestamps();

            $table->unique('koordinator_id');
            $table->index(['koordinator_id', 'last_relawan_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('verification_queue');
    }
};
