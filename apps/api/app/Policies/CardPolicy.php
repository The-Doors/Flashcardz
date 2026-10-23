<?php

namespace App\Policies;

use App\Models\Card;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class CardPolicy
{
    public function viewAny(?User $user): bool
    {
        return true;
    }

    public function view(?User $user, Card $card): Response
    {
        return ! $card->trashed() && $card->deck && (new DeckPolicy)->view($user, $card->deck)->allowed()
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Card $card): bool
    {
        return ! $card->trashed() && $card->deck && (new DeckPolicy)->update($user, $card->deck);
    }

    public function delete(User $user, Card $card): bool
    {
        return $this->update($user, $card);
    }

    public function copy(User $user, Card $card): Response
    {
        return $this->view($user, $card);
    }
}
