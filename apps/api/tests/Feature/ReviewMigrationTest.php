<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\Deck;
use App\Models\Review;
use App\Services\Fsrs\State;
use Carbon\CarbonImmutable;
use Database\Seeders\ReviewSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Support\PostgresTestCase;

class ReviewMigrationTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->resetDatabase();
    }

    public function test_review_migration_can_be_rolled_back_and_reapplied(): void
    {
        $this->artisan('migrate:rollback', ['--step' => 1, '--force' => true])->assertExitCode(0);

        $this->assertFalse(Schema::hasTable('app.reviews'));
        $this->assertTrue(Schema::hasTable('app.cards'));
        $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
        $this->assertDatabaseCount('app.reviews', 0);
    }

    public function test_hard_deleting_cards_or_accounts_removes_their_review_history(): void
    {
        $owner = $this->createUser();
        $deck = Deck::factory()->for($owner)->create();
        $first = Review::factory()->for(Card::factory()->for($deck))->create();
        $second = Review::factory()->for(Card::factory()->for($deck))->create();

        $first->card->forceDelete();

        $this->assertModelMissing($first);
        $this->assertModelExists($second);
        DB::table('auth.users')->where('id', $owner->id)->delete();
        $this->assertModelMissing($second);
    }

    public function test_reviews_are_inaccessible_to_supabase_data_api_roles(): void
    {
        Review::factory()->for(Card::factory()->for(Deck::factory()->for($this->createUser())))->create();
        DB::unprepared("DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'api_test_review_anon') THEN CREATE ROLE api_test_review_anon; END IF; END \$\$; GRANT USAGE ON SCHEMA app TO api_test_review_anon; GRANT SELECT ON ALL TABLES IN SCHEMA app TO api_test_review_anon;");

        DB::beginTransaction();
        try {
            DB::statement('SET LOCAL ROLE api_test_review_anon');
            $this->assertDatabaseCount('app.reviews', 0);
        } finally {
            DB::rollBack();
        }
    }

    public function test_review_snapshots_preserve_microseconds_and_round_trip_through_utc(): void
    {
        $review = Review::factory()->for(Card::factory()->for(Deck::factory()->for($this->createUser())))->create([
            'review_datetime' => CarbonImmutable::parse('2026-10-28T12:00:00.123456Z'),
            'due' => CarbonImmutable::parse('2026-10-28T12:10:00.123456Z'),
        ])->refresh();

        $this->assertSame('2026-10-28T12:00:00.123456Z', $review->review_datetime->toJSON());
        $this->assertSame('2026-10-28T12:10:00.123456Z', $review->due->toJSON());
        $this->assertSame(State::Review, $review->state);
    }

    public function test_review_seeder_creates_one_real_learning_answer_per_new_card(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-28T12:00:00Z'));
        $owner = $this->createUser();
        $card = Card::factory()->for(Deck::factory()->for($owner))->create();

        $this->seed(ReviewSeeder::class);
        $this->seed(ReviewSeeder::class);

        $this->assertDatabaseCount('app.reviews', 1);
        $this->assertDatabaseHas('app.reviews', ['card_id' => $card->id, 'user_id' => $owner->id, 'rating' => 3, 'state' => 1, 'step' => 1]);
        $this->assertSame('2026-10-28T12:10:00.000000Z', $card->latestReview->due->toJSON());
    }
}
