<?php

namespace Tests\Feature;

use App\Models\JobStatus;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PostgresTestCase;

class JobControllerTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->resetDatabase();
    }

    public function test_returns_401_without_authentication_or_with_an_invalid_token(): void
    {
        $this->getJson('/api/jobs/1')->assertUnauthorized();
        $this->withToken('invalid')->getJson('/api/jobs/1')->assertUnauthorized();
    }

    public function test_returns_404_for_another_owners_job_and_missing_jobs(): void
    {
        $job = JobStatus::factory()->for($this->createUser())->create();

        $this->actingAs($this->createUser())->getJson("/api/jobs/{$job->id}")->assertNotFound();
        $this->getJson('/api/jobs/999')->assertNotFound();
        $this->getJson('/api/jobs/invalid')->assertNotFound();
    }

    #[DataProvider('statuses')]
    public function test_owner_can_poll_progress_errors_and_result(string $status): void
    {
        $owner = $this->createUser();
        $job = JobStatus::factory()->for($owner)->create([
            'status' => $status, 'progress' => ['stage' => 'fetching_cards', 'fetched_cards' => 500, 'total_cards' => 700],
            'error_code' => 'quizlet_unavailable', 'error_message' => 'The Quizlet set is private or unavailable.',
        ]);

        $this->actingAs($owner)->getJson("/api/jobs/{$job->id}")->assertOk()->assertJsonPath('id', $job->id)
            ->assertJsonPath('status', $status)->assertJsonPath('progress.fetched_cards', 500)
            ->assertJsonPath('progress.total_cards', 700)->assertJsonPath('error_code', 'quizlet_unavailable')
            ->assertJsonPath('error_message', 'The Quizlet set is private or unavailable.')
            ->assertJsonMissingPath('payload')->assertJsonMissingPath('exception');
    }

    public static function statuses(): array
    {
        return [['queued'], ['processing'], ['completed'], ['failed']];
    }
}
