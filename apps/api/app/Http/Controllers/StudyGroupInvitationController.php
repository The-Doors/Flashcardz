<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStudyGroupInvitationRequest;
use App\Models\StudyGroup;
use App\Models\StudyGroupInvitation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class StudyGroupInvitationController extends Controller
{
    /**
     * List the invitations waiting for the user to accept or decline.
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', StudyGroupInvitation::class);

        return response()->json($request->user()->studyGroupInvitations()
            ->with(['studyGroup' => fn ($query) => $query->withCount('members'), 'inviter:id,username'])
            ->orderByDesc('id')
            ->paginate(25));
    }

    /**
     * Invite a user to the group by their username.
     */
    public function store(StoreStudyGroupInvitationRequest $request, StudyGroup $studyGroup): JsonResponse
    {
        $invitee = User::where('username_lowercase', mb_strtolower($request->string('username')))->first();

        if (! $invitee) {
            throw ValidationException::withMessages(['username' => 'No user has that username.']);
        }

        $invitation = DB::transaction(function () use ($request, $studyGroup, $invitee): StudyGroupInvitation {
            StudyGroup::whereKey($studyGroup->id)->lockForUpdate()->firstOrFail();

            if ($studyGroup->hasMember($invitee)) {
                throw ValidationException::withMessages(['username' => 'That user is already in this group.']);
            }

            if ($studyGroup->invitations()->where('invitee_id', $invitee->id)->exists()) {
                throw ValidationException::withMessages(['username' => 'That user has already been invited.']);
            }

            $invitation = $studyGroup->invitations()->make();
            $invitation->inviter()->associate($request->user());
            $invitation->invitee()->associate($invitee);
            $invitation->save();

            return $invitation;
        });

        return response()->json($invitation->load('invitee:id,username'), 201);
    }

    public function accept(StudyGroupInvitation $invitation): JsonResponse
    {
        Gate::authorize('respond', $invitation);

        DB::transaction(function () use ($invitation): void {
            $invitation->studyGroup->members()->syncWithoutDetaching([$invitation->invitee_id]);
            $invitation->delete();
        });

        return response()->json($invitation->studyGroup->load('owner:id,username')->loadCount(['members', 'decks']));
    }

    public function decline(StudyGroupInvitation $invitation): Response
    {
        Gate::authorize('respond', $invitation);
        $invitation->delete();

        return response()->noContent();
    }

    /**
     * Cancel an invitation that has not been answered yet.
     */
    public function destroy(StudyGroupInvitation $invitation): Response
    {
        Gate::authorize('delete', $invitation);
        $invitation->delete();

        return response()->noContent();
    }
}
