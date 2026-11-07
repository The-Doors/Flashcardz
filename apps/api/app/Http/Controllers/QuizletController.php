<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportQuizletRequest;
use App\Jobs\ImportQuizlet;
use App\Models\JobStatus;
use App\Services\Quizlet\ImportFromQuizlet;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;

class QuizletController extends Controller
{
    public function store(ImportQuizletRequest $request, ImportFromQuizlet $quizlet): JsonResponse
    {
        $job = DB::transaction(function () use ($request, $quizlet): JobStatus {
            $job = new JobStatus(['type' => 'quizlet_import', 'status' => 'queued']);
            $job->user()->associate($request->user());
            $job->save();
            Bus::dispatch(new ImportQuizlet($job->id, $quizlet->getDeckId($request->validated('source'))));

            return $job;
        });

        return response()->json($job->refresh(), 202)->header('Location', route('jobs.show', $job));
    }
}
