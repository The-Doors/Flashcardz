<?php

namespace App\Policies;

use App\Models\Deck;
use App\Models\StudyGroup;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class StudyGroupPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, StudyGroup $studyGroup): Response
    {
        return $studyGroup->hasMember($user) ? Response::allow() : Response::denyAsNotFound();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, StudyGroup $studyGroup): Response
    {
        if (! $studyGroup->hasMember($user)) {
            return Response::denyAsNotFound();
        }

        return $studyGroup->isOwnedBy($user) ? Response::allow() : Response::deny('Only the group owner can do this.');
    }

    public function delete(User $user, StudyGroup $studyGroup): Response
    {
        return $this->update($user, $studyGroup);
    }

    public function invite(User $user, StudyGroup $studyGroup): Response
    {
        return $this->update($user, $studyGroup);
    }

    /**
     * Owners can remove anyone but themselves, and members can remove themselves to leave the group.
     */
    public function removeMember(User $user, StudyGroup $studyGroup, User $member): Response
    {
        if (! $studyGroup->hasMember($user)) {
            return Response::denyAsNotFound();
        }

        if ($studyGroup->isOwnedBy($member)) {
            return Response::deny('The owner cannot leave the group. Delete the group instead.');
        }

        return $studyGroup->isOwnedBy($user) || $user->is($member)
            ? Response::allow()
            : Response::deny('Only the group owner can remove other members.');
    }

    /**
     * Members can share their own sets, or any public set, with the group.
     */
    public function addDeck(User $user, StudyGroup $studyGroup, Deck $deck): Response
    {
        if (! $studyGroup->hasMember($user)) {
            return Response::denyAsNotFound();
        }

        return ! $deck->trashed() && ($deck->user_id === $user->id || $deck->is_public)
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    /**
     * The group owner, the set's owner, or whoever shared the set can remove it from the group.
     */
    public function removeDeck(User $user, StudyGroup $studyGroup, Deck $deck): Response
    {
        if (! $studyGroup->hasMember($user)) {
            return Response::denyAsNotFound();
        }

        return $studyGroup->isOwnedBy($user) || $deck->user_id === $user->id || $deck->pivot?->added_by_id === $user->id
            ? Response::allow()
            : Response::deny('Only the group owner or the member who shared this set can remove it.');
    }
}
