<?php

namespace App\Services\Fsrs;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

/**
 * Pure PHP port of py-fsrs (FSRS-6), excluding the optimizer.
 *
 * @see https://github.com/open-spaced-repetition/py-fsrs/tree/9446cb06605c597a063aeee49f7d188d42e34dc2
 *
 * @license MIT See LICENSE in this directory.
 */
class Scheduler
{
    public const array DEFAULT_PARAMETERS = [
        0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194,
        0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
        1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
    ];

    public const float STABILITY_MIN = 0.001;

    private const array LOWER_BOUNDS = [
        0.001, 0.001, 0.001, 0.001, 1.0, 0.001, 0.001, 0.001,
        0.0, 0.0, 0.001, 0.001, 0.001, 0.001, 0.0, 0.0, 1.0,
        0.0, 0.0, 0.0, 0.1,
    ];

    private const array UPPER_BOUNDS = [
        100.0, 100.0, 100.0, 100.0, 10.0, 4.0, 4.0, 0.75,
        4.5, 0.8, 3.5, 5.0, 0.25, 0.9, 4.0, 1.0, 6.0,
        2.0, 2.0, 0.8, 0.8,
    ];

    private readonly float $decay;

    private readonly float $factor;

    /**
     * @param  list<float>  $parameters  FSRS model weights, using the upstream defaults unless supplied.
     * @param  list<int|float>  $learningSteps  Learning intervals in seconds.
     * @param  list<int|float>  $relearningSteps  Relearning intervals in seconds.
     */
    public function __construct(
        public readonly array $parameters = self::DEFAULT_PARAMETERS,
        public readonly float $desiredRetention = 0.9,
        public readonly array $learningSteps = [60, 600],
        public readonly array $relearningSteps = [600],
        public readonly int $maximumInterval = 36500,
        public readonly bool $enableFuzzing = true,
    ) {
        $this->validateParameters($parameters);
        $this->decay = -$parameters[20];
        $this->factor = 0.9 ** (1 / $this->decay) - 1;
    }

    public function getCardRetrievability(Card $card, ?DateTimeImmutable $currentDateTime = null): float
    {
        if ($card->lastReview === null || $card->stability === null) {
            return 0.0;
        }

        $elapsedDays = max(0, $this->elapsedDays($card->lastReview, $currentDateTime ?? new DateTimeImmutable('now', new DateTimeZone('UTC'))));

        return (1 + $this->factor * $elapsedDays / $card->stability) ** $this->decay;
    }

    /**
     * Returns a new card and log without changing the supplied card. Review times must be UTC.
     *
     * @param  ?int  $reviewDuration  Review duration in milliseconds.
     * @return array{0: Card, 1: ReviewLog}
     */
    public function reviewCard(Card $card, Rating $rating, ?DateTimeImmutable $reviewDateTime = null, ?int $reviewDuration = null): array
    {
        $reviewDateTime ??= new DateTimeImmutable('now', new DateTimeZone('UTC'));

        if ($reviewDateTime->getOffset() !== 0 || ! in_array($reviewDateTime->getTimezone()->getName(), ['UTC', 'GMT', 'Z', '+00:00'], true)) {
            throw new InvalidArgumentException('datetime must be timezone-aware and set to UTC');
        }

        if (($card->state !== State::Review && $card->step === null)
            || ($card->state !== State::Learning && ($card->stability === null || $card->difficulty === null))) {
            throw new InvalidArgumentException('Card is missing the step, stability, or difficulty required by its state.');
        }

        $card = clone $card;
        $elapsedDays = $card->lastReview === null ? null : $this->elapsedDays($card->lastReview, $reviewDateTime);

        if ($card->state === State::Learning && ($card->stability === null || $card->difficulty === null)) {
            $card->stability = max($this->parameters[$rating->value - 1], self::STABILITY_MIN);
            $card->difficulty = $this->clampDifficulty($this->initialDifficulty($rating));
        } else {
            $card->stability = $elapsedDays !== null && $elapsedDays < 1
                ? $this->shortTermStability($card->stability, $rating)
                : $this->nextStability($card->difficulty, $card->stability, $this->getCardRetrievability($card, $reviewDateTime), $rating);
            $card->difficulty = $this->nextDifficulty($card->difficulty, $rating);
        }

        if ($card->state === State::Review) {
            if ($rating === Rating::Again && $this->relearningSteps !== []) {
                $card->state = State::Relearning;
                $card->step = 0;
                $interval = $this->relearningSteps[0];
            } else {
                $interval = $this->nextInterval($card->stability) * 86400;
            }
        } else {
            $steps = $card->state === State::Learning ? $this->learningSteps : $this->relearningSteps;
            $interval = $this->stepInterval($card, $rating, $steps);
        }

        if ($this->enableFuzzing && $card->state === State::Review) {
            $interval = $this->fuzzInterval((int) ($interval / 86400)) * 86400;
        }

        $microseconds = (int) round($interval * 1000000, 0, PHP_ROUND_HALF_EVEN);
        $card->due = $reviewDateTime->modify(sprintf('%+d seconds %+d microseconds', intdiv($microseconds, 1000000), $microseconds % 1000000));
        $card->lastReview = $reviewDateTime;

        return [$card, new ReviewLog($card->cardId, $rating, $reviewDateTime, $reviewDuration)];
    }

