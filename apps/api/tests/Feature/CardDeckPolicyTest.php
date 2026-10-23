<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\Deck;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CardDeckPolicyTest extends TestCase
{
    #[DataProvider('permissions')]
    public function test_deck_and_card_permissions_follow_visibility_and_deck_ownership(string $viewer, bool $public, bool $canView, bool $canWrite, bool $canCopy): void
    {
        $owner = User::factory()->make();
        $other = User::factory()->make();
        $user = match ($viewer) {
            'owner' => $owner,
            'other' => $other,
            'guest' => null,
        };
        $deck = Deck::factory()->make(['id' => 1, 'user_id' => $owner->id, 'is_public' => $public]);
        $card = Card::factory()->make(['deck_id' => 1, 'creator_id' => $other->id]);
        $card->setRelation('deck', $deck);
        $gate = Gate::forUser($user);

        foreach ([$deck, $card] as $model) {
            $this->assertTrue($gate->allows('viewAny', $model::class));
            $this->assertSame($viewer !== 'guest', $gate->allows('create', $model::class));
            $this->assertSame($canView, $gate->allows('view', $model));
            $this->assertSame($canWrite, $gate->allows('update', $model));
            $this->assertSame($canWrite, $gate->allows('delete', $model));
            $this->assertSame($canCopy, $gate->allows('copy', $model));
            $this->assertFalse($gate->allows('restore', $model));
            $this->assertFalse($gate->allows('forceDelete', $model));
        }
    }

    public static function permissions(): array
    {
        return [
            'guest public' => ['guest', true, true, false, false],
            'guest private' => ['guest', false, false, false, false],
            'other public' => ['other', true, true, false, true],
            'other private' => ['other', false, false, false, false],
            'owner public' => ['owner', true, true, true, true],
            'owner private' => ['owner', false, true, true, true],
        ];
    }

    public function test_deleted_decks_and_cards_are_inaccessible_even_to_the_owner(): void
    {
        $owner = User::factory()->make();
        $deck = Deck::factory()->trashed()->make(['id' => 1, 'user_id' => $owner->id, 'is_public' => true]);
        $card = Card::factory()->trashed()->make(['deck_id' => 1, 'creator_id' => $owner->id]);
        $card->setRelation('deck', $deck);
        $gate = Gate::forUser($owner);

        foreach ([$deck, $card] as $model) {
            foreach (['view', 'update', 'delete', 'copy'] as $ability) {
                $this->assertFalse($gate->allows($ability, $model));
            }
        }
    }

    public function test_cards_without_a_live_deck_are_inaccessible(): void
    {
        $owner = User::factory()->make();
        $card = Card::factory()->make(['deck_id' => 1, 'creator_id' => $owner->id]);
        $card->setRelation('deck', null);

        foreach (['view', 'update', 'delete', 'copy'] as $ability) {
            $this->assertFalse(Gate::forUser($owner)->allows($ability, $card));
        }
    }
}
