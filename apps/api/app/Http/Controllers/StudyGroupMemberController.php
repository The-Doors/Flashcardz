<?php

namespace App\Http\Controllers;

use App\Models\StudyGroup;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class StudyGroupMemberController extends Controller
{
    /**
     * Remove a member from the group, or leave the group when the member is the current user.
     */
    public function destroy(StudyGroup $studyGroup, User $member): Response
    {
        Gate::authorize('removeMember', [$studyGroup, $member]);
        abort_unless($studyGroup->members()->detach($member) > 0, 404);

        return response()->noContent();
    }
}
