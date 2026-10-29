<?php

namespace Tests\Unit\Services\Fsrs;

use App\Services\Fsrs\Card;
use App\Services\Fsrs\Rating;
use App\Services\Fsrs\ReviewLog;
use App\Services\Fsrs\Scheduler;
use App\Services\Fsrs\State;
use DateTimeImmutable;
use InvalidArgumentException;
use JsonException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class SchedulerTest extends TestCase
{
    /** @param array<string, mixed> $case */
    #[DataProvider('pythonReviews')]
    public function test_reviews_match_the_python_scheduler(array $case): void
    {
        $scheduler = $this->scheduler($case['scheduler'], $case['sample']);
        $card = Card::fromArray($case['card']);
        $original = $card->toArray();

        [$updated, $log] = $scheduler->reviewCard($card, Rating::from($case['rating']), new DateTimeImmutable($case['at']), 1234);

        $this->assertCardMatches($case['expected_card'], $updated);
        $this->assertSame($case['expected_log'], $log->toArray());
        $this->assertSame($original, $card->toArray());
        $this->assertNotSame($card, $updated);
        $this->assertEqualsWithDelta($case['retrievability'], $scheduler->getCardRetrievability($updated, $updated->lastReview->modify('+3 days 23 hours')), 1e-12);
    }

    /** @param array<string, mixed> $trace */
    #[DataProvider('pythonTraces')]
    public function test_review_histories_match_python_at_every_review(array $trace): void
    {
        $scheduler = new Scheduler(enableFuzzing: false);
        $card = Card::fromArray($trace['initial_card']);

        foreach ($trace['records'] as $record) {
            [$card] = $scheduler->reviewCard($card, Rating::from($record['rating']), new DateTimeImmutable($record['at']));

            $this->assertCardMatches($record['expected_card'], $card);
        }
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('pythonReschedules')]
    public function test_replaying_unsorted_history_matches_python(array $case): void
    {
        $scheduler = Scheduler::fromArray($case['scheduler']);
        $card = Card::fromArray($case['card']);
        $original = $card->toArray();
        $logs = array_map(ReviewLog::fromArray(...), $case['logs']);
        $originalLogs = array_map(fn (ReviewLog $log): array => $log->toArray(), $logs);

        $updated = $scheduler->rescheduleCard($card, $logs);

        $this->assertCardMatches($case['expected_card'], $updated);
        $this->assertNotSame($card, $updated);
        $this->assertSame($original, $card->toArray());
        $this->assertSame($originalLogs, array_map(fn (ReviewLog $log): array => $log->toArray(), $logs));
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('pythonRetrievabilities')]
    public function test_retrievability_matches_python_at_day_boundaries(array $case): void
    {
        $scheduler = new Scheduler;

        $actual = $scheduler->getCardRetrievability(Card::fromArray($case['card']), new DateTimeImmutable($case['at']));

        $this->assertEqualsWithDelta($case['expected'], $actual, 1e-12);
    }

    public function test_default_settings_and_serialization_match_python(): void
    {
        $scheduler = new Scheduler;
        $expected = self::fixtures()['scheduler'];

        $this->assertSame($expected, $scheduler->toArray());
        $this->assertSame($expected, Scheduler::fromArray($expected)->toArray());
        $this->assertSame($expected, Scheduler::fromJson($scheduler->toJson())->toArray());
    }

    public function test_custom_settings_survive_array_and_json_round_trips(): void
    {
        $parameters = Scheduler::DEFAULT_PARAMETERS;
        $parameters[0] = 2.0;
        $scheduler = new Scheduler($parameters, 0.85, [30, 90, 900], [], 123, false);
        $card = new Card(cardId: 1, due: new DateTimeImmutable('2026-01-01T00:00:00Z'));

        $fromArray = Scheduler::fromArray($scheduler->toArray());
        $fromJson = Scheduler::fromJson($scheduler->toJson());

        $this->assertSame($scheduler->toArray(), $fromArray->toArray());
        $this->assertSame($scheduler->toArray(), $fromJson->toArray());
        $this->assertSame($scheduler->reviewCard($card, Rating::Good, $card->due)[0]->toArray(), $fromJson->reviewCard($card, Rating::Good, $card->due)[0]->toArray());
    }

    public function test_default_review_time_is_utc_and_duration_is_optional(): void
    {
        $scheduler = new Scheduler;
        $card = new Card(cardId: 1);

        [$updated, $log] = $scheduler->reviewCard($card, Rating::Good);

        $this->assertSame(0, $updated->lastReview->getOffset());
        $this->assertSame($updated->lastReview, $log->reviewDateTime);
        $this->assertSame(600, $updated->due->getTimestamp() - $updated->lastReview->getTimestamp());
        $this->assertNull($log->reviewDuration);
        $this->assertSame(0.0, $scheduler->getCardRetrievability($card));
        $this->assertSame(1.0, $scheduler->getCardRetrievability(new Card(cardId: 2, stability: 2, lastReview: new DateTimeImmutable('2100-01-01T00:00:00Z'))));
    }

    #[DataProvider('nonUtcDates')]
    public function test_non_utc_reviews_are_rejected_without_changing_the_card(string $date): void
    {
        $card = new Card(cardId: 1);
        $original = $card->toArray();

        try {
            (new Scheduler)->reviewCard($card, Rating::Good, new DateTimeImmutable($date));
            $this->fail('Expected a UTC validation error.');
        } catch (InvalidArgumentException $exception) {
            $this->assertSame('datetime must be timezone-aware and set to UTC', $exception->getMessage());
        }

        $this->assertSame($original, $card->toArray());
    }

    /** @return iterable<string, array{0: string}> */
    public static function nonUtcDates(): iterable
    {
        yield 'negative offset' => ['2026-01-01T00:00:00-06:00'];
        yield 'positive offset' => ['2026-01-01T00:00:00+05:30'];
        yield 'region currently at zero offset' => ['2026-01-01 00:00:00 Europe/London'];
    }

    public function test_invalid_scheduler_json_is_rejected(): void
    {
        $this->expectException(JsonException::class);

        Scheduler::fromJson('{');
    }

    public function test_replay_rejects_another_cards_history(): void
    {
        $card = new Card(cardId: 1);
        $log = new ReviewLog(2, Rating::Good, new DateTimeImmutable('2026-01-01T00:00:00Z'));
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('ReviewLog card_id 2 does not match Card card_id 1');

        (new Scheduler)->rescheduleCard($card, [$log]);
    }

    /** @param list<float> $parameters */
    #[DataProvider('invalidParameters')]
    public function test_invalid_weights_are_rejected(array $parameters): void
    {
        $this->expectException(InvalidArgumentException::class);

        new Scheduler(parameters: $parameters);
    }

    /** @return iterable<string, array{0: array}> */
    public static function invalidParameters(): iterable
    {
        yield 'empty' => [[]];
        yield 'too few' => [array_slice(Scheduler::DEFAULT_PARAMETERS, 0, -1)];
        yield 'too many' => [[...Scheduler::DEFAULT_PARAMETERS, 1.0]];
        yield 'non-list' => [array_combine(range(1, 21), Scheduler::DEFAULT_PARAMETERS)];

        $lower = [0.001, 0.001, 0.001, 0.001, 1, 0.001, 0.001, 0.001, 0, 0, 0.001, 0.001, 0.001, 0.001, 0, 0, 1, 0, 0, 0, 0.1];
        $upper = [100, 100, 100, 100, 10, 4, 4, 0.75, 4.5, 0.8, 3.5, 5, 0.25, 0.9, 4, 1, 6, 2, 2, 0.8, 0.8];

        foreach ($lower as $index => $minimum) {
            $parameters = Scheduler::DEFAULT_PARAMETERS;
            $parameters[$index] = $minimum - 0.0001;
            yield "weight {$index} below minimum" => [$parameters];
            $parameters[$index] = $upper[$index] + 0.0001;
            yield "weight {$index} above maximum" => [$parameters];
        }

        foreach ([NAN, INF, -INF, 'invalid'] as $index => $value) {
            $parameters = Scheduler::DEFAULT_PARAMETERS;
            $parameters[0] = $value;
            yield "non-finite or non-numeric {$index}" => [$parameters];
        }
    }

    public function test_validation_reports_all_invalid_weights(): void
    {
        $parameters = Scheduler::DEFAULT_PARAMETERS;
        $parameters[0] = 0;
        $parameters[3] = 101;

        try {
            new Scheduler(parameters: $parameters);
            $this->fail('Expected invalid weights to be rejected.');
        } catch (InvalidArgumentException $exception) {
            $this->assertStringContainsString('parameters[0]', $exception->getMessage());
            $this->assertStringContainsString('parameters[3]', $exception->getMessage());
        }
    }

    public function test_repeated_lapses_never_go_below_minimum_stability(): void
    {
        $scheduler = new Scheduler(enableFuzzing: false);
        $card = new Card(cardId: 1, due: new DateTimeImmutable('2026-01-01T00:00:00Z'));

        for ($i = 0; $i < 1000; $i++) {
            [$card] = $scheduler->reviewCard($card, Rating::Again, $card->due->modify('+1 day'));

            $this->assertGreaterThanOrEqual(Scheduler::STABILITY_MIN, $card->stability);
        }
    }

    public function test_same_day_hard_reviews_preserve_stability(): void
    {
        $scheduler = new Scheduler(learningSteps: [], enableFuzzing: false);
        $at = new DateTimeImmutable('2026-01-01T00:00:00Z');
        [$card] = $scheduler->reviewCard(new Card(cardId: 1), Rating::Good, $at);

        [$updated] = $scheduler->reviewCard($card, Rating::Hard, $at->modify('+1 minute'));

        $this->assertSame($card->stability, $updated->stability);
    }

    public function test_fuzzing_uses_a_seedable_php_random_source(): void
    {
        $scheduler = new Scheduler(learningSteps: []);
        $card = new Card(cardId: 1, due: new DateTimeImmutable('2026-01-01T00:00:00Z'));

        try {
            mt_srand(42);
            [$first] = $scheduler->reviewCard($card, Rating::Easy, $card->due);
            mt_srand(42);
            [$second] = $scheduler->reviewCard($card, Rating::Easy, $card->due);

            $this->assertSame($first->toArray(), $second->toArray());
            $this->assertGreaterThanOrEqual(6, $first->due->diff($card->due)->days);
            $this->assertLessThanOrEqual(11, $first->due->diff($card->due)->days);
        } finally {
            mt_srand();
        }
    }

    #[DataProvider('incompleteCards')]
    public function test_incomplete_scheduling_state_is_rejected(Card $card): void
    {
        $this->expectException(InvalidArgumentException::class);

        (new Scheduler)->reviewCard($card, Rating::Good);
    }

    /** @return iterable<string, array{0: Card}> */
    public static function incompleteCards(): iterable
    {
        yield 'review without memory' => [new Card(cardId: 1, state: State::Review)];
        yield 'relearning without step' => [new Card(cardId: 1, state: State::Relearning, stability: 1, difficulty: 2)];
        yield 'relearning without memory' => [new Card(cardId: 1, state: State::Relearning, step: 0)];
        $card = new Card(cardId: 1);
        $card->step = null;
        yield 'learning without step' => [$card];
    }

    /** @return iterable<string, array{0: array}> */
    public static function pythonReviews(): iterable
    {
        foreach (self::fixtures()['reviews'] as $name => $case) {
            yield $name => [$case];
        }
    }

    /** @return iterable<string, array{0: array}> */
    public static function pythonTraces(): iterable
    {
        foreach (self::fixtures()['traces'] as $name => $case) {
            yield $name => [$case];
        }
    }

    /** @return iterable<string, array{0: array}> */
    public static function pythonReschedules(): iterable
    {
        foreach (self::fixtures()['reschedules'] as $name => $case) {
            yield $name => [$case];
        }
    }

    /** @return iterable<string, array{0: array}> */
    public static function pythonRetrievabilities(): iterable
    {
        foreach (self::fixtures()['retrievabilities'] as $name => $case) {
            yield $name => [$case];
        }
    }

    /** @return array<string, mixed> */
    private static function fixtures(): array
    {
        return json_decode(file_get_contents(__DIR__.'/../../../Fixtures/Fsrs/parity.json'), true, 512, JSON_THROW_ON_ERROR);
    }

    /** @param array<string, mixed> $config */
    private function scheduler(array $config, ?float $sample): Scheduler
    {
        return new class($config, $sample) extends Scheduler
        {
            /** @param array<string, mixed> $config */
            public function __construct(array $config, private ?float $sample)
            {
                parent::__construct($config['parameters'], $config['desired_retention'], $config['learning_steps'], $config['relearning_steps'], $config['maximum_interval'], $config['enable_fuzzing']);
            }

            protected function randomFloat(): float
            {
                return $this->sample;
            }
        };
    }

    /** @param array<string, mixed> $expected */
    private function assertCardMatches(array $expected, Card $actual): void
    {
        $values = $actual->toArray();

        foreach (['stability', 'difficulty'] as $field) {
            if ($expected[$field] === null) {
                $this->assertNull($values[$field]);
            } else {
                $this->assertEqualsWithDelta($expected[$field], $values[$field], 1e-11 * max(1, abs($expected[$field])), $field);
            }

            unset($expected[$field], $values[$field]);
        }

        $this->assertSame($expected, $values);
    }
}
