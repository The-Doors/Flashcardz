<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\Deck;
use App\Models\Review;
use App\Models\StudyGroup;
use App\Models\User;
use App\Services\Fsrs\Scheduler;
use Carbon\CarbonImmutable;
use Tests\Support\PostgresTestCase;

class StudyGroupStudyingTest extends PostgresTestCase
{
    private User $owner;

    private User $member;

    private StudyGroup $group;

    private Deck $deck;

    private Card $card;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resetDatabase();
        $this->travelTo(CarbonImmutable::parse('2026-10-28 12:00:00', 'UTC'));
        $this->app->instance(Scheduler::class, new Scheduler(enableFuzzing: false));

        $this->owner = $this->createUser();
        $this->member = $this->createUser();
        $this->group = StudyGroup::factory()->for($this->owner, 'owner')->create();
        $this->group->members()->attach($this->member);
        $this->deck = Deck::factory()->for($this->owner)->create();
        $this->card = Card::factory()->for($this->deck)->create(['created_at' => now()->subDay()]);
        $this->group->decks()->attach($this->deck, ['added_by_id' => $this->owner->id]);
    }

    public function test_members_can_view_a_shared_private_set_and_its_cards(): void
    {
        $this->actingAs($this->member);

        $this->getJson("/api/decks/{$this->deck->id}")->assertOk()->assertJsonPath('can_study', true);
        $this->getJson("/api/cards/{$this->card->id}")->assertOk();
        $this->getJson("/api/cards?deck_id={$this->deck->id}")->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/decks')->assertOk()->assertJsonPath('data.0.id', $this->deck->id);
        $this->getJson('/api/decks?mine=true')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_non_members_cannot_view_a_shared_private_set(): void
    {
        $this->actingAs($this->createUser());

        $this->getJson("/api/decks/{$this->deck->id}")->assertNotFound();
        $this->getJson("/api/cards/{$this->card->id}")->assertNotFound();
        $this->postJson('/api/reviews', ['card_id' => $this->card->id, 'rating' => 3, 'previous_review_id' => null])->assertNotFound();
    }

    public function test_shared_sets_appear_in_the_members_review_queue(): void
    {
        $this->actingAs($this->member)->getJson('/api/reviews')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $this->card->id)
            ->assertJsonPath('data.0.latest_review_id', null);
        $this->getJson("/api/reviews?deck_id={$this->deck->id}")->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_each_member_keeps_their_own_schedule_for_a_shared_card(): void
    {
        $ownerReview = $this->actingAs($this->owner)
            ->postJson('/api/reviews', ['card_id' => $this->card->id, 'rating' => 3, 'previous_review_id' => null])
            ->assertCreated();

        $this->actingAs($this->member)->getJson('/api/reviews')->assertOk()
            ->assertJsonPath('data.0.latest_review_id', null)
            ->assertJsonPath('data.0.schedule.state', 1);
        $memberReview = $this->postJson('/api/reviews', ['card_id' => $this->card->id, 'rating' => 1, 'previous_review_id' => null])
            ->assertCreated()
            ->assertJsonPath('user_id', $this->member->id);

        $this->actingAs($this->owner)->getJson('/api/reviews')->assertOk()->assertJsonPath('data.0.latest_review_id', $ownerReview->json('id'));
        $this->actingAs($this->member)->getJson('/api/reviews')->assertOk()->assertJsonPath('data.0.latest_review_id', $memberReview->json('id'));
    }

    public function test_members_can_only_undo_their_own_latest_review(): void
    {
        $memberReview = Review::factory()->for($this->card)->for($this->member)->learning()->create();
        Review::factory()->for($this->card)->for($this->owner)->learning()->create();

        $this->actingAs($this->owner)->postJson("/api/reviews/{$memberReview->id}/undo")->assertNotFound();
        $this->actingAs($this->member)->postJson("/api/reviews/{$memberReview->id}/undo")->assertNoContent();
        $this->assertSoftDeleted($memberReview);
    }

    public function test_last_studied_only_counts_the_users_own_reviews(): void
    {
        Review::factory()->for($this->card)->for($this->member)->create(['review_datetime' => '2026-10-27 09:00:00 UTC']);

        $this->actingAs($this->owner)->getJson('/api/decks?mine=true')->assertOk()->assertJsonPath('data.0.last_studied_at', null);
    }

    public function test_leaving_the_group_removes_access_to_its_sets(): void
    {
        $this->group->members()->detach($this->member);
        $this->actingAs($this->member);

        $this->getJson("/api/decks/{$this->deck->id}")->assertNotFound();
        $this->getJson('/api/reviews')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/reviews', ['card_id' => $this->card->id, 'rating' => 3, 'previous_review_id' => null])->assertNotFound();
    }

    public function test_public_sets_outside_the_users_groups_cannot_be_studied(): void
    {
        $public = Deck::factory()->for($this->createUser())->public()->create();

        $this->actingAs($this->member)->getJson("/api/decks/{$public->id}")->assertOk()->assertJsonPath('can_study', false);
    }
}
