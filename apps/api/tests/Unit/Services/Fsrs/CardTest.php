<?php

namespace Tests\Unit\Services\Fsrs;

use App\Services\Fsrs\Card;
use App\Services\Fsrs\State;
use DateTimeImmutable;
use JsonException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class CardTest extends TestCase
{
    /** @param array<string, mixed> $data */
    #[DataProvider('serializedCards')]
    public function test_scheduling_state_survives_array_and_json_round_trips(array $data): void
    {
        $card = Card::fromArray($data);

        $this->assertSame($data, $card->toArray());
        $this->assertSame($data, Card::fromJson($card->toJson())->toArray());
    }

    public function test_new_cards_are_due_in_utc_with_an_initial_learning_step(): void
    {
        $card = new Card(cardId: 123);

        $this->assertSame(123, $card->cardId);
        $this->assertSame(State::Learning, $card->state);
        $this->assertSame(0, $card->step);
        $this->assertSame(0, $card->due->getOffset());
        $this->assertNull($card->stability);
        $this->assertNull($card->difficulty);
        $this->assertNull($card->lastReview);
    }

    public function test_generated_ids_are_distinct_epoch_milliseconds(): void
    {
        $ids = [];

        for ($i = 0; $i < 25; $i++) {
            $ids[] = (new Card)->cardId;
        }

        $this->assertCount(25, array_unique($ids));
        $this->assertGreaterThan(1000000000000, $ids[0]);
    }

    public function test_review_cards_do_not_receive_a_learning_step(): void
    {
        $due = new DateTimeImmutable('2026-01-01T00:00:00Z');

        $card = new Card(cardId: 0, state: State::Review, due: $due);

        $this->assertSame(0, $card->cardId);
        $this->assertSame($due, $card->due);
        $this->assertNull($card->step);
    }

    public function test_invalid_json_is_rejected(): void
    {
        $this->expectException(JsonException::class);

        Card::fromJson('{');
    }

    /** @return iterable<string, array{0: array}> */
    public static function serializedCards(): iterable
    {
        $new = ['card_id' => 1, 'state' => 1, 'step' => 0, 'stability' => null, 'difficulty' => null,
            'due' => '2026-01-01T00:00:00+00:00', 'last_review' => null];
        yield 'new' => [$new];
        yield 'learning' => [array_replace($new, ['step' => 1, 'stability' => 2.0, 'difficulty' => 6.4,
            'last_review' => '2025-12-31T23:50:00+00:00'])];
        yield 'review' => [array_replace($new, ['state' => 2, 'step' => null, 'stability' => 12.3, 'difficulty' => 1.0,
            'last_review' => '2025-12-31T00:00:00+00:00'])];
        yield 'relearning' => [array_replace($new, ['state' => 3, 'step' => 0, 'stability' => 2.3, 'difficulty' => 10.0,
            'last_review' => '2025-12-31T23:50:00+00:00'])];
        yield 'microseconds and offset' => [array_replace($new, ['due' => '2026-01-01T00:00:00.000001+05:30',
            'last_review' => '2025-12-31T00:00:00.123456+05:30'])];
    }
}
