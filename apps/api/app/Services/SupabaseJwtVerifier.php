<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use JsonException;
use Psr\SimpleCache\InvalidArgumentException;

class SupabaseJwtVerifier
{
    private const string JWKS_CACHE_KEY = 'supabase:jwks';

    private const string JWKS_REFRESH_CACHE_KEY = 'supabase:jwks:unknown-kid-refresh';

    /**
     * @return array<string, mixed>|null
     *
     * @throws InvalidArgumentException
     */
    public function verify(string $token): ?array
    {
        $segments = explode('.', $token);

        if (count($segments) !== 3) {
            return null;
        }

        [$encodedHeader, $encodedClaims, $encodedSignature] = $segments;
        $header = $this->decodeJsonSegment($encodedHeader);
        $claims = $this->decodeJsonSegment($encodedClaims);
        $signature = $this->decodeBase64Url($encodedSignature);

        if ($header === null || $claims === null || $signature === null || ($header['alg'] ?? null) !== 'ES256') {
            return null;
        }

        $kid = $header['kid'] ?? null;

        if (! is_string($kid) || $kid === '' || ! $this->hasValidClaims($claims)) {
            return null;
        }

        $key = $this->keyFor($kid);

        if ($key === null || ! $this->hasValidSignature($encodedHeader.'.'.$encodedClaims, $signature, $key)) {
            return null;
        }

        return $claims;
    }

    /** @return array<string, mixed>|null */
    private function decodeJsonSegment(string $segment): ?array
    {
        $decoded = $this->decodeBase64Url($segment);

        if ($decoded === null) {
            return null;
        }

        try {
            $value = json_decode($decoded, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        return is_array($value) ? $value : null;
    }

    private function decodeBase64Url(string $value): ?string
    {
        if ($value === '' || preg_match('/^[A-Za-z0-9_-]+$/D', $value) !== 1) {
            return null;
        }

        $decoded = base64_decode(strtr($value, '-_', '+/').str_repeat('=', (4 - strlen($value) % 4) % 4), true);

        return is_string($decoded) ? $decoded : null;
    }

    /** @return array<string, mixed>|null
     * @throws InvalidArgumentException
     */
    private function keyFor(string $kid): ?array
    {
        $cache = Cache::store(config('services.supabase.jwks_cache_store', 'file'));
        $cacheKey = self::JWKS_CACHE_KEY.':'.sha1(config('services.supabase.url').'|'.config('services.supabase.jwks_url'));
        $refreshCacheKey = self::JWKS_REFRESH_CACHE_KEY.':'.sha1(config('services.supabase.url').'|'.config('services.supabase.jwks_url'));
        $jwks = $cache->get($cacheKey);
        $fetched = false;

        if (! is_array($jwks) || ! is_array($jwks['keys'] ?? null)) {
            $jwks = $this->fetchJwks();
            $cache->put($cacheKey, $jwks, now()->addMinutes(10));
            $fetched = true;
        }

        $key = $this->findKey($jwks, $kid);

        if ($key !== null) {
            return $key;
        }

        if (! $fetched && $cache->add($refreshCacheKey, true, now()->addMinute())) {
            $jwks = $this->fetchJwks();
            $cache->put($cacheKey, $jwks, now()->addMinutes(10));

            return $this->findKey($jwks, $kid);
        }

        return null;
    }

    /** @return array<string, mixed> */
    private function fetchJwks(): array
    {
        $url = config('services.supabase.jwks_url') ?: rtrim((string) config('services.supabase.url'), '/').'/auth/v1/.well-known/jwks.json';

        if (! config('services.supabase.url') || ! is_string($url) || $url === '') {
            abort(503, 'Supabase Auth is not configured');
        }

        try {
            $response = Http::acceptJson()->connectTimeout(3)->timeout(10)->get($url);
        } catch (ConnectionException) {
            abort(502, 'Unable to reach Supabase Auth');
        }

        $jwks = $response->json();

        if (! $response->successful() || ! is_array($jwks) || ! is_array($jwks['keys'] ?? null)) {
            abort(502, 'Unable to load Supabase signing keys');
        }

        return $jwks;
    }

    /** @param array<string, mixed> $jwks
     * @return array<string, mixed>|null
     */
    private function findKey(array $jwks, string $kid): ?array
    {
        foreach ($jwks['keys'] as $key) {
            if (is_array($key)
                && ($key['kid'] ?? null) === $kid
                && ($key['kty'] ?? null) === 'EC'
                && ($key['crv'] ?? null) === 'P-256'
                && (! isset($key['alg']) || $key['alg'] === 'ES256')
                && (! isset($key['use']) || $key['use'] === 'sig')
                && (! isset($key['key_ops']) || (is_array($key['key_ops']) && in_array('verify', $key['key_ops'], true)))) {
                return $key;
            }
        }

        return null;
    }

    /** @param array<string, mixed> $key */
    private function hasValidSignature(string $message, string $signature, array $key): bool
    {
        $x = $this->decodeBase64Url(is_string($key['x'] ?? null) ? $key['x'] : '');
        $y = $this->decodeBase64Url(is_string($key['y'] ?? null) ? $key['y'] : '');

        if (strlen($signature) !== 64 || strlen((string) $x) !== 32 || strlen((string) $y) !== 32) {
            return false;
        }

        $publicKey = "\x30\x59\x30\x13\x06\x07\x2A\x86\x48\xCE\x3D\x02\x01\x06\x08\x2A\x86\x48\xCE\x3D\x03\x01\x07\x03\x42\x00\x04".$x.$y;
        $pem = "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($publicKey), 64, "\n")."-----END PUBLIC KEY-----\n";
        $keyResource = openssl_pkey_get_public($pem);

        return $keyResource !== false && openssl_verify($message, $this->signatureToDer($signature), $keyResource, OPENSSL_ALGO_SHA256) === 1;
    }

    private function signatureToDer(string $signature): string
    {
        $r = ltrim(substr($signature, 0, 32), "\x00");
        $s = ltrim(substr($signature, 32, 32), "\x00");

        if ($r === '' || $s === '') {
            return '';
        }

        $r = (ord($r[0]) & 0x80) ? "\x00".$r : $r;
        $s = (ord($s[0]) & 0x80) ? "\x00".$s : $s;
        $r = "\x02".chr(strlen($r)).$r;
        $s = "\x02".chr(strlen($s)).$s;
        $sequence = $r.$s;

        return "\x30".chr(strlen($sequence)).$sequence;
    }

    /** @param array<string, mixed> $claims */
    private function hasValidClaims(array $claims): bool
    {
        $url = config('services.supabase.url');
        $audience = $claims['aud'] ?? null;
        $audienceIsValid = $audience === 'authenticated' || (is_array($audience) && in_array('authenticated', $audience, true));
        $now = now()->timestamp;

        return is_string($url)
            && ($claims['iss'] ?? null) === rtrim($url, '/').'/auth/v1'
            && $audienceIsValid
            && is_int($claims['exp'] ?? null)
            && $claims['exp'] > $now
            && (! isset($claims['nbf']) || (is_int($claims['nbf']) && $claims['nbf'] <= $now))
            && (! isset($claims['iat']) || (is_int($claims['iat']) && $claims['iat'] <= $now))
            && is_string($claims['sub'] ?? null)
            && Str::isUuid($claims['sub']);
    }
}
