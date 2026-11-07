<?php

namespace Tests\Feature;

use App\Models\Deck;
use App\Models\JobStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Support\PostgresTestCase;

class JobStatusMigrationTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->resetDatabase();
    }

    public function test_status_migration_can_be_rolled_back_and_reapplied_without_dropping_the_queue(): void
    {
        $this->artisan('migrate:rollback', ['--step' => 1, '--force' => true])->assertExitCode(0);

        $this->assertFalse(Schema::hasTable('app.job_statuses'));
        $this->assertTrue(Schema::hasTable('jobs'));
        $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
        $this->assertDatabaseCount('app.job_statuses', 0);
    }

    public function test_deleting_an_imported_deck_preserves_the_job_history(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $job = JobStatus::factory()->for($owner)->for($deck)->create(['status' => 'completed']);

        $deck->forceDelete();

        $this->assertDatabaseHas('app.job_statuses', ['id' => $job->id, 'status' => 'completed', 'deck_id' => null]);
    }

    public function test_jobs_are_inaccessible_to_supabase_data_api_roles(): void
    {
        JobStatus::factory()->for($this->createUser())->create();
        DB::unprepared("DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'api_test_job_anon') THEN CREATE ROLE api_test_job_anon; END IF; END \$\$; GRANT USAGE ON SCHEMA app TO api_test_job_anon; GRANT SELECT ON ALL TABLES IN SCHEMA app TO api_test_job_anon;");

        DB::beginTransaction();
        try {
            DB::statement('SET LOCAL ROLE api_test_job_anon');
            $this->assertDatabaseCount('app.job_statuses', 0);
        } finally {
            DB::rollBack();
        }
    }
}
