<?php

namespace App\Services\Fsrs;

use DateTimeImmutable;
use DateTimeZone;

/** Scheduling data only; independent of the application's Eloquent Card model. */
class Card
{
    public function __construct(
        public ?int $cardId = null,
        public State $state = State::Learning,
        public ?int $step = null,
        public ?float $stability = null,
        public ?float $difficulty = null,
        public ?DateTimeImmutable $due = null,
        public ?DateTimeImmutable $lastReview = null,
    ) {
        if ($this->cardId === null) {
            $this->cardId = (int) floor(microtime(true) * 1000);
            usleep(1000);
        }

        $this->step ??= $state === State::Learning ? 0 : null;
        $this->due ??= new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }

    /** @return array{card_id: int, state: int, step: ?int, stability: ?float, difficulty: ?float, due: string, last_review: ?string} */
    public function toArray(): array
    {
        return [
            'card_id' => $this->cardId,
            'state' => $this->state->value,
            'step' => $this->step,
            'stability' => $this->stability,
            'difficulty' => $this->difficulty,
            'due' => $this->due->format($this->due->format('u') === '000000' ? 'Y-m-d\TH:i:sP' : 'Y-m-d\TH:i:s.uP'),
            'last_review' => $this->lastReview?->format($this->lastReview->format('u') === '000000' ? 'Y-m-d\TH:i:sP' : 'Y-m-d\TH:i:s.uP'),
        ];
    }

    /** @param array{card_id: int, state: int, step: ?int, stability: ?float, difficulty: ?float, due: string, last_review: ?string} $data */
    public static function fromArray(array $data): self
    {
        return new self(
            cardId: (int) $data['card_id'],
            state: State::from((int) $data['state']),
            step: $data['step'],
            stability: $data['stability'] ? (float) $data['stability'] : null,
            difficulty: $data['difficulty'] ? (float) $data['difficulty'] : null,
            due: new DateTimeImmutable($data['due']),
            lastReview: $data['last_review'] ? new DateTimeImmutable($data['last_review']) : null,
        );
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
