<?php

namespace Database\Factories;

use App\Models\Card;
use App\Models\Deck;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Card>
 */
class CardFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'deck_id' => Deck::factory(),
            'creator_id' => fn (array $attributes): string => Deck::withTrashed()->findOrFail($attributes['deck_id'])->user_id,
            'content' => fake()->sentence()."\n\n<!-- card:back -->\n\n".fake()->paragraph(),
        ];
    }
}
