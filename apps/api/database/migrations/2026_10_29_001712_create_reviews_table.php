<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('app.reviews', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('user_id')->index()->constrained('app.users')->cascadeOnDelete();
            $table->foreignId('card_id')->constrained('app.cards')->cascadeOnDelete();
            $table->smallInteger('rating');
            $table->timestampTz('review_datetime', 6);
            $table->unsignedInteger('review_duration')->nullable();
            $table->smallInteger('state');
            $table->unsignedSmallInteger('step')->nullable();
            $table->double('stability');
            $table->double('difficulty');
            $table->timestampTz('due', 6);
            $table->timestamps(6);
            $table->softDeletes('deleted_at', 6);
            $table->index(['card_id', 'deleted_at', 'id']);
        });

        DB::statement('ALTER TABLE app.reviews ENABLE ROW LEVEL SECURITY');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('app.reviews');
    }
};
