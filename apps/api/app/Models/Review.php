<?php

namespace App\Models;

use App\Services\Fsrs\Rating;
use App\Services\Fsrs\State;
use Database\Factories\ReviewFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Review extends Model
{
    /** @use HasFactory<ReviewFactory> */
    use HasFactory;

    use SoftDeletes;

    protected $table = 'app.reviews';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['rating', 'review_datetime', 'review_duration', 'state', 'step', 'stability', 'difficulty', 'due'];

    protected $hidden = ['deleted_at'];

    protected function casts(): array
    {
        return [
            'rating' => Rating::class,
            'state' => State::class,
            'step' => 'integer',
            'stability' => 'double',
            'difficulty' => 'double',
            'review_duration' => 'integer',
            'review_datetime' => 'immutable_datetime',
            'due' => 'immutable_datetime',
        ];
    }

    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
