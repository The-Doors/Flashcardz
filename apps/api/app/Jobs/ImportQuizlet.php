<?php

namespace App\Jobs;

use App\Models\JobStatus;
use App\Services\Quizlet\ImportFromQuizlet;
use App\Services\Quizlet\QuizletImportException;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Attributes\FailOnTimeout;
use Illuminate\Queue\Attributes\Timeout;
use Illuminate\Queue\Attributes\Tries;
use Illuminate\Queue\TimeoutExceededException;
use Illuminate\Support\Facades\DB;
use Throwable;

#[Tries(1), Timeout(900), FailOnTimeout]
class ImportQuizlet implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $jobStatusId, public string $setId) {}

    public function handle(ImportFromQuizlet $quizlet): void
    {
        $job = JobStatus::find($this->jobStatusId);

        if ($job === null || $job->status === 'completed') {
            return;
        }

        $job->update(['status' => 'processing', 'started_at' => now(), 'finished_at' => null, 'error_code' => null, 'error_message' => null]);
        $data = $quizlet->fetch($this->setId, function (string $stage, array $progress) use ($job): void {
            $job->update(['progress' => ['stage' => $stage] + $progress]);
        });
        $job->update(['progress' => ['stage' => 'saving_deck', 'fetched_cards' => count($data['cards']), 'total_cards' => count($data['cards'])]]);

        DB::transaction(function () use ($job, $data): void {
            $job = JobStatus::lockForUpdate()->find($job->id);

            if ($job === null || $job->status === 'completed') {
                return;
            }

            $deck = $job->user->decks()->create(['name' => $data['name'], 'description' => $data['description'], 'is_public' => false]);

            foreach (array_chunk($data['cards'], 500) as $cards) {
                $deck->cards()->insert(array_map(fn (string $content): array => [
                    'deck_id' => $deck->id, 'creator_id' => $job->user_id, 'content' => $content, 'created_at' => now(), 'updated_at' => now(),
                ], $cards));
            }

            $job->update(['status' => 'completed', 'deck_id' => $deck->id, 'finished_at' => now(),
                'progress' => ['stage' => 'completed', 'fetched_cards' => count($data['cards']), 'total_cards' => count($data['cards'])]]);
        });
    }

    public function failed(?Throwable $exception): void
    {
        JobStatus::whereKey($this->jobStatusId)->where('status', '!=', 'completed')->update([
            'status' => 'failed', 'finished_at' => now(),
            'error_code' => $exception instanceof QuizletImportException ? $exception->errorCode
                : ($exception instanceof TimeoutExceededException ? 'job_timed_out' : 'import_failed'),
            'error_message' => $exception instanceof QuizletImportException ? $exception->getMessage() : 'The import failed. Please try again.',
        ]);
    }
}
