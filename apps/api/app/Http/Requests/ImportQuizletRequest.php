<?php

namespace App\Http\Requests;

use App\Models\Deck;
use App\Services\Quizlet\ImportFromQuizlet;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class ImportQuizletRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Deck::class);
    }

    /** @return array<string, list<mixed>> */
    public function rules(ImportFromQuizlet $quizlet): array
    {
        return ['source' => ['bail', 'required', function (string $attribute, mixed $value, Closure $fail) use ($quizlet): void {
            if ((! is_string($value) && ! is_int($value)) || mb_strlen((string) $value) > 2048 || $quizlet->getDeckId($value) === null) {
                $fail('Enter a valid Quizlet set ID or HTTPS set URL.');
            }
        }]];
    }
}
