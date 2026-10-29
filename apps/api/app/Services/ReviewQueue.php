<?php

namespace App\Services;

use App\Models\Card;
use App\Models\Review;
use App\Models\User;
use App\Services\Fsrs\Card as FsrsCard;
use App\Services\Fsrs\State;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\JoinClause;

class ReviewQueue
{
    public function query(User $user, CarbonImmutable $now, string $timezone = 'UTC', ?string $date = null, ?int $deckId = null): Builder
    {
        $day = $date ? CarbonImmutable::createFromFormat('!Y-m-d', $date, $timezone) : $now->setTimezone($timezone)->startOfDay();
        $cutoff = $day->addDay()->utc()->format('Y-m-d H:i:s.u');
        $latestReviewId = Review::select('id')->whereColumn('card_id', 'app.cards.id')->orderByDesc('id')->limit(1);

        return Card::query()
            ->select('app.cards.*')
            ->selectRaw('CASE WHEN latest_review.id IS NULL THEN 2 WHEN latest_review.state = ? THEN 1 WHEN latest_review.due <= ? THEN 0 ELSE 3 END AS queue_priority', [State::Review->value, $now->format('Y-m-d H:i:s.u')])
            ->leftJoin('app.reviews as latest_review', fn (JoinClause $join) => $join->on('latest_review.card_id', '=', 'app.cards.id')->where('latest_review.id', '=', $latestReviewId))
            ->whereHas('deck', fn (Builder $query) => $query->where('user_id', $user->id))
            ->when($deckId !== null, fn (Builder $query) => $query->where('app.cards.deck_id', $deckId))
            ->where('app.cards.created_at', '<', $cutoff)
            ->where(fn (Builder $query) => $query->whereNull('latest_review.id')->orWhere('latest_review.due', '<', $cutoff))
            ->with('latestReview')
            ->orderBy('queue_priority')
            ->orderByRaw('COALESCE(latest_review.due, app.cards.created_at)')
            ->orderBy('app.cards.id');
    }

    public function nextCard(Builder $query, CarbonImmutable $now): ?Card
    {
        return (clone $query)->where(fn (Builder $query) => $query
            ->whereNull('latest_review.id')
            ->orWhere('latest_review.state', State::Review->value)
            ->orWhere('latest_review.due', '<=', $now->addMinutes(20)->format('Y-m-d H:i:s.u')))
            ->first();
    }

    public function canReview(Card $card, ?Card $nextCard): bool
    {
        return $card->queue_priority < 3 || $card->id === $nextCard?->id;
    }

    public function schedule(Card $card): FsrsCard
    {
        $review = $card->latestReview;

        return new FsrsCard(
            cardId: $card->id,
            state: $review?->state ?? State::Learning,
            step: $review?->step,
            stability: $review?->stability,
            difficulty: $review?->difficulty,
            due: $review?->due ?? CarbonImmutable::instance($card->created_at)->utc(),
            lastReview: $review?->review_datetime,
        );
    }
}
