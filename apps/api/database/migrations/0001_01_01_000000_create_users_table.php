<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('public.instances');
        Schema::dropIfExists('public.cards');
        Schema::dropIfExists('public.decks');

        DB::statement('CREATE SCHEMA IF NOT EXISTS app');

        if (Schema::hasTable('public.users')) {
            if (DB::table('public.users')->whereRaw('char_length(username) > 29')->exists()
                || DB::table('public.users')->selectRaw('lower(username)')->groupByRaw('lower(username)')->havingRaw('count(*) > 1')->exists()) {
                throw new RuntimeException('Existing usernames must fit 29 characters and be unique ignoring case.');
            }

            DB::statement('ALTER TABLE public.users SET SCHEMA app');
            DB::statement('ALTER TABLE app.users DROP CONSTRAINT IF EXISTS users_username_key');

            Schema::table('app.users', function (Blueprint $table): void {
                $table->string('username', 29)->change();
                $table->string('username_lowercase', 29)->nullable();
                $table->timestamps();
            });

            DB::table('app.users')->update([
                'username_lowercase' => DB::raw('lower(username)'),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            Schema::table('app.users', function (Blueprint $table): void {
                $table->string('username_lowercase', 29)->nullable(false)->change();
                $table->unique('username_lowercase', 'users_username_lowercase_unique');
            });
        } else {
            Schema::create('app.users', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->string('username', 29);
                $table->string('username_lowercase', 29)->unique('users_username_lowercase_unique');
                $table->timestamps();
                $table->foreign('id')->references('id')->on('auth.users')->cascadeOnDelete();
            });
        }

        Schema::create('sessions', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->uuid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        DB::statement('ALTER TABLE app.users ENABLE ROW LEVEL SECURITY');
        DB::statement('ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY');
        DB::statement('ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY');
    }

    public function down(): void
    {
        throw new RuntimeException('The initial data reset is irreversible. Restore a database backup instead.');
    }
};
