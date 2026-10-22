<?php

namespace Tests\Support;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

abstract class PostgresTestCase extends TestCase
{
    protected function resetDatabase(bool $migrate = true): void
    {
        if (! getenv('TEST_DB_HOST')) {
            $this->markTestSkipped('Set TEST_DB_HOST for a disposable PostgreSQL database named testing on TEST_DB_PORT (default 55432).');
        }

        config(['database.connections.pgsql_testing' => [
            'driver' => 'pgsql',
            'host' => getenv('TEST_DB_HOST'),
            'port' => getenv('TEST_DB_PORT') ?: 55432,
            'database' => 'testing',
            'username' => 'postgres',
            'password' => 'testing',
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'public',
            'sslmode' => 'prefer',
        ]]);
        DB::setDefaultConnection('pgsql_testing');
        DB::purge('pgsql_testing');
        DB::unprepared('DROP SCHEMA IF EXISTS app CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);');

        if ($migrate) {
            $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
        }
    }
}
