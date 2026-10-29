<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\Deck;
use App\Models\Review;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ReviewPolicyTest extends TestCase
{
    #[DataProvider('permissions')]
    public function test_only_the_owner_can_review_cards_and_undo_their_own_answers(string $viewer, bool $public, bool $allowed): void
    {
        $owner = User::factory()->make();
        $other = User::factory()->make();
        $deck = Deck::factory()->make(['id' => 1, 'user_id' => $owner->id, 'is_public' => $public]);
        $card = Card::factory()->make(['id' => 1, 'deck_id' => 1, 'creator_id' => $other->id]);
        $card->setRelation('deck', $deck);
        $review = Review::factory()->make(['id' => 1, 'card_id' => 1, 'user_id' => $owner->id]);
        $review->setRelation('card', $card);
        $user = match ($viewer) {
            'owner' => $owner,
            'other' => $other,
            'guest' => null,
        };
        $gate = Gate::forUser($user);

        $this->assertSame($viewer !== 'guest', $gate->allows('viewAny', Review::class));
        $this->assertSame($allowed, $gate->allows('create', [Review::class, $card]));
        $this->assertSame($allowed, $gate->allows('undo', $review));
        foreach (['view', 'update', 'delete', 'restore', 'forceDelete'] as $ability) {
            $this->assertFalse($gate->allows($ability, $review));
        }
    }

    public static function permissions(): array
    {
        return [
            'owner public' => ['owner', true, true],
            'owner private' => ['owner', false, true],
            'other public' => ['other', true, false],
            'other private' => ['other', false, false],
            'guest public' => ['guest', true, false],
            'guest private' => ['guest', false, false],
        ];
    }

    #[DataProvider('inaccessibleRecords')]
    public function test_deleted_or_mismatched_records_cannot_be_reviewed_or_undone(string $record): void
    {
        $owner = User::factory()->make();
        $deck = Deck::factory()->make(['id' => 1, 'user_id' => $owner->id]);
        $card = Card::factory()->make(['id' => 1, 'deck_id' => 1, 'creator_id' => $owner->id]);
        $card->setRelation('deck', $deck);
        $review = Review::factory()->make(['id' => 1, 'card_id' => 1, 'user_id' => $owner->id]);
        $review->setRelation('card', $card);

        match ($record) {
            'card' => $card->deleted_at = now(),
            'deck' => $deck->deleted_at = now(),
            'missing deck' => $card->setRelation('deck', null),
            'review' => $review->deleted_at = now(),
            'missing card' => $review->setRelation('card', null),
            'different reviewer' => $review->user_id = User::factory()->make()->id,
        };

        $this->assertFalse(Gate::forUser($owner)->allows('undo', $review));
        if (in_array($record, ['card', 'deck', 'missing deck'], true)) {
            $this->assertFalse(Gate::forUser($owner)->allows('create', [Review::class, $card]));
        }
    }

    public static function inaccessibleRecords(): array
    {
        return [['card'], ['deck'], ['missing deck'], ['review'], ['missing card'], ['different reviewer']];
    }
}
