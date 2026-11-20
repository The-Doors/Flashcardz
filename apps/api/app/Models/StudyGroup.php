<?php

namespace App\Models;

use Database\Factories\StudyGroupFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudyGroup extends Model
{
    /** @use HasFactory<StudyGroupFactory> */
    use HasFactory;

    protected $table = 'app.study_groups';

    protected $fillable = [
        'name',
        'description',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'app.study_group_members')->withTimestamps();
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(StudyGroupInvitation::class);
    }

    public function decks(): BelongsToMany
    {
        return $this->belongsToMany(Deck::class, 'app.study_group_decks')->withPivot('added_by_id')->withTimestamps();
    }

    public function isOwnedBy(User $user): bool
    {
        return $this->owner_id === $user->id;
    }

    public function hasMember(User $user): bool
    {
        return $this->members()->whereKey($user->id)->exists();
    }
}
