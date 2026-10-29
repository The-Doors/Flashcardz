<?php

namespace App\Services\Fsrs;

use DateTimeImmutable;

class ReviewLog
{
    /** @param ?int $reviewDuration Review duration in milliseconds. */
    public function __construct(
        public int $cardId,
        public Rating $rating,
        public DateTimeImmutable $reviewDateTime,
        public ?int $reviewDuration = null,
    ) {}

    /** @return array{card_id: int, rating: int, review_datetime: string, review_duration: ?int} */
    public function toArray(): array
    {
        return [
            'card_id' => $this->cardId,
            'rating' => $this->rating->value,
            'review_datetime' => $this->reviewDateTime->format($this->reviewDateTime->format('u') === '000000' ? 'Y-m-d\TH:i:sP' : 'Y-m-d\TH:i:s.uP'),
            'review_duration' => $this->reviewDuration,
        ];
    }

    /** @param array{card_id: int, rating: int, review_datetime: string, review_duration: ?int} $data */
    public static function fromArray(array $data): self
    {
        return new self($data['card_id'], Rating::from((int) $data['rating']), new DateTimeImmutable($data['review_datetime']), $data['review_duration']);
    }

    public function toJson(): string
    {
        return json_encode($this->toArray(), JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);
    }

    public static function fromJson(string $json): self
    {
        return self::fromArray(json_decode($json, true, 512, JSON_THROW_ON_ERROR));
    }
}
