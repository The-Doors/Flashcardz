<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\QueryException;

class SupabaseTokenAuthenticator
{
    public function __construct(private readonly SupabaseJwtVerifier $verifier) {}

    public function authenticate(?string $token): ?User
    {
        if (! is_string($token) || $token === '') {
            return null;
        }

        $claims = $this->verifier->verify($token);

        if ($claims === null) {
            return null;
        }

        if ($user = User::query()->find($claims['sub'])) {
            return $user;
        }

        $metadata = $claims['user_metadata'] ?? null;
        $username = is_array($metadata) ? ($metadata['username'] ?? null) : null;

        if (! is_string($username) || trim($username) === '' || mb_strlen($username) > 29 || mb_strlen(mb_strtolower($username)) > 29) {
            return null;
        }

        try {
            return User::query()->create(['id' => $claims['sub'], 'username' => $username]);
        } catch (QueryException $exception) {
            if ($exception->getCode() === '23503') {
                return null;
            }

            if ($exception->getCode() !== '23505') {
                throw $exception;
            }

            if ($user = User::query()->find($claims['sub'])) {
                return $user;
            }

            abort(409, 'Username is already taken');
        }
    }
}
