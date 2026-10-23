<?php

namespace App\Policies;

use App\Models\Deck;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class DeckPolicy
{
    public function viewAny(?User $user): bool
    {
        return true;
    }

    public function view(?User $user, Deck $deck): Response
    {
        return ! $deck->trashed() && ($deck->is_public || $deck->user_id === $user?->id)
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Deck $deck): bool
    {
        return ! $deck->trashed() && $deck->user_id === $user->id;
    }

    public function delete(User $user, Deck $deck): bool
    {
        return $this->update($user, $deck);
    }

    public function copy(User $user, Deck $deck): Response
    {
        return $this->view($user, $deck);
    }
}
