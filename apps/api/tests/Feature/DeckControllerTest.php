<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\Deck;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PostgresTestCase;

class DeckControllerTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->resetDatabase();
    }

    public function test_guests_only_list_public_decks(): void
    {
        $owner = $this->createUser();
        Deck::factory()->for($owner)->create();
        $public = Deck::factory()->for($owner)->public()->hasCards(2)->create();
        Deck::factory()->for($owner)->public()->trashed()->create();

        $this->getJson('/api/decks')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $public->id)->assertJsonPath('data.0.cards_count', 2);
    }

    public function test_authenticated_users_list_public_and_their_own_private_decks(): void
    {
        $owner = $this->createUser();
        $other = $this->createUser();
        Deck::factory()->for($owner)->create();
        Deck::factory()->for($other)->public()->create();
        $private = Deck::factory()->for($other)->create();

        $this->actingAs($owner)->getJson('/api/decks')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonMissing(['id' => $private->id]);
    }

    public function test_guest_can_view_a_public_deck_but_private_decks_return_404(): void
    {
        $owner = $this->createUser();
        $public = Deck::factory()->for($owner)->public()->create();
        $private = Deck::factory()->for($owner)->create();

        $this->getJson("/api/decks/{$public->id}")->assertOk()->assertJsonPath('id', $public->id);
        $this->getJson("/api/decks/{$private->id}")->assertNotFound();
        $this->actingAs($this->createUser())->getJson("/api/decks/{$private->id}")->assertNotFound();
        $this->actingAs($owner)->getJson("/api/decks/{$private->id}")->assertOk();
    }

    public function test_invalid_optional_token_still_allows_public_reads(): void
    {
        Http::preventStrayRequests();
        $deck = Deck::factory()->for($this->createUser())->public()->create();

        $this->withToken('not-a-jwt')->getJson("/api/decks/{$deck->id}")->assertOk();
        Http::assertNothingSent();
    }

    #[DataProvider('writeEndpoints')]
    public function test_writes_return_401_without_authentication(string $method, string $path): void
    {
        $this->json($method, $path)->assertUnauthorized();
        $this->assertDatabaseCount('app.decks', 0);
    }

    public static function writeEndpoints(): array
    {
        return [
            'create' => ['POST', '/api/decks'],
            'update' => ['PATCH', '/api/decks/1'],
            'delete' => ['DELETE', '/api/decks/1'],
            'copy' => ['POST', '/api/decks/1/copy'],
        ];
    }

    public function test_creates_a_private_deck_owned_by_the_current_user(): void
    {
        $owner = $this->createUser();
        $other = $this->createUser();

        $response = $this->actingAs($owner)->postJson('/api/decks', [
            'name' => 'Biology', 'user_id' => $other->id, 'source_deck_id' => 999, 'deleted_at' => now(),
        ])->assertCreated()->assertJsonPath('name', 'Biology')->assertJsonPath('user_id', $owner->id)
            ->assertJsonPath('is_public', false)->assertJsonPath('source_deck_id', null);

        $this->assertDatabaseHas('app.decks', ['id' => $response->json('id'), 'user_id' => $owner->id, 'deleted_at' => null]);
    }

    #[DataProvider('invalidDecks')]
    public function test_invalid_decks_return_422(array $payload, array $errors): void
    {
        $this->actingAs($this->createUser())->postJson('/api/decks', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors($errors);
        $this->assertDatabaseCount('app.decks', 0);
    }

    public static function invalidDecks(): array
    {
        return [
            'missing name' => [[], ['name' => 'The name field is required.']],
            'blank name' => [['name' => '   '], ['name' => 'The name field is required.']],
            'name type' => [['name' => []], ['name' => 'The name field is required.']],
            'name too long' => [['name' => str_repeat('a', 256)], ['name' => 'The name field must not be greater than 255 characters.']],
            'description type' => [['name' => 'Biology', 'description' => 1], ['description' => 'The description field must be a string.']],
            'description too long' => [['name' => 'Biology', 'description' => str_repeat('a', 1001)], ['description' => 'The description field must not be greater than 1000 characters.']],
            'visibility type' => [['name' => 'Biology', 'is_public' => 'public'], ['is_public' => 'The is public field must be true or false.']],
        ];
    }

    public function test_owner_can_update_and_publish_a_deck_without_changing_ownership(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();

        $this->actingAs($owner)->patchJson("/api/decks/{$deck->id}", [
            'name' => 'Chemistry', 'description' => null, 'is_public' => true, 'user_id' => $this->createUser()->id,
        ])->assertOk()->assertJsonPath('is_public', true);

        $this->assertDatabaseHas('app.decks', ['id' => $deck->id, 'name' => 'Chemistry', 'description' => null, 'is_public' => true, 'user_id' => $owner->id]);
    }

    public function test_invalid_updates_return_422_without_changing_the_deck(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create(['name' => 'Biology']);

        $this->actingAs($owner)->patchJson("/api/decks/{$deck->id}", ['name' => null, 'is_public' => null])
            ->assertUnprocessable()->assertJsonValidationErrors(['name', 'is_public']);
        $this->assertDatabaseHas('app.decks', ['id' => $deck->id, 'name' => 'Biology', 'is_public' => false]);
    }

    public function test_other_users_cannot_update_or_delete_a_public_deck(): void
    {
        $deck = Deck::factory()->for($this->createUser())->public()->create(['name' => 'Biology']);
        $this->actingAs($this->createUser());

        $this->patchJson("/api/decks/{$deck->id}", ['name' => 'Changed'])->assertForbidden();
        $this->deleteJson("/api/decks/{$deck->id}")->assertForbidden();
        $this->assertDatabaseHas('app.decks', ['id' => $deck->id, 'name' => 'Biology', 'deleted_at' => null]);
    }

    public function test_deleting_a_deck_soft_deletes_its_cards_and_removes_them_from_reads(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->public()->hasCards(1)->create();
        $card = $deck->cards()->first();

        $this->actingAs($owner)->deleteJson("/api/decks/{$deck->id}")->assertNoContent();

        $this->assertSoftDeleted($deck);
        $this->assertSoftDeleted($card);
        $this->getJson("/api/decks/{$deck->id}")->assertNotFound();
        $this->getJson("/api/cards/{$card->id}")->assertNotFound();
        $this->getJson('/api/cards')->assertJsonCount(0, 'data');
    }

    public function test_copying_a_public_deck_creates_an_independent_private_deck_with_attribution(): void
    {
        $author = $this->createUser();
        $deck = Deck::factory()->for($author)->public()->create(['name' => 'Biology']);
        $card = Card::factory()->for($deck)->create(['content' => 'Original']);
        Card::factory()->for($deck)->trashed()->create();
        $recipient = $this->createUser();

        $response = $this->actingAs($recipient)->postJson("/api/decks/{$deck->id}/copy", ['is_public' => true])
            ->assertCreated()->assertJsonPath('user_id', $recipient->id)->assertJsonPath('source_deck_id', $deck->id)
            ->assertJsonPath('is_public', false)->assertJsonPath('cards_count', 1);

        $copy = Deck::findOrFail($response->json('id'));
        $copiedCard = $copy->cards()->first();
        $this->assertDatabaseHas('app.cards', ['id' => $copiedCard->id, 'deck_id' => $copy->id, 'content' => 'Original', 'creator_id' => $author->id, 'source_card_id' => $card->id]);
        $this->patchJson("/api/cards/{$copiedCard->id}", ['content' => 'My changes'])->assertOk();
        $this->assertDatabaseHas('app.cards', ['id' => $card->id, 'content' => 'Original']);
        $this->actingAs($author)->deleteJson("/api/decks/{$deck->id}")->assertNoContent();
        $this->assertNotSoftDeleted($copy);
        $this->assertNotSoftDeleted($copiedCard);
    }

    public function test_copying_another_users_private_deck_returns_404_without_creating_a_copy(): void
    {
        $deck = Deck::factory()->for($this->createUser())->create();

        $this->actingAs($this->createUser())->postJson("/api/decks/{$deck->id}/copy")->assertNotFound();
        $this->assertDatabaseCount('app.decks', 1);
    }
}
