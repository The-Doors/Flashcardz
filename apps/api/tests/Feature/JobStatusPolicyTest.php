<?php

namespace Tests\Feature;

use App\Models\JobStatus;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

class JobStatusPolicyTest extends TestCase
{
    public function test_only_the_owner_can_view_a_job(): void
    {
        $owner = User::factory()->make();
        $job = JobStatus::factory()->for($owner)->make();

        $this->assertTrue(Gate::forUser($owner)->allows('view', $job));
        $this->assertSame(404, Gate::forUser(User::factory()->make())->inspect('view', $job)->status());
        $this->assertFalse(Gate::forUser(null)->allows('view', $job));
    }
}
