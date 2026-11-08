<?php

namespace Tests\Feature;

use App\Services\Quizlet\ImportFromQuizlet;
use App\Services\Quizlet\QuizletImportException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ImportFromQuizletTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['services.zenrows.api_key' => 'test-key']);
        Http::preventStrayRequests();
    }

    #[DataProvider('sources')]
    public function test_accepts_only_set_ids_and_valid_quizlet_https_urls(string|int $source, ?string $expected): void
    {
        $this->assertSame($expected, (new ImportFromQuizlet)->getDeckId($source));
    }

    public static function sources(): array
    {
        return [
            'id' => ['123', '123'], 'integer' => [123, '123'], 'trim' => [' 123 ', '123'],
            'URL' => ['https://quizlet.com/123/biology-flash-cards/', '123'],
            'www' => ['https://www.quizlet.com/123/flashcards', '123'],
            'locale' => ['https://quizlet.com/de/123/flashcards?x=1#test', '123'],
            'region' => ['https://quizlet.com/en-gb/123', '123'],
            'explicit https port' => ['https://quizlet.com:443/123', '123'],
            'zero' => ['0', null], 'negative' => [-1, null], 'leading zero' => ['0123', null],
            'decimal' => ['1.2', null], 'scientific' => ['1e3', null], 'empty' => ['', null],
            'non numeric path' => ['https://quizlet.com/123abc', null],
            'zero URL' => ['https://quizlet.com/0', null],
            'http' => ['http://quizlet.com/123', null],
            'host suffix' => ['https://quizlet.com.example.com/123', null],
            'userinfo' => ['https://quizlet.com@evil.example/123', null],
            'credentials' => ['https://user:pass@quizlet.com/123', null],
            'wrong port' => ['https://quizlet.com:444/123', null],
            'bad port' => ['https://quizlet.com:99999/123', null],
            'missing path' => ['https://quizlet.com', null],
        ];
    }

    public function test_fetches_all_pages_with_zenrows_and_reports_progress(): void
    {
        $fixture = json_decode(file_get_contents(base_path('tests/Fixtures/quizlet-cards.json')), true);
        $items = $fixture['responses'][0]['models']['studiableItem'];
        Http::fake(['https://api.zenrows.com/v1/*' => Http::sequence()
            ->push(file_get_contents(base_path('tests/Fixtures/quizlet-set.json')))
            ->push(self::page([$items[0]], 2, 'next-token'))
            ->push(self::page([$items[1]], 2))]);
        $progress = [];

        $result = (new ImportFromQuizlet)->fetch('123', function (string $stage, array $counts) use (&$progress): void {
            $progress[] = ['stage' => $stage] + $counts;
        });

        $this->assertSame(['name' => 'Biology', 'description' => 'Cell basics', 'cards' => [
            "Cell\n\n<!-- card:back -->\n\nBasic unit of life", "Nucleus\n\n<!-- card:back -->\n\nContains DNA",
        ]], $result);
        $this->assertSame([
            ['stage' => 'fetching_set'],
            ['stage' => 'fetching_cards', 'fetched_cards' => 0, 'total_cards' => null],
            ['stage' => 'fetching_cards', 'fetched_cards' => 1, 'total_cards' => 2],
            ['stage' => 'fetching_cards', 'fetched_cards' => 1, 'total_cards' => 2],
            ['stage' => 'fetching_cards', 'fetched_cards' => 2, 'total_cards' => 2],
        ], $progress);
        Http::assertSentCount(3);
        Http::assertSent(fn (Request $request): bool => $request['apikey'] === 'test-key' && $request['mode'] === 'auto'
            && $request['original_status'] === 'true' && $request['url'] === 'https://quizlet.com/webapi/3.9/sets/123');
        Http::assertSent(function (Request $request): bool {
            parse_str(parse_url($request['url'], PHP_URL_QUERY) ?? '', $params);

            return ($params['page'] ?? null) === '2' && ($params['pagingToken'] ?? null) === 'next-token'
                && ($params['perPage'] ?? null) === '500' && ($params['filters']['studiableContainerId'] ?? null) === '123';
        });
    }

    public function test_missing_api_key_fails_without_an_http_request(): void
    {
        config(['services.zenrows.api_key' => ' ']);

        try {
            (new ImportFromQuizlet)->fetch('123');
            $this->fail('Expected a configuration error.');
        } catch (QuizletImportException $exception) {
            $this->assertSame('quizlet_configuration_error', $exception->errorCode);
        }

        Http::assertNothingSent();
    }

    public function test_connection_failure_is_safe_and_does_not_include_the_api_key(): void
    {
        Http::fake(['https://api.zenrows.com/v1/*' => Http::failedConnection()]);

        try {
            (new ImportFromQuizlet)->fetch('123');
            $this->fail('Expected a request error.');
        } catch (QuizletImportException $exception) {
            $this->assertSame('quizlet_request_failed', $exception->errorCode);
            $this->assertSame('Could not reach Quizlet. Please try again later.', $exception->getMessage());
            $this->assertNull($exception->getPrevious());
        }

        Http::assertSentCount(1);
    }

    #[DataProvider('requestErrors')]
    public function test_maps_upstream_failures_to_safe_error_codes(mixed $body, int $status, string $code): void
    {
        Http::fake(['https://api.zenrows.com/v1/*' => Http::response($body, $status)]);

        try {
            (new ImportFromQuizlet)->fetch('123');
            $this->fail('Expected an import error.');
        } catch (QuizletImportException $exception) {
            $this->assertSame($code, $exception->errorCode);
        }

        Http::assertSentCount(1);
    }

    public static function requestErrors(): array
    {
        return [
            'not found in envelope' => [['responses' => [['error' => ['code' => 404]]]], 200, 'quizlet_not_found'],
            'not found' => ['', 404, 'quizlet_unavailable'],
            'private' => ['', 403, 'quizlet_unavailable'],
            'unauthorized' => ['', 401, 'quizlet_unavailable'],
            'zenrows auth' => [['code' => 'AUTH_001'], 403, 'quizlet_configuration_error'],
            'zenrows error' => [['code' => 'RESP001'], 422, 'quizlet_upstream_error'],
            'rate limit' => [['code' => 'RESP001'], 429, 'quizlet_request_failed'],
            'server error' => ['', 503, 'quizlet_request_failed'],
            'other status' => ['', 418, 'quizlet_upstream_error'],
            'redirect' => ['', 302, 'quizlet_upstream_error'],
            'HTML' => ['<html>challenge</html>', 200, 'invalid_quizlet_data'],
            'wrong schema' => [[], 200, 'invalid_quizlet_data'],
            'blank title' => [['responses' => [['models' => ['set' => [['title' => ' ']]]]]], 200, 'invalid_quizlet_data'],
            'oversized title' => [['responses' => [['models' => ['set' => [['title' => str_repeat('a', 256)]]]]]], 200, 'invalid_quizlet_data'],
            'invalid description' => [['responses' => [['models' => ['set' => [['title' => 'Set', 'description' => []]]]]]], 200, 'invalid_quizlet_data'],
        ];
    }

    #[DataProvider('invalidPages')]
    public function test_rejects_invalid_pagination_and_unsupported_cards(array $pages, string $code): void
    {
        $sequence = Http::sequence()->push(file_get_contents(base_path('tests/Fixtures/quizlet-set.json')));
        foreach ($pages as $page) {
            $sequence->push($page);
        }
        Http::fake(['https://api.zenrows.com/v1/*' => $sequence]);

        try {
            (new ImportFromQuizlet)->fetch('123');
            $this->fail('Expected invalid card data to be rejected.');
        } catch (QuizletImportException $exception) {
            $this->assertSame($code, $exception->errorCode);
        }

        Http::assertSentCount(count($pages) + 1);
    }

    public static function invalidPages(): array
    {
        $item = ['id' => 1, 'cardSides' => [
            ['label' => 'word', 'media' => [['type' => 1, 'plainText' => 'Term']]],
            ['label' => 'definition', 'media' => [['type' => 1, 'plainText' => 'Answer']]],
        ]];

        return [
            'empty set' => [[self::page([], 0)], 'empty_quizlet_set'],
            'missing data' => [[[]], 'invalid_quizlet_data'],
            'not a list' => [[self::page(['wrong' => $item], 1)], 'invalid_quizlet_data'],
            'negative total' => [[self::page([], -1)], 'invalid_quizlet_data'],
            'empty batch' => [[self::page([], 1)], 'invalid_quizlet_data'],
            'count exceeds total' => [[self::page([$item, $item], 1)], 'invalid_quizlet_data'],
            'duplicate ids' => [[self::page([$item, $item], 2)], 'invalid_quizlet_data'],
            'duplicate across pages' => [[self::page([$item], 2, 'next'), self::page([$item], 2)], 'invalid_quizlet_data'],
            'total changes' => [[self::page([$item], 2, 'next'), self::page([$item], 3)], 'invalid_quizlet_data'],
            'missing token' => [[self::page([$item], 2)], 'invalid_quizlet_data'],
            'invalid id' => [[self::page([array_replace($item, ['id' => '1'])], 1)], 'invalid_quizlet_data'],
            'no sides' => [[self::page([['id' => 1]], 1)], 'unsupported_quizlet_cards'],
            'image only' => [[self::page([['id' => 1, 'cardSides' => [['label' => 'word', 'media' => [['type' => 2]]]]]], 1)], 'unsupported_quizlet_cards'],
            'blank text' => [[self::page([['id' => 1, 'cardSides' => [
                ['label' => 'word', 'media' => [['type' => 1, 'plainText' => ' ']]],
                $item['cardSides'][1],
            ]]], 1)], 'unsupported_quizlet_cards'],
        ];
    }

    private static function page(array $items, int $total, ?string $token = null): array
    {
        return ['responses' => [['models' => ['studiableItem' => $items], 'paging' => ['total' => $total, 'token' => $token]]]];
    }
}
