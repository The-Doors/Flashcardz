<?php

namespace Tests\Feature;

use App\Services\SupabaseJwtVerifier;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\Support\SignsSupabaseTokens;
use Tests\TestCase;

class SupabaseJwtVerifierTest extends TestCase
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

    public function test_verifies_tokens_using_the_internal_jwks_url_and_public_issuer(): void
    {
        $this->freezeTime();
        [$token, $claims, $key] = $this->signedToken();
        $this->fakeJwks($key);

        $this->assertSame($claims, app(SupabaseJwtVerifier::class)->verify($token));
        Http::assertSentCount(1);
    }

    #[DataProvider('invalidClaims')]
    public function test_rejects_invalid_claims_without_fetching_keys(array $overrides): void
    {
        $this->travelTo('2026-10-22 12:00:00 UTC');
        [$token] = $this->signedToken($overrides);
        Http::preventStrayRequests();

        $this->assertNull(app(SupabaseJwtVerifier::class)->verify($token));
        Http::assertNothingSent();
    }

    public static function invalidClaims(): array
    {
        return [
            'expired' => [['exp' => 0]],
            'wrong issuer' => [['iss' => 'https://wrong.test/auth/v1']],
            'wrong audience' => [['aud' => 'anon']],
            'missing expiration' => [['exp' => null]],
            'string expiration' => [['exp' => '9999999999']],
            'future not before' => [['nbf' => 9999999999]],
            'future issued at' => [['iat' => 9999999999]],
            'invalid UUID' => [['sub' => 'not-a-uuid']],
            'missing subject' => [['sub' => null]],
        ];
    }

    public function test_accepts_the_authenticated_audience_in_an_array(): void
    {
        [$token, $claims, $key] = $this->signedToken(['aud' => ['authenticated']]);
        $this->fakeJwks($key);

        $this->assertSame($claims, app(SupabaseJwtVerifier::class)->verify($token));
    }

    public function test_rejects_malformed_tokens_and_unsupported_algorithms(): void
    {
        [$unsupported] = $this->signedToken([], ['alg' => 'HS256']);
        [$noKid] = $this->signedToken([], ['kid' => '']);
        Http::preventStrayRequests();
        $verifier = app(SupabaseJwtVerifier::class);

        foreach (['not-a-jwt', 'a.b.c', '!!!.e30.abc', $unsupported, $noKid] as $token) {
            $this->assertNull($verifier->verify($token));
        }
        Http::assertNothingSent();
    }

    public function test_rejects_an_invalid_signature(): void
    {
        [$token, , $key] = $this->signedToken();
        $parts = explode('.', $token);
        $parts[2] = str_repeat('A', 86);
        $this->fakeJwks($key);

        $this->assertNull(app(SupabaseJwtVerifier::class)->verify(implode('.', $parts)));
    }

    public function test_caches_keys_for_ten_minutes(): void
    {
        $this->freezeTime();
        [$token, $claims, $key] = $this->signedToken();
        $this->fakeJwks($key);
        $verifier = app(SupabaseJwtVerifier::class);

        $this->assertSame($claims, $verifier->verify($token));
        $this->travel(9)->minutes();
        $this->assertSame($claims, $verifier->verify($token));
        Http::assertSentCount(1);
        $this->travel(2)->minutes();
        $this->assertSame($claims, $verifier->verify($token));
        Http::assertSentCount(2);
    }

    public function test_refreshes_unknown_keys_once_per_minute(): void
    {
        $this->freezeTime();
        [$oldToken, , $oldKey] = $this->signedToken();
        [$newToken, $newClaims, $newKey] = $this->signedToken([], ['kid' => 'rotated-key']);
        [$unknownToken] = $this->signedToken([], ['kid' => 'unknown-key']);
        Http::preventStrayRequests();
        Http::fake(['https://internal.test/keys' => Http::sequence()
            ->push(['keys' => [$oldKey]])
            ->push(['keys' => [$oldKey, $newKey]])
            ->push(['keys' => [$oldKey, $newKey]])]);
        $verifier = app(SupabaseJwtVerifier::class);

        $this->assertNotNull($verifier->verify($oldToken));
        $this->assertSame($newClaims, $verifier->verify($newToken));
        $this->assertNull($verifier->verify($unknownToken));
        Http::assertSentCount(2);
        $this->travel(61)->seconds();
        $this->assertNull($verifier->verify($unknownToken));
        Http::assertSentCount(3);
    }

    #[DataProvider('invalidKeys')]
    public function test_rejects_incompatible_or_malformed_keys(array $overrides): void
    {
        [$token, , $key] = $this->signedToken();
        $this->fakeJwks(array_replace($key, $overrides));

        $this->assertNull(app(SupabaseJwtVerifier::class)->verify($token));
    }

    public static function invalidKeys(): array
    {
        return [
            'wrong type' => [['kty' => 'RSA']],
            'wrong curve' => [['crv' => 'P-384']],
            'wrong algorithm' => [['alg' => 'HS256']],
            'encryption only' => [['use' => 'enc']],
            'sign only' => [['key_ops' => ['sign']]],
            'malformed coordinate' => [['x' => 'invalid']],
        ];
    }

    public function test_returns_502_on_jwks_connection_failure(): void
    {
        [$token] = $this->signedToken();
        Http::preventStrayRequests();
        Http::fake(['https://internal.test/keys' => Http::failedConnection()]);

        try {
            app(SupabaseJwtVerifier::class)->verify($token);
            $this->fail('Expected a JWKS connection failure.');
        } catch (HttpException $exception) {
            $this->assertSame(502, $exception->getStatusCode());
            $this->assertSame('Unable to reach Supabase Auth', $exception->getMessage());
        }
    }

    public function test_returns_502_on_an_invalid_jwks_response(): void
    {
        [$token] = $this->signedToken();
        Http::preventStrayRequests();
        Http::fake(['https://internal.test/keys' => Http::response(['error' => 'unavailable'], 500)]);

        try {
            app(SupabaseJwtVerifier::class)->verify($token);
            $this->fail('Expected a JWKS response failure.');
        } catch (HttpException $exception) {
            $this->assertSame(502, $exception->getStatusCode());
            $this->assertSame('Unable to load Supabase signing keys', $exception->getMessage());
        }
    }

    private function fakeJwks(array $key): void
    {
        Http::preventStrayRequests();
        Http::fake(['https://internal.test/keys' => Http::response(['keys' => [$key]])]);
    }
}
