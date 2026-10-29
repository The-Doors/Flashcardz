<?php

namespace Tests\Unit\Services\Fsrs;

use App\Services\Fsrs\ReviewLog;
use JsonException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ReviewLogTest extends TestCase
{
    /** @param array<string, mixed> $data */
    #[DataProvider('serializedLogs')]
    public function test_review_metadata_survives_array_and_json_round_trips(array $data): void
    {
        $log = ReviewLog::fromArray($data);

        $this->assertSame($data, $log->toArray());
        $this->assertSame($data, ReviewLog::fromJson($log->toJson())->toArray());
    }

    public function test_invalid_json_is_rejected(): void
    {
        $this->expectException(JsonException::class);

        ReviewLog::fromJson('{');
    }

    /** @return iterable<string, array{0: array}> */
    public static function serializedLogs(): iterable
    {
        foreach ([1, 2, 3, 4] as $rating) {
            yield "rating {$rating}" => [['card_id' => 1, 'rating' => $rating,
                'review_datetime' => '2026-01-01T00:00:00+00:00', 'review_duration' => null]];
        }

        yield 'duration in milliseconds' => [['card_id' => 2, 'rating' => 3,
            'review_datetime' => '2026-01-01T00:00:00.123456+00:00', 'review_duration' => 1234]];
        yield 'zero duration' => [['card_id' => 3, 'rating' => 4,
            'review_datetime' => '2026-01-01T00:00:00-06:00', 'review_duration' => 0]];
    }
}
