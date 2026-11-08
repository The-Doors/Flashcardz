<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app.job_statuses', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('user_id')->index()->constrained('app.users')->cascadeOnDelete();
            $table->string('type');
            $table->string('status')->default('queued');
            $table->jsonb('progress')->nullable();
            $table->string('error_code')->nullable();
            $table->text('error_message')->nullable();
            $table->foreignId('deck_id')->nullable()->constrained('app.decks')->nullOnDelete();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        DB::statement('ALTER TABLE app.job_statuses ENABLE ROW LEVEL SECURITY');
    }

    public function down(): void
    {
        Schema::dropIfExists('app.job_statuses');
    }
};
