<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<User> */
class UserFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'id' => fake()->uuid(),
            'username' => fake()->unique()->regexify('[A-Za-z][A-Za-z0-9_]{7}'),
        ];
    }
}
