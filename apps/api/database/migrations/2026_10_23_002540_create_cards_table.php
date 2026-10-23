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
        Schema::create('app.cards', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('deck_id')->index()->constrained('app.decks')->cascadeOnDelete();
            $table->foreignUuid('creator_id')->nullable()->constrained('app.users')->nullOnDelete();
            $table->text('content');
            $table->foreignId('source_card_id')->nullable()->constrained('app.cards')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        DB::statement('ALTER TABLE app.cards ENABLE ROW LEVEL SECURITY');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('app.cards');
    }
};
