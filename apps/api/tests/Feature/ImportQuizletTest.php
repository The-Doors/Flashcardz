<?php

namespace Tests\Feature;

use App\Jobs\ImportQuizlet;
use App\Models\Deck;
use App\Models\JobStatus;
use Illuminate\Queue\TimeoutExceededException;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Support\PostgresTestCase;

class ImportQuizletTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->resetDatabase();
        config(['queue.default' => 'database', 'queue.failed.database' => 'pgsql_testing', 'services.zenrows.api_key' => 'test-key']);
        Http::preventStrayRequests();
    }

    public function test_worker_imports_a_private_deck_and_preserves_the_completed_status_for_polling(): void
    {
        $owner = $this->createUser();
        Http::fake(['https://api.zenrows.com/v1/*' => Http::sequence()
            ->push(file_get_contents(base_path('tests/Fixtures/quizlet-set.json')))
            ->push(file_get_contents(base_path('tests/Fixtures/quizlet-cards.json')))]);

        $response = $this->actingAs($owner)->postJson('/api/quizlet/import', ['source' => 123])->assertAccepted();
        $this->assertDatabaseCount('jobs', 1);
        $this->assertDatabaseCount('app.decks', 0);
        $this->work();

        $deck = Deck::sole();
        $this->assertDatabaseHas('app.decks', ['id' => $deck->id, 'name' => 'Biology', 'description' => 'Cell basics', 'user_id' => $owner->id, 'is_public' => false]);
        $this->assertDatabaseHas('app.cards', ['deck_id' => $deck->id, 'creator_id' => $owner->id, 'content' => "Cell\n\n<!-- card:back -->\n\nBasic unit of life"]);
        $this->assertDatabaseHas('app.cards', ['deck_id' => $deck->id, 'creator_id' => $owner->id, 'content' => "Nucleus\n\n<!-- card:back -->\n\nContains DNA"]);
        $this->assertDatabaseCount('app.cards', 2);
        $this->assertDatabaseCount('jobs', 0);
        $this->getJson('/api/jobs/'.$response->json('id'))->assertOk()->assertJsonPath('status', 'completed')
            ->assertJsonPath('deck_id', $deck->id)->assertJsonPath('progress.fetched_cards', 2)
            ->assertJsonPath('progress.total_cards', 2)->assertJsonPath('error_message', null)
            ->assertJsonStructure(['started_at', 'finished_at']);
        Http::assertSentCount(2);
    }

    public function test_worker_records_safe_errors_and_keeps_progress_without_creating_partial_decks(): void
    {
        $job = JobStatus::factory()->for($this->createUser())->create();
        Http::fake(['https://api.zenrows.com/v1/*' => Http::sequence()
            ->push(file_get_contents(base_path('tests/Fixtures/quizlet-set.json')))
            ->push(['code' => 'AUTH_001', 'message' => 'secret upstream details'], 401)]);
        Bus::dispatch(new ImportQuizlet($job->id, '123'));

        $this->work();

        $this->assertDatabaseHas('app.job_statuses', ['id' => $job->id, 'status' => 'failed', 'error_code' => 'quizlet_configuration_error', 'error_message' => 'The Quizlet import service is not configured correctly.', 'deck_id' => null]);
        $this->assertSame('fetching_cards', $job->refresh()->progress['stage']);
        $this->assertNotNull($job->finished_at);
        $this->assertDatabaseCount('app.decks', 0);
        $this->assertDatabaseCount('app.cards', 0);
        $this->assertDatabaseCount('failed_jobs', 1);
        $this->assertDatabaseCount('jobs', 0);
        Http::assertSentCount(2);
    }

    public function test_database_failure_rolls_back_the_entire_deck_and_hides_internal_error_details(): void
    {
        $job = JobStatus::factory()->for($this->createUser())->create();
        DB::statement("ALTER TABLE app.cards ADD CONSTRAINT reject_test_card CHECK (content NOT LIKE 'Nucleus%')");
        Http::fake(['https://api.zenrows.com/v1/*' => Http::sequence()
            ->push(file_get_contents(base_path('tests/Fixtures/quizlet-set.json')))
            ->push(file_get_contents(base_path('tests/Fixtures/quizlet-cards.json')))]);
        Bus::dispatch(new ImportQuizlet($job->id, '123'));

        $this->work();

        $this->assertDatabaseCount('app.decks', 0);
        $this->assertDatabaseCount('app.cards', 0);
        $this->assertDatabaseHas('app.job_statuses', ['id' => $job->id, 'status' => 'failed', 'error_code' => 'import_failed', 'error_message' => 'The import failed. Please try again.']);
        Http::assertSentCount(2);
    }

    public function test_completed_jobs_are_not_imported_twice_or_overwritten_by_a_late_failure(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $job = JobStatus::factory()->for($owner)->create(['status' => 'completed', 'deck_id' => $deck->id]);
        Bus::dispatch(new ImportQuizlet($job->id, '123'));

        $this->work();
        (new ImportQuizlet($job->id, '123'))->failed(new TimeoutExceededException);

        $this->assertDatabaseCount('app.decks', 1);
        $this->assertDatabaseHas('app.job_statuses', ['id' => $job->id, 'status' => 'completed', 'deck_id' => $deck->id]);
        Http::assertNothingSent();
    }

    public function test_timeout_failure_updates_the_polling_status(): void
    {
        $job = JobStatus::factory()->for($this->createUser())->create(['status' => 'processing']);

        (new ImportQuizlet($job->id, '123'))->failed(new TimeoutExceededException);

        $this->assertDatabaseHas('app.job_statuses', ['id' => $job->id, 'status' => 'failed', 'error_code' => 'job_timed_out']);
        $this->assertNotNull($job->refresh()->finished_at);
    }

    public function test_deleted_owners_jobs_are_discarded_without_contacting_quizlet(): void
    {
        $owner = $this->createUser();
        $job = JobStatus::factory()->for($owner)->create();
        Bus::dispatch(new ImportQuizlet($job->id, '123'));
        $owner->delete();

        $this->work();

        $this->assertDatabaseCount('app.job_statuses', 0);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertDatabaseCount('failed_jobs', 0);
        Http::assertNothingSent();
    }

    private function work(): void
    {
        $this->artisan('queue:work', ['connection' => 'database', '--once' => true, '--tries' => 1])->assertExitCode(0);
    }
}
