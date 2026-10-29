<?php

namespace App\Policies;

use App\Models\Card;
use App\Models\Review;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ReviewPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user, Card $card): Response
    {
        return ! $card->trashed() && $card->deck && ! $card->deck->trashed() && $card->deck->user_id === $user->id
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function undo(User $user, Review $review): Response
    {
        return ! $review->trashed() && $review->user_id === $user->id && $review->card && $this->create($user, $review->card)->allowed()
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
