<?php

namespace Tests\Feature;

use App\Models\StudyGroup;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Support\PostgresTestCase;

class StudyGroupMigrationTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->resetDatabase();
    }

    public function test_study_group_migration_can_be_rolled_back_and_reapplied(): void
    {
        $this->artisan('migrate:rollback', ['--step' => 1, '--force' => true])->assertExitCode(0);

        foreach (['study_groups', 'study_group_members', 'study_group_invitations', 'study_group_decks'] as $table) {
            $this->assertFalse(Schema::hasTable("app.{$table}"));
        }
        $this->assertFalse(Schema::hasIndex('app.reviews', 'reviews_card_id_user_id_deleted_at_id_index'));
        $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
        $this->assertDatabaseCount('app.study_groups', 0);
    }

    public function test_deleting_an_owner_deletes_their_groups(): void
    {
        $owner = $this->createUser();
        $group = StudyGroup::factory()->for($owner, 'owner')->create();

        DB::table('auth.users')->where('id', $owner->id)->delete();

        $this->assertModelMissing($group);
        $this->assertDatabaseCount('app.study_group_members', 0);
    }

    public function test_study_groups_are_inaccessible_to_supabase_data_api_roles(): void
    {
        StudyGroup::factory()->for($this->createUser(), 'owner')->create();
        DB::unprepared("DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'api_test_group_anon') THEN CREATE ROLE api_test_group_anon; END IF; END \$\$; GRANT USAGE ON SCHEMA app TO api_test_group_anon; GRANT SELECT ON ALL TABLES IN SCHEMA app TO api_test_group_anon;");

        DB::beginTransaction();
        try {
            DB::statement('SET LOCAL ROLE api_test_group_anon');
            $this->assertDatabaseCount('app.study_groups', 0);
            $this->assertDatabaseCount('app.study_group_members', 0);
        } finally {
            DB::rollBack();
        }
    }
}
