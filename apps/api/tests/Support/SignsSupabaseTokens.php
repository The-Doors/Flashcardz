<?php

namespace Tests\Support;

trait SignsSupabaseTokens
{
    /**
     * @param  array<string, mixed>  $overrides
     * @param  array<string, mixed>  $headerOverrides
     * @return array{string, array<string, mixed>, array<string, mixed>}
     */
    protected function signedToken(array $overrides = [], array $headerOverrides = []): array
    {
        $privateKey = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        $details = openssl_pkey_get_details($privateKey);
        $claims = array_replace([
            'iss' => 'https://supabase.test/auth/v1',
            'aud' => 'authenticated',
            'sub' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'exp' => now()->addHour()->timestamp,
            'iat' => now()->timestamp,
        ], $overrides);
        $header = array_replace(['alg' => 'ES256', 'kid' => 'test-key'], $headerOverrides);
        $encode = fn (string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
        $message = $encode(json_encode($header, JSON_THROW_ON_ERROR)).'.'.$encode(json_encode($claims, JSON_THROW_ON_ERROR));
        openssl_sign($message, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        $rLength = ord($signature[3]);
        $r = substr($signature, 4, $rLength);
        $sLength = ord($signature[5 + $rLength]);
        $s = substr($signature, 6 + $rLength, $sLength);
        $raw = str_pad(substr($r, -32), 32, "\0", STR_PAD_LEFT).str_pad(substr($s, -32), 32, "\0", STR_PAD_LEFT);

        return [$message.'.'.$encode($raw), $claims, [
            'kid' => $header['kid'],
            'kty' => 'EC',
            'crv' => 'P-256',
            'alg' => 'ES256',
            'use' => 'sig',
            'x' => $encode($details['ec']['x']),
            'y' => $encode($details['ec']['y']),
        ]];
    }
}
