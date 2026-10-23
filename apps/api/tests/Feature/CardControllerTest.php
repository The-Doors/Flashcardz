<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\Deck;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PostgresTestCase;

class CardControllerTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->resetDatabase();
    }

    public function test_guests_only_list_cards_in_public_non_deleted_decks(): void
    {
        $owner = $this->createUser();
        $public = Deck::factory()->for($owner)->public()->create();
        $card = Card::factory()->for($public)->create();
        Card::factory()->for($public)->trashed()->create();
        Card::factory()->for(Deck::factory()->for($owner))->create();
        Card::factory()->for(Deck::factory()->for($owner)->public()->trashed())->create();

        $this->getJson('/api/cards')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $card->id);
    }

    public function test_authenticated_users_list_public_and_owned_cards_and_can_filter_by_deck(): void
    {
        $owner = $this->createUser();
        $other = $this->createUser();
        $mine = Deck::factory()->for($owner)->create();
        $card = Card::factory()->for($mine)->create();
        Card::factory()->for(Deck::factory()->for($other)->public())->create();
        $private = Card::factory()->for(Deck::factory()->for($other))->create();
        $this->actingAs($owner);

        $this->getJson('/api/cards')->assertOk()->assertJsonCount(2, 'data')->assertJsonMissing(['id' => $private->id]);
        $this->getJson("/api/cards?deck_id={$mine->id}")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $card->id);
        $this->getJson("/api/cards?deck_id={$private->deck_id}")->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/cards?deck_id=invalid')->assertUnprocessable()->assertJsonValidationErrors(['deck_id']);
    }

    public function test_card_visibility_follows_its_deck(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->public()->create();
        $card = Card::factory()->for($deck)->create();

        $this->getJson("/api/cards/{$card->id}")->assertOk()->assertJsonPath('content', $card->content)->assertJsonMissingPath('deck');
        $deck->update(['is_public' => false]);
        $this->getJson("/api/cards/{$card->id}")->assertNotFound();
        $this->actingAs($this->createUser())->getJson("/api/cards/{$card->id}")->assertNotFound();
        $this->actingAs($owner)->getJson("/api/cards/{$card->id}")->assertOk();
    }

    #[DataProvider('writeEndpoints')]
    public function test_writes_return_401_without_authentication(string $method, string $path): void
    {
        $this->json($method, $path)->assertUnauthorized();
        $this->assertDatabaseCount('app.cards', 0);
    }

    public static function writeEndpoints(): array
    {
        return [
            'create' => ['POST', '/api/cards'],
            'update' => ['PATCH', '/api/cards/1'],
            'delete' => ['DELETE', '/api/cards/1'],
            'copy' => ['POST', '/api/cards/1/copy'],
        ];
    }

    public function test_creates_a_card_preserving_markdown_whitespace_and_assigning_the_creator(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $content = "    indented code\n\n<!-- card:back -->\n\n**Answer**  \n";

        $response = $this->actingAs($owner)->postJson('/api/cards', [
            'deck_id' => $deck->id, 'content' => $content, 'creator_id' => $this->createUser()->id,
            'source_card_id' => 999, 'deleted_at' => now(),
        ])->assertCreated()->assertJsonPath('content', $content)->assertJsonPath('creator_id', $owner->id)
            ->assertJsonPath('source_card_id', null);

        $this->assertDatabaseHas('app.cards', ['id' => $response->json('id'), 'deck_id' => $deck->id, 'content' => $content, 'creator_id' => $owner->id, 'deleted_at' => null]);
    }

    public function test_missing_card_fields_return_422_without_creating_a_card(): void
    {
        $this->actingAs($this->createUser())->postJson('/api/cards', [])->assertUnprocessable()
            ->assertJsonValidationErrors(['content' => 'The content field is required.', 'deck_id' => 'The deck id field is required.']);
        $this->assertDatabaseCount('app.cards', 0);
    }

    #[DataProvider('invalidContent')]
    public function test_invalid_content_returns_422(mixed $content, string $message): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();

        $this->actingAs($owner)->postJson('/api/cards', ['deck_id' => $deck->id, 'content' => $content])
            ->assertUnprocessable()->assertJsonValidationErrors(['content' => $message]);
        $this->assertDatabaseCount('app.cards', 0);
    }

    public static function invalidContent(): array
    {
        return [
            'null' => [null, 'The content field is required.'],
            'blank' => ['  ', 'The content field is required.'],
            'wrong type' => [123, 'The content field must be a string.'],
        ];
    }

    #[DataProvider('invalidDestinations')]
    public function test_create_move_and_copy_reject_destinations_the_user_does_not_own(string $destination): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $card = Card::factory()->for($deck)->create(['content' => 'Original']);
        $target = match ($destination) {
            'other private' => Deck::factory()->for($this->createUser())->create()->id,
            'other public' => Deck::factory()->for($this->createUser())->public()->create()->id,
            'deleted' => Deck::factory()->for($owner)->trashed()->create()->id,
            'missing' => 999,
            'invalid' => 'invalid',
        };
        $this->actingAs($owner);

        $this->postJson('/api/cards', ['deck_id' => $target, 'content' => 'New'])->assertUnprocessable()->assertJsonValidationErrors(['deck_id']);
        $this->patchJson("/api/cards/{$card->id}", ['deck_id' => $target, 'content' => 'Changed'])->assertUnprocessable()->assertJsonValidationErrors(['deck_id']);
        $this->postJson("/api/cards/{$card->id}/copy", ['deck_id' => $target])->assertUnprocessable()->assertJsonValidationErrors(['deck_id']);
        $this->assertDatabaseCount('app.cards', 1);
        $this->assertDatabaseHas('app.cards', ['id' => $card->id, 'deck_id' => $deck->id, 'content' => 'Original']);
    }

    public static function invalidDestinations(): array
    {
        return ['other private' => ['other private'], 'other public' => ['other public'], 'deleted' => ['deleted'], 'missing' => ['missing'], 'invalid' => ['invalid']];
    }

    public function test_owner_can_update_and_move_a_card_between_owned_decks(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $target = Deck::factory()->for($owner)->create();
        $card = Card::factory()->for($deck)->create();

        $this->actingAs($owner)->patchJson("/api/cards/{$card->id}", ['deck_id' => $target->id, 'content' => 'New content', 'creator_id' => $this->createUser()->id])
            ->assertOk()->assertJsonPath('content', 'New content')->assertJsonPath('deck_id', $target->id)->assertJsonMissingPath('deck');
        $this->assertDatabaseHas('app.cards', ['id' => $card->id, 'deck_id' => $target->id, 'content' => 'New content', 'creator_id' => $owner->id]);
    }

    public function test_invalid_update_returns_422_without_changing_the_card(): void
    {
        $owner = $this->createUser();
        $card = Card::factory()->for(Deck::factory()->for($owner))->create(['content' => 'Original']);

        $this->actingAs($owner)->patchJson("/api/cards/{$card->id}", ['content' => null, 'deck_id' => null])
            ->assertUnprocessable()->assertJsonValidationErrors(['content', 'deck_id']);
        $this->assertDatabaseHas('app.cards', ['id' => $card->id, 'content' => 'Original']);
    }

    public function test_other_users_cannot_update_or_delete_public_cards(): void
    {
        $card = Card::factory()->for(Deck::factory()->for($this->createUser())->public())->create(['content' => 'Original']);
        $this->actingAs($this->createUser());

        $this->patchJson("/api/cards/{$card->id}", ['content' => 'Changed'])->assertForbidden();
        $this->deleteJson("/api/cards/{$card->id}")->assertForbidden();
        $this->assertDatabaseHas('app.cards', ['id' => $card->id, 'content' => 'Original', 'deleted_at' => null]);
    }

    public function test_owner_can_soft_delete_a_card(): void
    {
        $owner = $this->createUser();
        $card = Card::factory()->for(Deck::factory()->for($owner))->create();

        $this->actingAs($owner)->deleteJson("/api/cards/{$card->id}")->assertNoContent();
        $this->assertSoftDeleted($card);
        $this->getJson("/api/cards/{$card->id}")->assertNotFound();
        $this->patchJson("/api/cards/{$card->id}", ['content' => 'Changed'])->assertNotFound();
    }

    public function test_copying_a_public_card_preserves_attribution_and_is_independent(): void
    {
        $author = $this->createUser();
        $card = Card::factory()->for(Deck::factory()->for($author)->public())->create(['content' => 'Original']);
        $recipient = $this->createUser();
        $target = Deck::factory()->for($recipient)->create();

        $response = $this->actingAs($recipient)->postJson("/api/cards/{$card->id}/copy", ['deck_id' => $target->id, 'content' => 'Spoofed', 'creator_id' => $recipient->id])
            ->assertCreated()->assertJsonPath('content', 'Original')->assertJsonPath('creator_id', $author->id)->assertJsonPath('source_card_id', $card->id);
        $copy = Card::findOrFail($response->json('id'));
        $this->patchJson("/api/cards/{$copy->id}", ['content' => 'Changed'])->assertOk();
        $this->assertDatabaseHas('app.cards', ['id' => $copy->id, 'content' => 'Changed', 'deck_id' => $target->id]);
        $this->assertDatabaseHas('app.cards', ['id' => $card->id, 'content' => 'Original']);
        $this->actingAs($author)->patchJson("/api/cards/{$copy->id}", ['content' => 'Author change'])->assertForbidden();
    }

    public function test_copying_a_private_card_is_forbidden_without_creating_a_copy(): void
    {
        $card = Card::factory()->for(Deck::factory()->for($this->createUser()))->create();
        $recipient = $this->createUser();
        $target = Deck::factory()->for($recipient)->create();

        $this->actingAs($recipient)->postJson("/api/cards/{$card->id}/copy", ['deck_id' => $target->id])->assertForbidden();
        $this->assertDatabaseCount('app.cards', 1);
    }

    public function test_copy_requires_a_destination_deck(): void
    {
        $owner = $this->createUser();
        $card = Card::factory()->for(Deck::factory()->for($owner))->create();

        $this->actingAs($owner)->postJson("/api/cards/{$card->id}/copy", [])->assertUnprocessable()
            ->assertJsonValidationErrors(['deck_id' => 'The deck id field is required.']);
        $this->assertDatabaseCount('app.cards', 1);
    }
}
