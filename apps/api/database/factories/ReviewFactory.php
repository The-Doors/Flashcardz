<?php

namespace Database\Factories;

use App\Models\Card;
use App\Models\Review;
use App\Services\Fsrs\Rating;
use App\Services\Fsrs\State;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Review>
 */
class ReviewFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'card_id' => Card::factory(),
            'user_id' => fn (array $attributes): string => Card::findOrFail($attributes['card_id'])->deck->user_id,
            'rating' => Rating::Good,
            'review_datetime' => now()->subDays(3),
            'review_duration' => null,
            'state' => State::Review,
            'step' => null,
            'stability' => 2.3065,
            'difficulty' => 5.2824,
            'due' => now(),
        ];
    }

    public function learning(): static
    {
        return $this->state(fn (): array => ['state' => State::Learning, 'step' => 1, 'review_datetime' => now(), 'due' => now()->addMinutes(10)]);
    }

    public function relearning(): static
    {
        return $this->state(fn (): array => ['state' => State::Relearning, 'step' => 0, 'rating' => Rating::Again, 'review_datetime' => now(), 'due' => now()->addMinutes(10)]);
    }
}