    /** @param list<ReviewLog> $reviewLogs */
    public function rescheduleCard(Card $card, array $reviewLogs): Card
    {
        foreach ($reviewLogs as $log) {
            if ($log->cardId !== $card->cardId) {
                throw new InvalidArgumentException("ReviewLog card_id {$log->cardId} does not match Card card_id {$card->cardId}");
            }
        }

        usort($reviewLogs, fn (ReviewLog $a, ReviewLog $b): int => $a->reviewDateTime <=> $b->reviewDateTime);
        $rescheduled = new Card(cardId: $card->cardId, due: $card->due);

        foreach ($reviewLogs as $log) {
            [$rescheduled] = $this->reviewCard($rescheduled, $log->rating, $log->reviewDateTime);
        }

        return $rescheduled;
    }

    /** @return array{parameters: list<float>, desired_retention: float, learning_steps: list<int>, relearning_steps: list<int>, maximum_interval: int, enable_fuzzing: bool} */
    public function toArray(): array
    {
        return [
            'parameters' => $this->parameters,
            'desired_retention' => $this->desiredRetention,
            'learning_steps' => array_map(intval(...), $this->learningSteps),
            'relearning_steps' => array_map(intval(...), $this->relearningSteps),
            'maximum_interval' => $this->maximumInterval,
            'enable_fuzzing' => $this->enableFuzzing,
        ];
    }

    /** @param array{parameters: list<float>, desired_retention: float, learning_steps: list<int>, relearning_steps: list<int>, maximum_interval: int, enable_fuzzing: bool} $data */
    public static function fromArray(array $data): self
    {
        return new self($data['parameters'], $data['desired_retention'], $data['learning_steps'], $data['relearning_steps'], $data['maximum_interval'], $data['enable_fuzzing']);
    }

    public function toJson(): string
    {
        return json_encode($this->toArray(), JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);
    }

    public static function fromJson(string $json): self
    {
        return self::fromArray(json_decode($json, true, 512, JSON_THROW_ON_ERROR));
    }

    /** @param list<float> $parameters */
    private function validateParameters(array $parameters): void
    {
        if (count($parameters) !== count(self::LOWER_BOUNDS) || ! array_is_list($parameters)) {
            throw new InvalidArgumentException('Expected 21 parameters, got '.count($parameters).'.');
        }

        $errors = [];

        foreach ($parameters as $index => $parameter) {
            $lower = self::LOWER_BOUNDS[$index];
            $upper = self::UPPER_BOUNDS[$index];

            if (! (is_int($parameter) || is_float($parameter)) || ! ($lower <= $parameter && $parameter <= $upper)) {
                $errors[] = "parameters[{$index}] is out of bounds: ({$lower}, {$upper})";
            }
        }

        if ($errors !== []) {
            throw new InvalidArgumentException("One or more parameters are out of bounds:\n".implode("\n", $errors));
        }
    }

    /** Python timedelta.days floors negative differences as well as positive ones. */
    private function elapsedDays(DateTimeImmutable $from, DateTimeImmutable $to): int
    {
        $microseconds = ($to->getTimestamp() - $from->getTimestamp()) * 1000000 + (int) $to->format('u') - (int) $from->format('u');

        return (int) floor($microseconds / 86400000000);
    }

