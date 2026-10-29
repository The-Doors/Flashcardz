<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreReviewRequest;
use App\Models\Card;
use App\Models\Review;
use App\Models\User;
use App\Services\Fsrs\Rating;
use App\Services\Fsrs\Scheduler;
use App\Services\ReviewQueue;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class ReviewController extends Controller
{
    public function index(Request $request, ReviewQueue $queue): JsonResponse
    {
        Gate::authorize('viewAny', Review::class);
        $request->validate([
            'date' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'timezone' => ['sometimes', 'required', 'timezone'],
            'deck_id' => ['sometimes', 'required', 'integer', 'min:1'],
        ]);
        $now = CarbonImmutable::now('UTC');
        $timezone = $request->input('timezone', 'UTC');
        $today = $now->setTimezone($timezone)->toDateString();
        $date = $request->input('date', $today);
        $query = $queue->query($request->user(), $now, $timezone, $date, $request->has('deck_id') ? $request->integer('deck_id') : null);
        $nextCard = $date === $today ? $queue->nextCard($query, $now) : null;
        $cards = $query->paginate(25)->withQueryString()->through(function (Card $card) use ($queue, $nextCard, $date, $today): array {
            return array_diff_key($card->attributesToArray(), ['queue_priority' => true]) + [
                'latest_review_id' => $card->latestReview?->id,
                'schedule' => $queue->schedule($card)->toArray(),
                'can_review' => $date === $today && $queue->canReview($card, $nextCard),
            ];
        });

        return response()->json($cards->toArray() + ['meta' => ['date' => $date, 'timezone' => $timezone, 'next_card_id' => $nextCard?->id]]);
    }

    public function store(StoreReviewRequest $request, ReviewQueue $queue, Scheduler $scheduler): JsonResponse
    {
        $review = DB::transaction(function () use ($request, $queue, $scheduler): Review {
            User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            $card = Card::with('deck', 'latestReview')->lockForUpdate()->findOrFail($request->integer('card_id'));
            Gate::authorize('create', [Review::class, $card]);
            if ($request->has('deck_id') && $request->integer('deck_id') !== $card->deck_id) {
                throw ValidationException::withMessages(['deck_id' => 'The selected deck id is invalid.']);
            }

            $previousReviewId = $request->filled('previous_review_id') ? $request->integer('previous_review_id') : null;
            abort_if($card->latestReview?->id !== $previousReviewId, 409, 'The card has changed. Refresh the review queue.');
            $now = CarbonImmutable::now('UTC');
            $query = $queue->query($request->user(), $now, $request->input('timezone', 'UTC'), deckId: $request->has('deck_id') ? $request->integer('deck_id') : null);
            $candidate = (clone $query)->whereKey($card->id)->first();
            abort_unless($candidate && $queue->canReview($candidate, $queue->nextCard($query, $now)), 409, 'This card is not ready to review.');
            [$scheduled, $log] = $scheduler->reviewCard($queue->schedule($card), Rating::from($request->integer('rating')), $now, $request->input('review_duration') === null ? null : $request->integer('review_duration'));
            $review = $card->reviews()->make([
                'rating' => $log->rating,
                'review_datetime' => $log->reviewDateTime,
                'review_duration' => $log->reviewDuration,
                'state' => $scheduled->state,
                'step' => $scheduled->step,
                'stability' => $scheduled->stability,
                'difficulty' => $scheduled->difficulty,
                'due' => $scheduled->due,
            ]);
            $review->user()->associate($request->user());
            $review->save();

            return $review;
        });

        return response()->json($review->refresh()->withoutRelations(), 201);
    }

    public function undo(Request $request, Review $review): Response
    {
        DB::transaction(function () use ($request, $review): void {
            User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            $review = Review::with('card.deck')->findOrFail($review->id);
            Gate::authorize('undo', $review);
            $card = Card::lockForUpdate()->findOrFail($review->card_id);
            abort_if($card->latestReview?->id !== $review->id, 409, 'Only the latest review for this card can be undone.');
            $review->delete();
        });

        return response()->noContent();
    }
}
