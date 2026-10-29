<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\Deck;
use Database\Seeders\CardSeeder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Support\PostgresTestCase;

class CardDeckMigrationTest extends PostgresTestCase
{
    public function test_hard_deleting_an_original_account_preserves_copies_and_clears_source_references(): void
    {
        $this->resetDatabase();
        $author = $this->createUser();
        $recipient = $this->createUser();
        $original = Deck::factory()->for($author)->hasCards(1)->create();
        $card = $original->cards()->first();
        $copy = Deck::factory()->for($recipient)->create(['source_deck_id' => $original->id]);
        $copiedCard = Card::factory()->for($copy)->create(['creator_id' => $author->id, 'source_card_id' => $card->id]);

        DB::table('auth.users')->where('id', $author->id)->delete();

        $this->assertModelMissing($original);
        $this->assertModelMissing($card);
        $this->assertDatabaseHas('app.decks', ['id' => $copy->id, 'user_id' => $recipient->id, 'source_deck_id' => null, 'deleted_at' => null]);
        $this->assertDatabaseHas('app.cards', ['id' => $copiedCard->id, 'deck_id' => $copy->id, 'creator_id' => null, 'source_card_id' => null, 'deleted_at' => null]);
    }

    public function test_card_and_deck_migrations_can_be_rolled_back_and_reapplied(): void
    {
        $this->resetDatabase();

        $this->artisan('migrate:rollback', ['--step' => 3, '--force' => true])->assertExitCode(0);

        $this->assertFalse(Schema::hasTable('app.cards'));
        $this->assertFalse(Schema::hasTable('app.decks'));
        $this->assertTrue(Schema::hasTable('app.users'));
        $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
        $this->assertDatabaseCount('app.cards', 0);
        $this->assertDatabaseCount('app.decks', 0);
    }

    public function test_seeders_only_create_learning_content_for_existing_profiles(): void
    {
        $this->resetDatabase();
        $this->seed(DatabaseSeeder::class);
        $this->assertDatabaseCount('app.decks', 0);
        $owner = $this->createUser();

        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseCount('auth.users', 1);
        $this->assertDatabaseCount('app.users', 1);
        $this->assertDatabaseCount('app.decks', 3);
        $this->assertDatabaseCount('app.cards', 15);
        $this->assertSame([$owner->id], Card::query()->distinct()->pluck('creator_id')->all());
        $this->seed(CardSeeder::class);
        $this->assertDatabaseCount('app.cards', 30);
    }

    public function test_learning_content_is_inaccessible_to_supabase_data_api_roles(): void
    {
        $this->resetDatabase();
        Deck::factory()->for($this->createUser())->public()->hasCards(1)->create();
        DB::unprepared("DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'api_test_anon') THEN CREATE ROLE api_test_anon; END IF; END \$\$; GRANT USAGE ON SCHEMA app TO api_test_anon; GRANT SELECT ON ALL TABLES IN SCHEMA app TO api_test_anon;");

        DB::beginTransaction();
        try {
            DB::statement('SET LOCAL ROLE api_test_anon');
            $this->assertDatabaseCount('app.cards', 0);
            $this->assertDatabaseCount('app.decks', 0);
        } finally {
            DB::rollBack();
        }
    }
}
