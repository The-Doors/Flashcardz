<?php

namespace App\Policies;

use App\Models\JobStatus;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class JobStatusPolicy
{
    public function view(User $user, JobStatus $job): Response
    {
        return $job->user_id === $user->id ? Response::allow() : Response::denyAsNotFound();
    }
}