    /** @param list<int|float> $steps */
    private function stepInterval(Card $card, Rating $rating, array $steps): float
    {
        if ($steps === []
            || ($card->step >= count($steps) && $rating !== Rating::Again)
            || $rating === Rating::Easy
            || ($rating === Rating::Good && $card->step + 1 === count($steps))) {
            $card->state = State::Review;
            $card->step = null;

            return $this->nextInterval($card->stability) * 86400;
        }

        if ($rating === Rating::Again) {
            $card->step = 0;
        } elseif ($rating === Rating::Good) {
            $card->step++;
        } elseif ($card->step === 0) {
            return count($steps) === 1 ? $steps[0] * 1.5 : ($steps[0] + $steps[1]) / 2;
        }

        return $steps[$card->step];
    }

    private function clampDifficulty(float $difficulty): float
    {
        return min(max($difficulty, 1.0), 10.0);
    }

    private function initialDifficulty(Rating $rating): float
    {
        return $this->parameters[4] - M_E ** ($this->parameters[5] * ($rating->value - 1)) + 1;
    }

    private function nextInterval(float $stability): int
    {
        $interval = ($stability / $this->factor) * ($this->desiredRetention ** (1 / $this->decay) - 1);

        return min(max((int) round($interval, 0, PHP_ROUND_HALF_EVEN), 1), $this->maximumInterval);
    }

    private function shortTermStability(float $stability, Rating $rating): float
    {
        $increase = M_E ** ($this->parameters[17] * ($rating->value - 3 + $this->parameters[18])) * $stability ** -$this->parameters[19];

        return max($stability * ($rating === Rating::Again ? $increase : max($increase, 1.0)), self::STABILITY_MIN);
    }

    private function nextDifficulty(float $difficulty, Rating $rating): float
    {
        $delta = -$this->parameters[6] * ($rating->value - 3);
        $damped = $difficulty + (10.0 - $difficulty) * $delta / 9.0;

        return $this->clampDifficulty($this->parameters[7] * $this->initialDifficulty(Rating::Easy) + (1 - $this->parameters[7]) * $damped);
    }

    private function nextStability(float $difficulty, float $stability, float $retrievability, Rating $rating): float
    {
        $p = $this->parameters;

        if ($rating === Rating::Again) {
            $longTerm = $p[11] * $difficulty ** -$p[12] * (($stability + 1) ** $p[13] - 1) * M_E ** ((1 - $retrievability) * $p[14]);
            $shortTerm = $stability / M_E ** ($p[17] * $p[18]);

            return max(min($longTerm, $shortTerm), self::STABILITY_MIN);
        }

        $hardPenalty = $rating === Rating::Hard ? $p[15] : 1;
        $easyBonus = $rating === Rating::Easy ? $p[16] : 1;

        return max($stability * (1 + M_E ** $p[8] * (11 - $difficulty) * $stability ** -$p[9]
            * (M_E ** ((1 - $retrievability) * $p[10]) - 1) * $hardPenalty * $easyBonus), self::STABILITY_MIN);
    }

    private function fuzzInterval(int $days): int
    {
        if ($days < 2.5) {
            return $days;
        }

        $delta = 1.0;

        foreach ([[2.5, 7.0, 0.15], [7.0, 20.0, 0.1], [20.0, INF, 0.05]] as [$start, $end, $factor]) {
            $delta += $factor * max(min((float) $days, $end) - $start, 0.0);
        }

        $maximum = min((int) round($days + $delta, 0, PHP_ROUND_HALF_EVEN), $this->maximumInterval);
        $minimum = min(max(2, (int) round($days - $delta, 0, PHP_ROUND_HALF_EVEN)), $maximum);

        return min((int) round($this->randomFloat() * ($maximum - $minimum + 1) + $minimum, 0, PHP_ROUND_HALF_EVEN), $this->maximumInterval);
    }

    /** Uniform sample in [0, 1), kept separate so parity tests can use Python's exact samples. */
    protected function randomFloat(): float
    {
        return mt_rand() / (mt_getrandmax() + 1);
    }
}
