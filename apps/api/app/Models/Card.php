<?php

namespace App\Models;

use Database\Factories\CardFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Card extends Model
{
    /** @use HasFactory<CardFactory> */
    use HasFactory;

    use SoftDeletes;

    protected $table = 'app.cards';

    protected $fillable = [
        'content',
        'deck_id',
    ];

    protected $hidden = [
        'deleted_at',
    ];

    public function deck(): BelongsTo
    {
        return $this->belongsTo(Deck::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function sourceCard(): BelongsTo
    {
        return $this->belongsTo(self::class, 'source_card_id');
    }
}
