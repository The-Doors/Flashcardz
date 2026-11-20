<?php

namespace Database\Factories;

use App\Models\StudyGroup;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StudyGroup>
 */
class StudyGroupFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'owner_id' => User::factory(),
            'name' => fake()->words(3, true),
            'description' => fake()->sentence(),
        ];
    }

    /**
     * Make the owner a member of the group, as the API does when a group is created.
     */
    public function configure(): static
    {
        return $this->afterCreating(fn (StudyGroup $group) => $group->members()->syncWithoutDetaching([$group->owner_id]));
    }
}
