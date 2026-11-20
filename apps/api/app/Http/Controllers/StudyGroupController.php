<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStudyGroupRequest;
use App\Http\Requests\UpdateStudyGroupRequest;
use App\Models\StudyGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class StudyGroupController extends Controller
{
    /**
     * List the study groups the user belongs to.
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', StudyGroup::class);

        return response()->json($request->user()->studyGroups()
            ->with('owner:id,username')
            ->withCount(['members', 'decks'])
            ->orderByDesc('app.study_groups.id')
            ->paginate(25));
    }

    public function store(StoreStudyGroupRequest $request): JsonResponse
    {
        $group = DB::transaction(function () use ($request): StudyGroup {
            $group = new StudyGroup($request->validated());
            $group->owner()->associate($request->user());
            $group->save();
            $group->members()->attach($request->user());

            return $group;
        });

        return response()->json($this->details($group->refresh()), 201);
    }

    /**
     * Show a group with its members, shared sets, and pending invitations.
     */
    public function show(StudyGroup $studyGroup): JsonResponse
    {
        Gate::authorize('view', $studyGroup);

        return response()->json($this->details($studyGroup));
    }

    public function update(UpdateStudyGroupRequest $request, StudyGroup $studyGroup): JsonResponse
    {
        $studyGroup->update($request->validated());

        return response()->json($this->details($studyGroup));
    }

    public function destroy(StudyGroup $studyGroup): Response
    {
        Gate::authorize('delete', $studyGroup);
        $studyGroup->delete();

        return response()->noContent();
    }

    private function details(StudyGroup $studyGroup): StudyGroup
    {
        return $studyGroup->load([
            'owner:id,username',
            'members' => fn ($query) => $query->select('app.users.id', 'app.users.username')->orderBy('app.study_group_members.id'),
            'decks' => fn ($query) => $query->with('user:id,username')->withCount('cards')->orderBy('app.study_group_decks.id'),
            'invitations' => fn ($query) => $query->with('invitee:id,username')->orderBy('id'),
        ]);
    }
}
