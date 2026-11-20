<?php

namespace App\Policies;

use App\Models\StudyGroupInvitation;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class StudyGroupInvitationPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Only the invited user can accept or decline an invitation.
     */
    public function respond(User $user, StudyGroupInvitation $invitation): Response
    {
        return $invitation->invitee_id === $user->id ? Response::allow() : Response::denyAsNotFound();
    }

    /**
     * Only the group owner can cancel an invitation.
     */
    public function delete(User $user, StudyGroupInvitation $invitation): Response
    {
        return $invitation->studyGroup->isOwnedBy($user) ? Response::allow() : Response::denyAsNotFound();
    }
}
