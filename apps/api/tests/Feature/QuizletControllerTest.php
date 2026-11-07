<?php

namespace Tests\Feature;

use App\Jobs\ImportQuizlet;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PostgresTestCase;

class QuizletControllerTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->resetDatabase();
    }

    public function test_returns_401_without_authentication(): void
    {
        Queue::fake();

        $this->postJson('/api/quizlet/import', ['source' => '123'])->assertUnauthorized();

        Queue::assertNothingPushed();
        $this->assertDatabaseCount('app.job_statuses', 0);
    }

    public function test_returns_401_with_an_invalid_token(): void
    {
        $this->withToken('invalid')->postJson('/api/quizlet/import', ['source' => '123'])->assertUnauthorized();
        $this->assertDatabaseCount('app.job_statuses', 0);
    }

    public function test_returns_202_and_queues_an_import_owned_by_the_current_user(): void
    {
        $owner = $this->createUser();
        Queue::fake([ImportQuizlet::class]);
        Http::preventStrayRequests();

        $response = $this->actingAs($owner)->postJson('/api/quizlet/import', [
            'source' => 'https://www.quizlet.com/en-gb/123/biology-flash-cards/',
            'user_id' => $this->createUser()->id, 'status' => 'completed', 'deck_id' => 999,
        ])->assertAccepted()->assertJsonPath('type', 'quizlet_import')->assertJsonPath('status', 'queued')
            ->assertJsonPath('user_id', $owner->id)->assertJsonPath('deck_id', null);

        $response->assertHeader('Location', url('/api/jobs/'.$response->json('id')));
        $this->assertDatabaseHas('app.job_statuses', ['id' => $response->json('id'), 'user_id' => $owner->id, 'status' => 'queued']);
        $this->assertDatabaseCount('app.decks', 0);
        Queue::assertPushed(ImportQuizlet::class, fn (ImportQuizlet $job): bool => $job->jobStatusId === $response->json('id') && $job->setId === '123');
        Http::assertNothingSent();
    }

    #[DataProvider('invalidSources')]
    public function test_invalid_source_returns_422_without_queuing(array $payload, string $message): void
    {
        Queue::fake();

        $this->actingAs($this->createUser())->postJson('/api/quizlet/import', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors(['source' => $message]);

        Queue::assertNothingPushed();
        $this->assertDatabaseCount('app.job_statuses', 0);
    }

    public static function invalidSources(): array
    {
        return [
            'missing' => [[], 'The source field is required.'],
            'blank' => [['source' => '  '], 'The source field is required.'],
            'invalid URL' => [['source' => 'https://example.com/123'], 'Enter a valid Quizlet set ID or HTTPS set URL.'],
            'array' => [['source' => ['123']], 'Enter a valid Quizlet set ID or HTTPS set URL.'],
            'boolean' => [['source' => true], 'Enter a valid Quizlet set ID or HTTPS set URL.'],
            'float' => [['source' => 1.5], 'Enter a valid Quizlet set ID or HTTPS set URL.'],
            'too long' => [['source' => str_repeat('1', 2049)], 'Enter a valid Quizlet set ID or HTTPS set URL.'],
        ];
    }

    public function test_queue_failure_does_not_leave_an_orphaned_status_record(): void
    {
        config(['queue.default' => 'database', 'queue.connections.database.table' => 'missing_queue_table']);

        $this->actingAs($this->createUser())->postJson('/api/quizlet/import', ['source' => '123'])->assertInternalServerError();

        $this->assertDatabaseCount('app.job_statuses', 0);
        $this->assertDatabaseCount('jobs', 0);
    }
}
