<?php

namespace Tests\Feature;

use App\Models\Deck;
use App\Models\StudyGroup;
use App\Models\StudyGroupInvitation;
use App\Models\User;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PostgresTestCase;

class StudyGroupControllerTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->resetDatabase();
    }

    private function groupOwnedBy(User $owner, User ...$members): StudyGroup
    {
        $group = StudyGroup::factory()->for($owner, 'owner')->create();
        $group->members()->attach(array_map(fn (User $member): string => $member->id, $members));

        return $group;
    }

    #[DataProvider('endpoints')]
    public function test_returns_401_without_authentication(string $method, string $path): void
    {
        $this->json($method, $path)->assertUnauthorized();
    }

    public static function endpoints(): array
    {
        return [
            ['GET', '/api/study-groups'],
            ['POST', '/api/study-groups'],
            ['GET', '/api/study-groups/1'],
            ['POST', '/api/study-groups/1/invitations'],
            ['GET', '/api/study-group-invitations'],
            ['POST', '/api/study-group-invitations/1/accept'],
            ['GET', '/api/users/search?username=a'],
        ];
    }

    public function test_creating_a_group_makes_the_creator_its_owner_and_first_member(): void
    {
        $owner = $this->createUser();

        $response = $this->actingAs($owner)->postJson('/api/study-groups', ['name' => 'Biology', 'description' => 'Exam prep'])
            ->assertCreated()
            ->assertJsonPath('name', 'Biology')
            ->assertJsonPath('owner.id', $owner->id)
            ->assertJsonCount(1, 'members')
            ->assertJsonPath('members.0.id', $owner->id);

        $this->assertDatabaseHas('app.study_group_members', ['study_group_id' => $response->json('id'), 'user_id' => $owner->id]);
    }

    public function test_creating_a_group_requires_a_name(): void
    {
        $this->actingAs($this->createUser())->postJson('/api/study-groups', [])->assertUnprocessable()->assertJsonValidationErrors('name');
    }

    public function test_index_lists_only_groups_the_user_belongs_to(): void
    {
        $user = $this->createUser();
        $owned = $this->groupOwnedBy($user);
        $joined = $this->groupOwnedBy($this->createUser(), $user);
        $this->groupOwnedBy($this->createUser());

        $response = $this->actingAs($user)->getJson('/api/study-groups')->assertOk()->assertJsonCount(2, 'data');

        $this->assertSame([$joined->id, $owned->id], array_column($response->json('data'), 'id'));
        $response->assertJsonPath('data.0.members_count', 2);
    }

    public function test_only_members_can_view_a_group(): void
    {
        $member = $this->createUser();
        $group = $this->groupOwnedBy($this->createUser(), $member);
        $deck = Deck::factory()->for($group->owner)->hasCards(2)->create();
        $group->decks()->attach($deck, ['added_by_id' => $group->owner_id]);
        StudyGroupInvitation::factory()->for($group)->for($this->createUser(), 'invitee')->create();

        $this->actingAs($member)->getJson("/api/study-groups/{$group->id}")->assertOk()
            ->assertJsonCount(2, 'members')
            ->assertJsonPath('decks.0.id', $deck->id)
            ->assertJsonPath('decks.0.cards_count', 2)
            ->assertJsonCount(1, 'invitations');
        $this->actingAs($this->createUser())->getJson("/api/study-groups/{$group->id}")->assertNotFound();
    }

    public function test_only_the_owner_can_update_or_delete_a_group(): void
    {
        $owner = $this->createUser();
        $member = $this->createUser();
        $group = $this->groupOwnedBy($owner, $member);

        $this->actingAs($member)->patchJson("/api/study-groups/{$group->id}", ['name' => 'Taken'])->assertForbidden();
        $this->actingAs($member)->deleteJson("/api/study-groups/{$group->id}")->assertForbidden();
        $this->actingAs($this->createUser())->patchJson("/api/study-groups/{$group->id}", ['name' => 'Taken'])->assertNotFound();

        $this->actingAs($owner)->patchJson("/api/study-groups/{$group->id}", ['name' => 'Renamed'])->assertOk()->assertJsonPath('name', 'Renamed');
        $this->actingAs($owner)->deleteJson("/api/study-groups/{$group->id}")->assertNoContent();
        $this->assertDatabaseMissing('app.study_groups', ['id' => $group->id]);
        $this->assertDatabaseMissing('app.study_group_members', ['study_group_id' => $group->id]);
    }

    public function test_owner_invites_a_user_by_username_ignoring_case(): void
    {
        $owner = $this->createUser();
        $invitee = $this->createUser();
        $invitee->update(['username' => 'StudyBuddy']);
        $group = $this->groupOwnedBy($owner);

        $this->actingAs($owner)->postJson("/api/study-groups/{$group->id}/invitations", ['username' => 'studybuddy'])
            ->assertCreated()
            ->assertJsonPath('invitee.username', 'StudyBuddy');
        $this->assertDatabaseHas('app.study_group_invitations', ['study_group_id' => $group->id, 'invitee_id' => $invitee->id, 'inviter_id' => $owner->id]);
    }

    public function test_inviting_rejects_unknown_users_members_and_duplicate_invitations(): void
    {
        $owner = $this->createUser();
        $member = $this->createUser();
        $invited = $this->createUser();
        $group = $this->groupOwnedBy($owner, $member);
        StudyGroupInvitation::factory()->for($group)->for($invited, 'invitee')->create();
        $this->actingAs($owner);

        foreach (['nobody_here', $member->username, $owner->username, $invited->username] as $username) {
            $this->postJson("/api/study-groups/{$group->id}/invitations", ['username' => $username])
                ->assertUnprocessable()->assertJsonValidationErrors('username');
        }
        $this->assertDatabaseCount('app.study_group_invitations', 1);
    }

    public function test_only_the_owner_can_invite(): void
    {
        $member = $this->createUser();
        $group = $this->groupOwnedBy($this->createUser(), $member);
        $target = $this->createUser();

        $this->actingAs($member)->postJson("/api/study-groups/{$group->id}/invitations", ['username' => $target->username])->assertForbidden();
        $this->actingAs($this->createUser())->postJson("/api/study-groups/{$group->id}/invitations", ['username' => $target->username])->assertNotFound();
    }

    public function test_invitee_sees_and_accepts_an_invitation(): void
    {
        $invitee = $this->createUser();
        $group = $this->groupOwnedBy($this->createUser());
        $invitation = StudyGroupInvitation::factory()->for($group)->for($invitee, 'invitee')->create();

        $this->actingAs($invitee)->getJson('/api/study-group-invitations')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.study_group.id', $group->id)
            ->assertJsonPath('data.0.inviter.id', $group->owner_id);

        $this->postJson("/api/study-group-invitations/{$invitation->id}/accept")->assertOk()
            ->assertJsonPath('id', $group->id)->assertJsonPath('members_count', 2);
        $this->assertTrue($group->hasMember($invitee));
        $this->assertModelMissing($invitation);
    }

    public function test_invitee_declines_an_invitation(): void
    {
        $invitee = $this->createUser();
        $group = $this->groupOwnedBy($this->createUser());
        $invitation = StudyGroupInvitation::factory()->for($group)->for($invitee, 'invitee')->create();

        $this->actingAs($invitee)->postJson("/api/study-group-invitations/{$invitation->id}/decline")->assertNoContent();
        $this->assertFalse($group->hasMember($invitee));
        $this->assertModelMissing($invitation);
    }

    public function test_other_users_cannot_answer_an_invitation(): void
    {
        $group = $this->groupOwnedBy($this->createUser());
        $invitation = StudyGroupInvitation::factory()->for($group)->for($this->createUser(), 'invitee')->create();

        $this->actingAs($group->owner)->postJson("/api/study-group-invitations/{$invitation->id}/accept")->assertNotFound();
        $this->actingAs($this->createUser())->postJson("/api/study-group-invitations/{$invitation->id}/decline")->assertNotFound();
        $this->assertModelExists($invitation);
    }

    public function test_only_the_owner_can_cancel_an_invitation(): void
    {
        $member = $this->createUser();
        $group = $this->groupOwnedBy($this->createUser(), $member);
        $invitation = StudyGroupInvitation::factory()->for($group)->for($this->createUser(), 'invitee')->create();

        $this->actingAs($member)->deleteJson("/api/study-group-invitations/{$invitation->id}")->assertNotFound();
        $this->actingAs($group->owner)->deleteJson("/api/study-group-invitations/{$invitation->id}")->assertNoContent();
        $this->assertModelMissing($invitation);
    }

    public function test_members_can_leave_and_owners_can_remove_members(): void
    {
        $owner = $this->createUser();
        $leaving = $this->createUser();
        $removed = $this->createUser();
        $group = $this->groupOwnedBy($owner, $leaving, $removed);

        $this->actingAs($leaving)->deleteJson("/api/study-groups/{$group->id}/members/{$removed->id}")->assertForbidden();
        $this->actingAs($leaving)->deleteJson("/api/study-groups/{$group->id}/members/{$owner->id}")->assertForbidden();
        $this->actingAs($leaving)->deleteJson("/api/study-groups/{$group->id}/members/{$leaving->id}")->assertNoContent();
        $this->actingAs($owner)->deleteJson("/api/study-groups/{$group->id}/members/{$removed->id}")->assertNoContent();
        $this->actingAs($owner)->deleteJson("/api/study-groups/{$group->id}/members/{$owner->id}")->assertForbidden();
        $this->actingAs($owner)->deleteJson("/api/study-groups/{$group->id}/members/{$removed->id}")->assertNotFound();

        $this->assertSame([$owner->id], $group->members()->pluck('app.users.id')->all());
    }

    public function test_members_share_their_own_or_public_sets(): void
    {
        $member = $this->createUser();
        $group = $this->groupOwnedBy($this->createUser(), $member);
        $own = Deck::factory()->for($member)->create();
        $public = Deck::factory()->for($this->createUser())->public()->create();
        $othersPrivate = Deck::factory()->for($this->createUser())->create();
        $this->actingAs($member);

        $this->postJson("/api/study-groups/{$group->id}/decks", ['deck_id' => $own->id])->assertCreated()->assertJsonPath('id', $own->id);
        $this->postJson("/api/study-groups/{$group->id}/decks", ['deck_id' => $public->id])->assertCreated();
        $this->postJson("/api/study-groups/{$group->id}/decks", ['deck_id' => $othersPrivate->id])->assertNotFound();
        $this->postJson("/api/study-groups/{$group->id}/decks", ['deck_id' => $own->id])->assertUnprocessable()->assertJsonValidationErrors('deck_id');

        $this->assertDatabaseHas('app.study_group_decks', ['study_group_id' => $group->id, 'deck_id' => $own->id, 'added_by_id' => $member->id]);
        $this->assertDatabaseCount('app.study_group_decks', 2);
    }

    public function test_non_members_cannot_share_sets(): void
    {
        $outsider = $this->createUser();
        $group = $this->groupOwnedBy($this->createUser());
        $deck = Deck::factory()->for($outsider)->create();

        $this->actingAs($outsider)->postJson("/api/study-groups/{$group->id}/decks", ['deck_id' => $deck->id])->assertNotFound();
        $this->assertDatabaseCount('app.study_group_decks', 0);
    }

    public function test_removing_a_shared_set_is_limited_to_the_owner_or_sharer(): void
    {
        $owner = $this->createUser();
        $sharer = $this->createUser();
        $other = $this->createUser();
        $group = $this->groupOwnedBy($owner, $sharer, $other);
        $first = Deck::factory()->for($sharer)->create();
        $second = Deck::factory()->for($sharer)->create();
        $group->decks()->attach([$first->id => ['added_by_id' => $sharer->id], $second->id => ['added_by_id' => $sharer->id]]);

        $this->actingAs($other)->deleteJson("/api/study-groups/{$group->id}/decks/{$first->id}")->assertForbidden();
        $this->actingAs($sharer)->deleteJson("/api/study-groups/{$group->id}/decks/{$first->id}")->assertNoContent();
        $this->actingAs($owner)->deleteJson("/api/study-groups/{$group->id}/decks/{$second->id}")->assertNoContent();
        $this->actingAs($owner)->deleteJson("/api/study-groups/{$group->id}/decks/{$second->id}")->assertNotFound();
        $this->assertDatabaseCount('app.study_group_decks', 0);
    }

    public function test_user_search_matches_username_prefixes_and_excludes_the_searcher(): void
    {
        $searcher = $this->createUser();
        $match = $this->createUser();
        User::whereKey($match->id)->update(['username' => 'Alex_Smith', 'username_lowercase' => 'alex_smith']);
        $other = $this->createUser();
        User::whereKey($other->id)->update(['username' => 'AlexXSmith', 'username_lowercase' => 'alexxsmith']);
        User::whereKey($searcher->id)->update(['username' => 'AlexSearcher', 'username_lowercase' => 'alexsearcher']);
        $this->createUser();

        $this->actingAs($searcher)->getJson('/api/users/search?username=ALEX_')->assertOk()
            ->assertExactJson(['data' => [['id' => $match->id, 'username' => 'Alex_Smith']]]);
        $this->getJson('/api/users/search?username=alex')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_user_search_reports_membership_and_invitations_for_a_group(): void
    {
        $owner = $this->createUser();
        $member = $this->createUser();
        $invited = $this->createUser();
        $group = $this->groupOwnedBy($owner, $member);
        StudyGroupInvitation::factory()->for($group)->for($invited, 'invitee')->create();
        foreach ([$member, $invited] as $index => $user) {
            User::whereKey($user->id)->update(['username' => "Pal{$index}", 'username_lowercase' => "pal{$index}"]);
        }

        $this->actingAs($owner)->getJson("/api/users/search?username=pal&study_group_id={$group->id}")->assertOk()
            ->assertJsonPath('data.0.id', $member->id)->assertJsonPath('data.0.is_member', true)->assertJsonPath('data.0.is_invited', false)
            ->assertJsonPath('data.1.id', $invited->id)->assertJsonPath('data.1.is_member', false)->assertJsonPath('data.1.is_invited', true);
        $this->actingAs($this->createUser())->getJson("/api/users/search?username=pal&study_group_id={$group->id}")->assertNotFound();
    }
}
