<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app.study_groups', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('owner_id')->index()->constrained('app.users')->cascadeOnDelete();
            $table->string('name', 255);
            $table->string('description', 1000)->nullable();
            $table->timestamps();
        });

        Schema::create('app.study_group_members', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('study_group_id')->constrained('app.study_groups')->cascadeOnDelete();
            $table->foreignUuid('user_id')->index()->constrained('app.users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['study_group_id', 'user_id']);
        });

        Schema::create('app.study_group_invitations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('study_group_id')->constrained('app.study_groups')->cascadeOnDelete();
            $table->foreignUuid('inviter_id')->nullable()->constrained('app.users')->nullOnDelete();
            $table->foreignUuid('invitee_id')->index()->constrained('app.users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['study_group_id', 'invitee_id']);
        });

        Schema::create('app.study_group_decks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('study_group_id')->constrained('app.study_groups')->cascadeOnDelete();
            $table->foreignId('deck_id')->index()->constrained('app.decks')->cascadeOnDelete();
            $table->foreignUuid('added_by_id')->nullable()->constrained('app.users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['study_group_id', 'deck_id']);
        });

        Schema::table('app.reviews', function (Blueprint $table): void {
            $table->index(['card_id', 'user_id', 'deleted_at', 'id'], 'reviews_card_id_user_id_deleted_at_id_index');
        });

        foreach (['study_groups', 'study_group_members', 'study_group_invitations', 'study_group_decks'] as $table) {
            DB::statement("ALTER TABLE app.{$table} ENABLE ROW LEVEL SECURITY");
        }
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS app.reviews_card_id_user_id_deleted_at_id_index');
        Schema::dropIfExists('app.study_group_decks');
        Schema::dropIfExists('app.study_group_invitations');
        Schema::dropIfExists('app.study_group_members');
        Schema::dropIfExists('app.study_groups');
    }
};
