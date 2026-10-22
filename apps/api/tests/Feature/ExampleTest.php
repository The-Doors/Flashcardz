<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertSee('The API is running.')->assertDontSee('/build/')->assertDontSee('@vite');
    }

    public function test_renders_html_errors_without_frontend_assets(): void
    {
        $this->get('/missing-page', ['Accept' => 'text/html'])
            ->assertNotFound()->assertHeader('Content-Type', 'text/html; charset=utf-8');
    }

    public function test_health_endpoint_is_available(): void
    {
        $this->get('/up')->assertOk();
    }
}
