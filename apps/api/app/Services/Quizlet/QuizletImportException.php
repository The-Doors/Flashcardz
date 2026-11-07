<?php

namespace App\Services\Quizlet;

use RuntimeException;

class QuizletImportException extends RuntimeException
{
    public function __construct(public readonly string $errorCode)
    {
        parent::__construct(match ($errorCode) {
            'invalid_quizlet_source' => 'Enter a valid Quizlet set ID or HTTPS set URL.',
            'quizlet_configuration_error' => 'The Quizlet import service is not configured correctly.',
            'quizlet_not_found' => 'The Quizlet set could not be found.',
            'quizlet_unavailable' => 'The Quizlet set is private or unavailable.',
            'empty_quizlet_set' => 'The Quizlet set contains no cards.',
            'unsupported_quizlet_cards' => 'Only Quizlet cards with text on both sides can be imported.',
            'invalid_quizlet_data' => 'Quizlet returned incomplete or invalid set data.',
            'quizlet_request_failed' => 'Could not reach Quizlet. Please try again later.',
            default => 'Quizlet could not complete the request. Please try again later.',
        });
    }
}
