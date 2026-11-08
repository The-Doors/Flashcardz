<?php

namespace App\Services\Quizlet;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class ImportFromQuizlet
{
    public function getDeckId(string|int $source): ?string
    {
        $source = trim((string) $source);

        if (preg_match('/^[1-9][0-9]*$/D', $source)) {
            return $source;
        }

        $parts = parse_url($source);

        if ($parts === false || ($parts['scheme'] ?? null) !== 'https'
            || ! in_array($parts['host'] ?? null, ['quizlet.com', 'www.quizlet.com'], true)
            || isset($parts['user']) || isset($parts['pass']) || ($parts['port'] ?? 443) !== 443) {
            return null;
        }

        return preg_match('~^/(?:[a-z]{2}(?:-[a-z]{2})?/)?([1-9][0-9]*)(?:/|$)~', $parts['path'] ?? '', $matches)
            ? $matches[1] : null;
    }

    /** @return array{name: string, description: ?string, cards: list<string>} */
    public function fetch(string $source, ?callable $onProgress = null): array
    {
        $id = $this->getDeckId($source) ?? throw new QuizletImportException('invalid_quizlet_source');
        $report = $onProgress ?? static function (string $stage, array $progress): void {};
        $report('fetching_set', []);
        $set = data_get($this->request("/webapi/3.9/sets/{$id}"), 'responses.0.models.set.0');

        if (! is_array($set) || ! is_string($set['title'] ?? null) || trim($set['title']) === ''
            || mb_strlen($set['title']) > 255 || (isset($set['description'])
                && (! is_string($set['description']) || mb_strlen($set['description']) > 1000))) {
            throw new QuizletImportException('invalid_quizlet_data');
        }

        $cards = [];
        $seen = [];
        $total = null;
        $token = null;

        for ($page = 1; ; $page++) {
            $report('fetching_cards', ['fetched_cards' => count($cards), 'total_cards' => $total]);
            $params = ['filters[studiableContainerId]' => $id, 'filters[studiableContainerType]' => 1, 'perPage' => 500, 'page' => $page];

            if ($token !== null) {
                $params['pagingToken'] = $token;
            }

            $response = data_get($this->request('/webapi/3.9/studiable-item-documents', $params), 'responses.0');
            $batch = data_get($response, 'models.studiableItem');
            $nextTotal = data_get($response, 'paging.total');

            if (! is_array($batch) || ! array_is_list($batch) || ! is_int($nextTotal) || $nextTotal < 0
                || ($total !== null && $total !== $nextTotal)) {
                throw new QuizletImportException('invalid_quizlet_data');
            }

            $total = $nextTotal;

            if ($total === 0) {
                throw new QuizletImportException('empty_quizlet_set');
            }

            if ($batch === [] || count($cards) + count($batch) > $total) {
                throw new QuizletImportException('invalid_quizlet_data');
            }

            foreach ($batch as $item) {
                $itemId = data_get($item, 'id');

                if (! is_int($itemId) || isset($seen[$itemId])) {
                    throw new QuizletImportException('invalid_quizlet_data');
                }

                $seen[$itemId] = true;
                $question = $this->sideText(data_get($item, 'cardSides'), 'word');
                $answer = $this->sideText(data_get($item, 'cardSides'), 'definition');

                if ($question === null || $answer === null || trim($question) === '' || trim($answer) === '') {
                    throw new QuizletImportException('unsupported_quizlet_cards');
                }

                $cards[] = $question."\n\n<!-- card:back -->\n\n".$answer;
            }

            $report('fetching_cards', ['fetched_cards' => count($cards), 'total_cards' => $total]);

            if (count($cards) === $total) {
                return ['name' => $set['title'], 'description' => $set['description'] ?? null, 'cards' => $cards];
            }

            $token = data_get($response, 'paging.token');

            if (! is_string($token) || $token === '') {
                throw new QuizletImportException('invalid_quizlet_data');
            }
        }
    }

    private function sideText(mixed $sides, string $label): ?string
    {
        if (! is_array($sides)) {
            return null;
        }

        foreach ($sides as $side) {
            if (data_get($side, 'label') !== $label || ! is_array(data_get($side, 'media'))) {
                continue;
            }

            foreach ($side['media'] as $media) {
                if (data_get($media, 'type') === 1 && is_string(data_get($media, 'plainText'))) {
                    return $media['plainText'];
                }
            }
        }

        return null;
    }

    /**
     * @param  array<string, int|string>  $params
     * @return array<string, mixed>
     */
    private function request(string $path, array $params = []): array
    {
        $key = config('services.zenrows.api_key');

        if (! is_string($key) || trim($key) === '') {
            throw new QuizletImportException('quizlet_configuration_error');
        }

        $url = 'https://quizlet.com'.$path.($params === [] ? '' : '?'.http_build_query($params));

        try {
            $response = Http::connectTimeout(5)->timeout(180)->withoutRedirecting()->get('https://api.zenrows.com/v1/', [
                'apikey' => $key, 'url' => $url, 'mode' => 'auto', 'original_status' => 'true',
            ]);
        } catch (ConnectionException) {
            throw new QuizletImportException('quizlet_request_failed');
        }

        $body = $response->json();

        if ($response->status() === 200) {
            if (data_get($body, 'responses.0.error.code') === 404) {
                throw new QuizletImportException('quizlet_not_found');
            }

            if (! is_array($body)) {
                throw new QuizletImportException('invalid_quizlet_data');
            }

            return $body;
        }

        $code = data_get($body, 'code');

        throw new QuizletImportException(match (true) {
            is_string($code) && str_starts_with($code, 'AUTH_') => 'quizlet_configuration_error',
            $response->status() === 429 || $response->serverError() => 'quizlet_request_failed',
            is_string($code) => 'quizlet_upstream_error',
            in_array($response->status(), [401, 403, 404], true) => 'quizlet_unavailable',
            default => 'quizlet_upstream_error',
        });
    }
}
