<?php

namespace App\Http\Requests;

use App\Models\Card;
use App\Models\Deck;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCardRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Card::class);
    }

    /** @return array<string, array> */
    public function rules(): array
    {
        return [
            'content' => ['required', 'string', 'max:10000'],
            'deck_id' => ['required', 'integer', Rule::exists(Deck::class, 'id')->where('user_id', $this->user()?->id)->whereNull('deleted_at')],
        ];
    }
}
