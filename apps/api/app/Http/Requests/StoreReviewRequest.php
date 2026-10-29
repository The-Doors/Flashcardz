<?php

namespace App\Http\Requests;

use App\Models\Review;
use App\Services\Fsrs\Rating;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('viewAny', Review::class);
    }

    /** @return array<string, array> */
    public function rules(): array
    {
        return [
            'card_id' => ['required', 'integer', 'min:1'],
            'rating' => ['required', 'integer', Rule::enum(Rating::class)],
            'previous_review_id' => ['present', 'nullable', 'integer', 'min:1'],
            'review_duration' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:2147483647'],
            'timezone' => ['sometimes', 'required', 'timezone'],
            'deck_id' => ['sometimes', 'required', 'integer', 'min:1'],
            'date' => ['prohibited'],
            'user_id' => ['prohibited'],
            'review_datetime' => ['prohibited'],
            'last_review' => ['prohibited'],
            'due' => ['prohibited'],
            'state' => ['prohibited'],
            'step' => ['prohibited'],
            'stability' => ['prohibited'],
            'difficulty' => ['prohibited'],
        ];
    }
}
