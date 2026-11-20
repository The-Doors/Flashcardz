<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class StoreStudyGroupInvitationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::authorize('invite', $this->route('study_group'))->allowed();
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'username' => ['required', 'string', 'max:29'],
        ];
    }
}
