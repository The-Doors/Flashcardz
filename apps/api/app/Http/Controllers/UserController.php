<?php

namespace App\Http\Controllers;

use App\Models\StudyGroup;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class UserController extends Controller
{
    /**
     * Get info about the logged in user.
     */
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    /**
     * Find users whose username starts with the search text, so they can be invited to a study group.
     * Passing a study group the user belongs to also says whether each result is already a member or invited.
     */
    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:29'],
            'study_group_id' => ['sometimes', 'required', 'integer', 'min:1'],
        ]);
        $group = isset($validated['study_group_id']) ? StudyGroup::findOrFail($validated['study_group_id']) : null;

        if ($group) {
            Gate::authorize('view', $group);
        }

        $prefix = addcslashes(mb_strtolower($validated['username']), '\\%_');

        return response()->json(['data' => User::query()
            ->select('id', 'username')
            ->whereLike('username_lowercase', "{$prefix}%")
            ->whereKeyNot($request->user()->id)
            ->when($group, fn (Builder $query) => $query
                ->withExists(['studyGroups as is_member' => fn (Builder $query) => $query->whereKey($group->id)])
                ->withExists(['studyGroupInvitations as is_invited' => fn (Builder $query) => $query->where('study_group_id', $group->id)]))
            ->orderBy('username_lowercase')
            ->limit(10)
            ->get()]);
    }

    public function exampleOptionalAuth(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            return response()->json(['message' => 'User authenticated']);
        }

        return response()->json(['message' => 'User not authenticated, but still returning this. This is intentional to show off two different things.']);
    }
}
