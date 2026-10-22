<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

#[Fillable(['id', 'username'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory;

    protected $table = 'app.users';

    protected $keyType = 'string';

    protected $hidden = ['username_lowercase'];

    public $incrementing = false;

    /** @return Attribute<string, string> */
    protected function username(): Attribute
    {
        return Attribute::make(set: fn (string $value): array => [
            'username' => $value,
            'username_lowercase' => mb_strtolower($value),
        ]);
    }
}
