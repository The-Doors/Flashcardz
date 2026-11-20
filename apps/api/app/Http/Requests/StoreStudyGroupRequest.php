<?php

namespace App\Http\Requests;

use App\Models\StudyGroup;
use Illuminate\Foundation\Http\FormRequest;

class StoreStudyGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', StudyGroup::class);
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
