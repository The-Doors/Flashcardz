<?php

namespace App\Providers;

use App\Models\User;
use App\Services\SupabaseTokenAuthenticator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Auth::viaRequest('supabase', fn (Request $request): ?User => app(SupabaseTokenAuthenticator::class)->authenticate($request->bearerToken()));
    }
}
