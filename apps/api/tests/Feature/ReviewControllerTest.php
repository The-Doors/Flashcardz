<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\Deck;
use App\Models\Review;
use App\Models\User;
use App\Services\Fsrs\Scheduler;
use App\Services\Fsrs\State;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Concurrency;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PostgresTestCase;

class ReviewControllerTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->resetDatabase();
        $this->travelTo(CarbonImmutable::parse('2026-10-28 12:00:00', 'UTC'));
        $this->app->instance(Scheduler::class, new Scheduler(enableFuzzing: false));
    }

    #[DataProvider('endpoints')]
    public function test_returns_401_without_authentication(string $method, string $path): void
    {
        $this->json($method, $path)->assertUnauthorized();
        $this->assertDatabaseCount('app.reviews', 0);
    }

    public static function endpoints(): array
    {
        return [['GET', '/api/reviews'], ['POST', '/api/reviews'], ['POST', '/api/reviews/1/undo']];
    }

    public function test_lists_owned_due_and_new_cards_with_readiness_and_queue_priority(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $new = Card::factory()->for($deck)->create();
        $due = Review::factory()->for(Card::factory()->for($deck))->create(['due' => now()->addHours(3)]);
        $learning = Review::factory()->learning()->for(Card::factory()->for($deck))->create(['due' => now()->subMinute()]);
        $waiting = Review::factory()->learning()->for(Card::factory()->for($deck))->create();
        Review::factory()->for(Card::factory()->for($deck))->create(['due' => now()->addDay()]);
        Card::factory()->for($deck)->trashed()->create();
        Card::factory()->for(Deck::factory()->for($owner)->trashed())->create();
        Card::factory()->for(Deck::factory()->for($this->createUser())->public())->create();

        $response = $this->actingAs($owner)->getJson('/api/reviews')->assertOk()
            ->assertJsonPath('meta', ['date' => '2026-10-28', 'timezone' => 'UTC', 'next_card_id' => $learning->card_id])
            ->assertJsonCount(4, 'data')->assertJsonPath('data.0.can_review', true)
            ->assertJsonPath('data.1.can_review', true)->assertJsonPath('data.2.can_review', true)
            ->assertJsonPath('data.3.can_review', false)->assertJsonPath('data.2.latest_review_id', null)
            ->assertJsonPath('data.2.schedule.state', State::Learning->value)
            ->assertJsonPath('data.2.schedule.step', 0)->assertJsonMissingPath('data.0.queue_priority')
            ->assertJsonMissingPath('data.0.latest_review');

        $this->assertSame([$learning->card_id, $due->card_id, $new->id, $waiting->card_id], array_column($response->json('data'), 'id'));
    }

    public function test_includes_overdue_cards_and_only_the_latest_active_schedule(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $card = Card::factory()->for($deck)->create();
        Review::factory()->for($card)->create(['due' => now()->subDays(3)]);
        $latest = Review::factory()->for($card)->create(['due' => now()->addDays(5)]);
        $overdue = Review::factory()->for(Card::factory()->for($deck))->create(['due' => now()->subDays(10)]);
        $this->actingAs($owner);

        $this->getJson('/api/reviews')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $overdue->card_id);
        $this->postJson("/api/reviews/{$latest->id}/undo")->assertNoContent();
        $this->getJson('/api/reviews')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_paginates_stably_and_preserves_filters_and_global_next_card(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $cards = Card::factory()->count(26)->for($deck)->create();
        Card::factory()->for(Deck::factory()->for($owner))->create();
        $this->actingAs($owner);

        $response = $this->getJson("/api/reviews?deck_id={$deck->id}&timezone=UTC&page=2")->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('total', 26)->assertJsonPath('data.0.id', $cards->last()->id)
            ->assertJsonPath('meta.next_card_id', $cards->first()->id);

        $this->assertStringContainsString("deck_id={$deck->id}", $response->json('prev_page_url'));
        $this->assertStringContainsString('timezone=UTC', $response->json('prev_page_url'));
    }

    #[DataProvider('localDays')]
    public function test_uses_local_midnight_boundaries_including_dst(string $at, string $day, string $cutoff): void
    {
        $this->travelTo(CarbonImmutable::parse($at));
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $inside = Review::factory()->for(Card::factory()->for($deck))->create(['due' => CarbonImmutable::parse($cutoff)->subMicrosecond()]);
        Review::factory()->for(Card::factory()->for($deck))->create(['due' => $cutoff]);

        $this->actingAs($owner)->getJson('/api/reviews?timezone=America%2FChicago')->assertOk()
            ->assertJsonPath('meta.date', $day)->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $inside->card_id);
    }

    public static function localDays(): array
    {
        return [
            'local day differs from UTC' => ['2026-10-29T02:00:00Z', '2026-10-28', '2026-10-29T05:00:00Z'],
            '23-hour day' => ['2026-03-08T07:00:00Z', '2026-03-08', '2026-03-09T05:00:00Z'],
            '25-hour day' => ['2026-11-01T06:00:00Z', '2026-11-01', '2026-11-02T06:00:00Z'],
        ];
    }

    public function test_other_dates_preview_the_current_schedule_without_authorizing_reviews(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $new = Card::factory()->for($deck)->create();
        $future = Review::factory()->for(Card::factory()->for($deck))->create(['due' => now()->addDays(2)]);
        $this->actingAs($owner);

        $this->getJson('/api/reviews?date=2026-10-30')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.next_card_id', null)->assertJsonPath('data.0.can_review', false)->assertJsonPath('data.1.can_review', false);
        $this->getJson('/api/reviews?date=2026-10-27')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/reviews', ['card_id' => $future->card_id, 'rating' => 3, 'previous_review_id' => $future->id])->assertConflict();
        $this->assertDatabaseCount('app.reviews', 1);
        $this->assertModelExists($new);
    }

    public function test_new_card_answers_log_learning_then_graduate_using_fsrs(): void
    {
        $owner = $this->createUser();
        $card = Card::factory()->for(Deck::factory()->for($owner))->create();
        $this->actingAs($owner);

        $first = $this->postJson('/api/reviews', ['card_id' => $card->id, 'rating' => 3, 'previous_review_id' => null, 'review_duration' => 1234])
            ->assertCreated()->assertJsonPath('user_id', $owner->id)->assertJsonPath('card_id', $card->id)
            ->assertJsonPath('state', 1)->assertJsonPath('step', 1)->assertJsonPath('due', '2026-10-28T12:10:00.000000Z')
            ->assertJsonPath('review_datetime', '2026-10-28T12:00:00.000000Z')->assertJsonPath('review_duration', 1234)
            ->assertJsonMissingPath('user')->assertJsonMissingPath('deleted_at');
        $this->assertDatabaseHas('app.reviews', ['id' => $first->json('id'), 'rating' => 3, 'review_duration' => 1234, 'step' => 1]);
        $this->getJson('/api/reviews')->assertOk()->assertJsonPath('data.0.latest_review_id', $first->json('id'))->assertJsonPath('data.0.can_review', true);
        $this->travelTo(CarbonImmutable::parse('2026-10-28T12:10:00Z'));
        $second = $this->postJson('/api/reviews', ['card_id' => $card->id, 'rating' => 3, 'previous_review_id' => $first->json('id')])
            ->assertCreated()->assertJsonPath('state', 2)->assertJsonPath('step', null)->assertJsonPath('review_duration', null);

        $this->assertGreaterThanOrEqual('2026-10-29', substr($second->json('due'), 0, 10));
        $this->assertDatabaseCount('app.reviews', 2);
        $this->getJson('/api/reviews')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.next_card_id', null);
        $this->postJson('/api/reviews', ['card_id' => $card->id, 'rating' => 3, 'previous_review_id' => $second->json('id')])->assertConflict();
    }

    #[DataProvider('ratings')]
    public function test_accepts_all_fsrs_ratings_and_persists_their_resulting_state(int $rating, int $state, ?int $step, ?string $due): void
    {
        $owner = $this->createUser();
        $card = Card::factory()->for(Deck::factory()->for($owner))->create();

        $response = $this->actingAs($owner)->postJson('/api/reviews', ['card_id' => $card->id, 'rating' => $rating, 'previous_review_id' => null])
            ->assertCreated()->assertJsonPath('rating', $rating)->assertJsonPath('state', $state)->assertJsonPath('step', $step);

        $this->assertDatabaseHas('app.reviews', ['id' => $response->json('id'), 'rating' => $rating, 'state' => $state, 'step' => $step]);
        if ($due !== null) {
            $response->assertJsonPath('due', $due);
        }
    }

    public static function ratings(): array
    {
        return [
            'again' => [1, 1, 0, '2026-10-28T12:01:00.000000Z'],
            'hard' => [2, 1, 0, '2026-10-28T12:05:30.000000Z'],
            'easy graduates immediately' => [4, 2, null, '2026-11-05T12:00:00.000000Z'],
        ];
    }

    public function test_failed_review_relearns_and_can_graduate_again(): void
    {
        $owner = $this->createUser();
        $review = Review::factory()->for(Card::factory()->for(Deck::factory()->for($owner)))->create();
        $this->actingAs($owner);

        $lapse = $this->postJson('/api/reviews', ['card_id' => $review->card_id, 'rating' => 1, 'previous_review_id' => $review->id])
            ->assertCreated()->assertJsonPath('state', 3)->assertJsonPath('step', 0)->assertJsonPath('due', '2026-10-28T12:10:00.000000Z');
        $this->postJson('/api/reviews', ['card_id' => $review->card_id, 'rating' => 3, 'previous_review_id' => $lapse->json('id')])
            ->assertCreated()->assertJsonPath('state', 2)->assertJsonPath('step', null);
        $this->assertDatabaseCount('app.reviews', 3);
    }

    public function test_learn_ahead_waits_for_ready_cards_and_respects_the_deck_filter(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $review = Review::factory()->learning()->for(Card::factory()->for($deck))->create();
        $ready = Card::factory()->for(Deck::factory()->for($owner))->create();
        $this->actingAs($owner);
        $payload = ['card_id' => $review->card_id, 'rating' => 3, 'previous_review_id' => $review->id];

        $this->getJson('/api/reviews')->assertOk()->assertJsonPath('meta.next_card_id', $ready->id)->assertJsonPath('data.1.can_review', false);
        $this->postJson('/api/reviews', $payload)->assertConflict();
        $this->getJson("/api/reviews?deck_id={$deck->id}")->assertOk()->assertJsonPath('meta.next_card_id', $review->card_id)->assertJsonPath('data.0.can_review', true);
        $this->postJson('/api/reviews', $payload + ['deck_id' => $deck->id])->assertCreated();
        $this->assertDatabaseCount('app.reviews', 2);
    }

    #[DataProvider('learnAheadTimes')]
    public function test_learn_ahead_enforces_the_window_and_same_day_cutoff(string $now, string $due, bool $allowed): void
    {
        $this->travelTo(CarbonImmutable::parse($now));
        $owner = $this->createUser();
        $review = Review::factory()->learning()->for(Card::factory()->for(Deck::factory()->for($owner)))->create(['due' => $due]);
        $this->actingAs($owner);

        $response = $this->postJson('/api/reviews', ['card_id' => $review->card_id, 'rating' => 3, 'previous_review_id' => $review->id]);

        if ($allowed) {
            $response->assertCreated();
        } else {
            $response->assertConflict();
        }
        $this->assertDatabaseCount('app.reviews', $allowed ? 2 : 1);
    }

    public static function learnAheadTimes(): array
    {
        return [
            'due now' => ['2026-10-28T12:00:00Z', '2026-10-28T12:00:00Z', true],
            '20 minutes' => ['2026-10-28T12:00:00Z', '2026-10-28T12:20:00Z', true],
            'outside window by a microsecond' => ['2026-10-28T12:00:00Z', '2026-10-28T12:20:00.000001Z', false],
            'next day' => ['2026-10-28T23:55:00Z', '2026-10-29T00:00:00Z', false],
        ];
    }

    public function test_only_the_earliest_future_step_can_be_reviewed_ahead(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $first = Review::factory()->learning()->for(Card::factory()->for($deck))->create(['due' => now()->addMinutes(5)]);
        $second = Review::factory()->learning()->for(Card::factory()->for($deck))->create();
        $this->actingAs($owner);

        $this->getJson('/api/reviews')->assertOk()->assertJsonPath('meta.next_card_id', $first->card_id)
            ->assertJsonPath('data.0.can_review', true)->assertJsonPath('data.1.can_review', false);
        $this->postJson('/api/reviews', ['card_id' => $second->card_id, 'rating' => 3, 'previous_review_id' => $second->id])->assertConflict();
        $this->assertDatabaseCount('app.reviews', 2);
    }

    public function test_undo_restores_exact_snapshot_and_then_the_new_card_state(): void
    {
        $owner = $this->createUser();
        $card = Card::factory()->for(Deck::factory()->for($owner))->create();
        $this->actingAs($owner);
        $first = $this->postJson('/api/reviews', ['card_id' => $card->id, 'rating' => 3, 'previous_review_id' => null])->assertCreated()->json('id');
        $before = $this->getJson('/api/reviews')->assertOk()->json('data.0.schedule');
        $second = $this->postJson('/api/reviews', ['card_id' => $card->id, 'rating' => 3, 'previous_review_id' => $first])->assertCreated()->json('id');

        $this->postJson("/api/reviews/{$first}/undo")->assertConflict();
        $this->postJson("/api/reviews/{$second}/undo")->assertNoContent();
        $this->assertSoftDeleted('app.reviews', ['id' => $second]);
        $this->getJson('/api/reviews')->assertOk()->assertJsonPath('data.0.schedule', $before)->assertJsonPath('data.0.latest_review_id', $first);
        $this->postJson("/api/reviews/{$second}/undo")->assertNotFound();
        $this->postJson("/api/reviews/{$first}/undo")->assertNoContent();
        $this->getJson('/api/reviews')->assertOk()->assertJsonPath('data.0.latest_review_id', null)
            ->assertJsonPath('data.0.schedule.step', 0)->assertJsonPath('data.0.schedule.stability', null)
            ->assertJsonPath('data.0.schedule.last_review', null)->assertJsonPath('data.0.can_review', true);
        $this->assertDatabaseCount('app.reviews', 2);
        $this->assertSame(0, $card->reviews()->count());
    }

    public function test_duplicate_and_stale_answers_return_409_without_advancing_the_card(): void
    {
        $owner = $this->createUser();
        $card = Card::factory()->for(Deck::factory()->for($owner))->create();
        $this->actingAs($owner);
        $payload = ['card_id' => $card->id, 'rating' => 3, 'previous_review_id' => null];

        $first = $this->postJson('/api/reviews', $payload)->assertCreated()->json('id');
        $this->postJson('/api/reviews', $payload)->assertConflict();
        $this->postJson('/api/reviews', array_replace($payload, ['previous_review_id' => $first + 100]))->assertConflict();
        $this->assertDatabaseCount('app.reviews', 1);
    }

    public function test_foreign_and_deleted_cards_and_reviews_return_404(): void
    {
        $owner = $this->createUser();
        $foreign = Review::factory()->for(Card::factory()->for(Deck::factory()->for($this->createUser())->public()))->create();
        $deleted = Review::factory()->for(Card::factory()->for(Deck::factory()->for($owner)))->create();
        $deleted->card->delete();
        $deletedDeck = Review::factory()->for(Card::factory()->for(Deck::factory()->for($owner)))->create();
        $deletedDeck->card->deck->delete();
        $this->actingAs($owner);

        foreach ([$foreign, $deleted, $deletedDeck] as $review) {
            $this->postJson('/api/reviews', ['card_id' => $review->card_id, 'rating' => 3, 'previous_review_id' => $review->id])->assertNotFound();
            $this->postJson("/api/reviews/{$review->id}/undo")->assertNotFound();
        }
        $this->postJson('/api/reviews', ['card_id' => 999, 'rating' => 3, 'previous_review_id' => null])->assertNotFound();
        $this->assertDatabaseCount('app.reviews', 3);
    }

    public function test_missing_fields_return_422(): void
    {
        $this->actingAs($this->createUser())->postJson('/api/reviews', [])->assertUnprocessable()->assertJsonValidationErrors([
            'card_id' => 'The card id field is required.',
            'rating' => 'The rating field is required.',
            'previous_review_id' => 'The previous review id field must be present.',
        ]);
        $this->assertDatabaseCount('app.reviews', 0);
    }

    #[DataProvider('invalidInputs')]
    public function test_invalid_review_input_returns_422(string $field, mixed $value, string $message): void
    {
        $owner = $this->createUser();
        $card = Card::factory()->for(Deck::factory()->for($owner))->create();

        $this->actingAs($owner)->postJson('/api/reviews', array_replace(['card_id' => $card->id, 'rating' => 3, 'previous_review_id' => null], [$field => $value]))
            ->assertUnprocessable()->assertJsonValidationErrors([$field => $message]);
        $this->assertDatabaseCount('app.reviews', 0);
    }

    public static function invalidInputs(): array
    {
        return [
            'card type' => ['card_id', 'invalid', 'The card id field must be an integer.'],
            'card minimum' => ['card_id', 0, 'The card id field must be at least 1.'],
            'rating type' => ['rating', 1.5, 'The rating field must be an integer.'],
            'rating enum' => ['rating', 5, 'The selected rating is invalid.'],
            'previous id type' => ['previous_review_id', 'invalid', 'The previous review id field must be an integer.'],
            'previous id minimum' => ['previous_review_id', 0, 'The previous review id field must be at least 1.'],
            'duration negative' => ['review_duration', -1, 'The review duration field must be at least 0.'],
            'duration fractional' => ['review_duration', 1.5, 'The review duration field must be an integer.'],
            'duration overflow' => ['review_duration', 2147483648, 'The review duration field must not be greater than 2147483647.'],
            'timezone' => ['timezone', 'invalid', 'The timezone field must be a valid timezone.'],
            'deck type' => ['deck_id', 'invalid', 'The deck id field must be an integer.'],
            'deck minimum' => ['deck_id', 0, 'The deck id field must be at least 1.'],
            'deck mismatch' => ['deck_id', 999, 'The selected deck id is invalid.'],
            'preview date' => ['date', '2026-10-30', 'The date field is prohibited.'],
            'owner' => ['user_id', 'other', 'The user id field is prohibited.'],
            'timestamp' => ['review_datetime', '2026-10-30', 'The review datetime field is prohibited.'],
            'last review' => ['last_review', '2026-10-30', 'The last review field is prohibited.'],
            'due' => ['due', '2026-10-30', 'The due field is prohibited.'],
            'state' => ['state', 2, 'The state field is prohibited.'],
            'step' => ['step', 1, 'The step field is prohibited.'],
            'stability' => ['stability', 5, 'The stability field is prohibited.'],
            'difficulty' => ['difficulty', 5, 'The difficulty field is prohibited.'],
        ];
    }

    #[DataProvider('invalidQueueInputs')]
    public function test_invalid_queue_input_returns_422(string $query, string $field): void
    {
        $this->actingAs($this->createUser())->getJson('/api/reviews?'.$query)->assertUnprocessable()->assertJsonValidationErrors([$field]);
    }

    public static function invalidQueueInputs(): array
    {
        return [['date=2026-02-30', 'date'], ['date=tomorrow', 'date'], ['timezone=invalid', 'timezone'], ['deck_id=invalid', 'deck_id']];
    }

    public function test_concurrent_answers_create_only_one_review(): void
    {
        $owner = $this->createUser();
        $card = Card::factory()->for(Deck::factory()->for($owner))->create();
        $userId = $owner->id;
        $cardId = $card->id;
        $connection = config('database.connections.pgsql_testing');
        $answer = static function () use ($userId, $cardId, $connection): int {
            config(['database.connections.pgsql_testing' => $connection]);
            DB::setDefaultConnection('pgsql_testing');
            DB::purge('pgsql_testing');
            Auth::guard()->setUser(User::findOrFail($userId));
            $request = Request::create('/api/reviews', 'POST', ['card_id' => $cardId, 'rating' => 3, 'previous_review_id' => null], server: ['HTTP_ACCEPT' => 'application/json']);

            return app(Kernel::class)->handle($request)->getStatusCode();
        };

        $statuses = Concurrency::driver('process')->run([$answer, $answer]);
        sort($statuses);

        $this->assertSame([201, 409], $statuses);
        $this->assertDatabaseCount('app.reviews', 1);
    }
}
