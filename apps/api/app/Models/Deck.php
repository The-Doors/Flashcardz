<?php

namespace App\Models;

use Database\Factories\DeckFactory;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Query\Builder as QueryBuilder;

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
            ->when($user, fn (Builder $query) => $query->orWhere(fn (Builder $query) => $query->studiableBy($user))));
    }

    /**
     * Limit to decks the user owns or that are shared with a study group they belong to.
     */
    #[Scope]
    protected function studiableBy(Builder $query, User $user): void
    {
        $query->where(fn (Builder $query) => $query->where('app.decks.user_id', $user->id)
            ->orWhereExists(fn (QueryBuilder $query) => $query->selectRaw('1')
                ->from('app.study_group_decks')
                ->join('app.study_group_members', 'app.study_group_members.study_group_id', '=', 'app.study_group_decks.study_group_id')
                ->whereColumn('app.study_group_decks.deck_id', 'app.decks.id')
                ->where('app.study_group_members.user_id', $user->id)));
    }

    public function isStudiableBy(User $user): bool
    {
        return $this->user_id === $user->id || self::whereKey($this->id)->studiableBy($user)->exists();
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

    public function studyGroups(): BelongsToMany
    {
        return $this->belongsToMany(StudyGroup::class, 'app.study_group_decks')->withPivot('added_by_id')->withTimestamps();
    }
}
