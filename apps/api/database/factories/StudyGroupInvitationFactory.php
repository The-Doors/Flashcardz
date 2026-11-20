<?php

namespace Database\Factories;

use App\Models\StudyGroup;
use App\Models\StudyGroupInvitation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StudyGroupInvitation>
 */
class StudyGroupInvitationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'study_group_id' => StudyGroup::factory(),
            'inviter_id' => fn (array $attributes): string => StudyGroup::findOrFail($attributes['study_group_id'])->owner_id,
            'invitee_id' => User::factory(),
        ];
    }
}
