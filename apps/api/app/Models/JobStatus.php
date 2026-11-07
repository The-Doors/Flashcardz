<?php

namespace App\Models;

use Database\Factories\JobStatusFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** @property array{stage: string, fetched_cards?: int, total_cards?: int|null}|null $progress */
class JobStatus extends Model
{
    /** @use HasFactory<JobStatusFactory> */
    use HasFactory;

    protected $table = 'app.job_statuses';

    protected $fillable = ['type', 'status', 'progress', 'error_code', 'error_message', 'deck_id', 'started_at', 'finished_at'];

    protected function casts(): array
    {
        return ['progress' => 'array', 'started_at' => 'datetime', 'finished_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function deck(): BelongsTo
    {
        return $this->belongsTo(Deck::class);
    }
}
