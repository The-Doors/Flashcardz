<?php

namespace App\Http\Requests;

use App\Models\Deck;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCardRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('card'));
    }

    /** @return array<string, array> */
    public function rules(): array
    {
        return [
            'content' => ['sometimes', 'required', 'string'],
            'deck_id' => ['sometimes', 'required', 'integer', Rule::exists(Deck::class, 'id')->where('user_id', $this->user()?->id)->whereNull('deleted_at')],
        ];
    }
}
