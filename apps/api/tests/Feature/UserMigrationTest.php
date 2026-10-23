<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Support\PostgresTestCase;

class UserMigrationTest extends PostgresTestCase
{
    public function test_installs_into_a_fresh_supabase_database_and_can_be_run_again(): void
    {
        $this->resetDatabase();

        $this->assertDatabaseCount('app.users', 0);
        $this->assertFalse(Schema::hasTable('public.users'));
        $this->assertFalse(Schema::hasTable('password_reset_tokens'));
        $this->assertTrue(Schema::hasTable('sessions'));
        $this->assertTrue(Schema::hasTable('cache'));
        $this->assertTrue(Schema::hasTable('jobs'));
        $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
    }

    public function test_preserves_profiles_and_auth_accounts_while_dropping_learning_tables(): void
    {
        $this->legacyDatabase();

        $this->artisan('migrate', ['--force' => true])->assertExitCode(0);

        $this->assertDatabaseHas('app.users', ['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'username' => 'Casey', 'username_lowercase' => 'casey']);
        $this->assertDatabaseCount('auth.users', 1);
        $this->assertDatabaseHas('alembic_version', ['version_num' => 'legacy']);
        foreach (['public.users', 'public.cards', 'public.decks', 'public.instances'] as $table) {
            $this->assertFalse(Schema::hasTable($table));
        }
        $this->assertNotNull(User::query()->first()->created_at);
    }

    #[DataProvider('invalidLegacyUsernames')]
    public function test_rolls_back_the_entire_reset_if_existing_usernames_are_incompatible(string $username, bool $collision): void
    {
        $this->legacyDatabase();
        if ($collision) {
            DB::table('auth.users')->insert(['id' => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
            DB::table('public.users')->insert(['id' => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'username' => $username]);
        } else {
            DB::table('public.users')->update(['username' => $username]);
        }
        $this->artisan('migrate:install')->assertExitCode(0);
        try {
            app('migrator')->run(database_path('migrations'));
            $this->fail('Expected incompatible profiles to stop the migration.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Existing usernames must fit 29 characters and be unique ignoring case.', $exception->getMessage());
        }

        $this->assertDatabaseHas('public.users', ['username' => $username]);
        $this->assertDatabaseCount('public.cards', 1);
        $this->assertDatabaseCount('public.decks', 1);
        $this->assertDatabaseCount('public.instances', 1);
        $this->assertFalse(Schema::hasTable('app.users'));
    }

    public static function invalidLegacyUsernames(): array
    {
        return ['too long' => [str_repeat('a', 30), false], 'case conflict' => ['CASEY', true]];
    }

    public function test_rejects_profiles_without_a_supabase_identity(): void
    {
        $this->resetDatabase();
        $this->expectException(QueryException::class);

        User::factory()->create();
    }

    public function test_deleting_a_supabase_account_deletes_its_profile_after_the_move(): void
    {
        $this->legacyDatabase();
        $this->artisan('migrate', ['--force' => true])->assertExitCode(0);

        DB::table('auth.users')->delete();

        $this->assertDatabaseCount('app.users', 0);
    }

    public function test_keeps_lowercase_usernames_in_sync_on_model_updates(): void
    {
        $this->resetDatabase();
        DB::table('auth.users')->insert(['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
        $user = User::factory()->create(['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'username' => 'Casey']);

        $user->update(['username' => 'NewName']);

        $this->assertDatabaseHas('app.users', ['id' => $user->id, 'username' => 'NewName', 'username_lowercase' => 'newname']);
    }

    public function test_supports_uuid_sessions_and_hides_support_tables_from_data_api_roles(): void
    {
        $this->resetDatabase();
        DB::table('sessions')->insert([
            'id' => 'test-session',
            'user_id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'payload' => '',
            'last_activity' => 1,
        ]);
        DB::unprepared("DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'api_test_anon') THEN CREATE ROLE api_test_anon; END IF; END \$\$; GRANT USAGE ON SCHEMA public TO api_test_anon; GRANT SELECT ON ALL TABLES IN SCHEMA public TO api_test_anon;");

        DB::beginTransaction();
        try {
            DB::statement('SET LOCAL ROLE api_test_anon');
            foreach (['sessions', 'migrations', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs'] as $table) {
                $this->assertSame(0, DB::table($table)->count());
            }
        } finally {
            DB::rollBack();
        }
    }

    private function legacyDatabase(): void
    {
        $this->resetDatabase(migrate: false);
        DB::unprepared(file_get_contents(base_path('tests/Fixtures/legacy.sql')));
    }
}
