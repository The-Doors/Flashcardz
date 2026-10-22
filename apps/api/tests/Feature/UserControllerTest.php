<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PostgresTestCase;
use Tests\Support\SignsSupabaseTokens;

class UserControllerTest extends PostgresTestCase
{
    use SignsSupabaseTokens;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.supabase.url' => 'https://supabase.test',
            'services.supabase.jwks_url' => 'https://internal.test/keys',
            'services.supabase.jwks_cache_store' => 'array',
        ]);
    }

    public function test_returns_401_json_without_a_bearer_token_even_for_a_browser(): void
    {
        Http::preventStrayRequests();

        $this->get('/api/user', ['Accept' => 'text/html'])
            ->assertUnauthorized()->assertJsonPath('message', 'Unauthenticated.');
        Http::assertNothingSent();
    }

    public function test_returns_401_for_an_invalid_token(): void
    {
        Http::preventStrayRequests();

        $this->withToken('not-a-jwt')->getJson('/api/user')->assertUnauthorized();
        Http::assertNothingSent();
    }

    public function test_returns_the_existing_profile_through_the_default_guard(): void
    {
        $this->resetDatabase();
        DB::table('auth.users')->insert(['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
        $user = User::factory()->create(['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'username' => 'Original']);
        $token = $this->tokenWithUsername('ChangedMetadata');

        $this->withToken($token)->getJson('/api/user')->assertOk()->assertExactJson([
            'id' => $user->id,
            'username' => 'Original',
            'username_lowercase' => 'original',
        ]);
        $this->assertSame($user->id, Auth::user()->id);
        $this->assertDatabaseCount('app.users', 1);
    }

    public function test_provisions_a_profile_from_verified_username_metadata(): void
    {
        $this->resetDatabase();
        DB::table('auth.users')->insert(['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
        $token = $this->tokenWithUsername('Casey');

        $this->withToken($token)->getJson('/api/user')->assertOk()->assertExactJson([
            'id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'username' => 'Casey',
            'username_lowercase' => 'casey',
        ]);
        $this->assertDatabaseHas('app.users', ['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'username_lowercase' => 'casey']);
    }

    #[DataProvider('invalidUsernames')]
    public function test_returns_401_without_creating_a_profile_for_invalid_metadata(mixed $username): void
    {
        $this->resetDatabase();
        DB::table('auth.users')->insert(['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
        $token = $this->tokenWithUsername($username);

        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
        $this->assertDatabaseCount('app.users', 0);
    }

    public static function invalidUsernames(): array
    {
        return ['missing' => [null], 'empty' => [''], 'blank' => ['   '], 'wrong type' => [123], 'too long' => [str_repeat('a', 30)]];
    }

    public function test_accepts_a_29_character_username(): void
    {
        $this->resetDatabase();
        DB::table('auth.users')->insert(['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
        $token = $this->tokenWithUsername(str_repeat('A', 29));

        $this->withToken($token)->getJson('/api/user')->assertOk()->assertJsonPath('username_lowercase', str_repeat('a', 29));
    }

    public function test_returns_409_for_a_case_insensitive_username_conflict(): void
    {
        $this->resetDatabase();
        DB::table('auth.users')->insert([
            ['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
            ['id' => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        ]);
        User::factory()->create(['id' => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'username' => 'Casey']);
        $token = $this->tokenWithUsername('CASEY');

        $this->withToken($token)->getJson('/api/user')->assertConflict()->assertJsonPath('message', 'Username is already taken');
        $this->assertDatabaseCount('app.users', 1);
        $this->assertDatabaseMissing('app.users', ['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
    }

    public function test_returns_401_for_a_deleted_supabase_identity(): void
    {
        $this->resetDatabase();
        $token = $this->tokenWithUsername('Casey');

        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
        $this->assertDatabaseCount('app.users', 0);
    }

    public function test_returns_502_json_if_supabase_keys_are_unavailable(): void
    {
        [$token] = $this->signedToken();
        Http::preventStrayRequests();
        Http::fake(['https://internal.test/keys' => Http::failedConnection()]);

        $this->withToken($token)->getJson('/api/user')->assertStatus(502)->assertJsonPath('message', 'Unable to reach Supabase Auth');
    }

    private function tokenWithUsername(mixed $username): string
    {
        $this->freezeTime();
        [$token, , $key] = $this->signedToken(['user_metadata' => ['username' => $username]]);
        Http::preventStrayRequests();
        Http::fake(['https://internal.test/keys' => Http::response(['keys' => [$key]])]);

        return $token;
    }
}
