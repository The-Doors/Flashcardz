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
        Schema::create('app.decks', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('user_id')->index()->constrained('app.users')->cascadeOnDelete();
            $table->boolean('is_public')->default(false);
            $table->string('name', 255);
            $table->string('description', 1000)->nullable();
            $table->foreignId('source_deck_id')->nullable()->constrained('app.decks')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        DB::statement('ALTER TABLE app.decks ENABLE ROW LEVEL SECURITY');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('app.decks');
    }
};
