<?php

namespace App\Http\Controllers;

use App\Models\JobStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class JobController extends Controller
{
    public function show(JobStatus $job): JsonResponse
    {
        Gate::authorize('view', $job);

        return response()->json($job);
    }
}
