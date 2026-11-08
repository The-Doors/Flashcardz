<?php

namespace Database\Factories;

use App\Models\JobStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<JobStatus> */
class JobStatusFactory extends Factory
{
    public function definition(): array
    {
        return ['user_id' => User::factory(), 'type' => 'quizlet_import', 'status' => 'queued'];
    }
}
