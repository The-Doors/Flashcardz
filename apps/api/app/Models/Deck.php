<?php

namespace App\Models;

use Database\Factories\DeckFactory;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Deck extends Model
{
    /** @use HasFactory<DeckFactory> */
    use HasFactory;

    use SoftDeletes;

    protected $table = 'app.decks';

    protected $fillable = [
        'name',
        'description',
        'is_public',
    ];

    protected $hidden = [
        'deleted_at',
    ];

    protected function casts(): array
    {
        return ['is_public' => 'boolean'];
    }

    #[Scope]
    protected function visibleTo(Builder $query, ?User $user): void
    {
        $query->where(fn (Builder $query) => $query->where('is_public', true)
            ->when($user, fn (Builder $query) => $query->orWhere('user_id', $user->id)));
    }

    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sourceDeck(): BelongsTo
    {
        return $this->belongsTo(self::class, 'source_deck_id');
    }
}
