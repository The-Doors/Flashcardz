<?php

namespace App\Http\Middleware;

use Dedoc\Scramble\Configuration\OperationTransformers;
use Dedoc\Scramble\Configuration\SecurityDocumentationContext;
use Dedoc\Scramble\Contracts\SecurityDocumentationStrategy;
use Dedoc\Scramble\GeneratorConfig;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\Operation;
use Dedoc\Scramble\Support\Generator\SecurityRequirement;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Dedoc\Scramble\Support\RouteInfo;
use Illuminate\Routing\Route;
use Illuminate\Support\Str;

class OptionalAuthSecurityStrategy implements SecurityDocumentationStrategy
{
    public function configure(SecurityDocumentationContext $context): GeneratorConfig
    {
        $hasAuthRoutes = $context->routes->contains(fn (Route $route): bool => $this->hasRequiredAuth($route) || $this->hasOptionalAuth($route));

        if (! $hasAuthRoutes) {
            return $context->config;
        }

        return $context->config
            ->withDocumentTransformers(function (OpenApi $openApi): void {
                $openApi->secure(SecurityScheme::http('bearer'));
            })
            ->withOperationTransformers(function (OperationTransformers $transformers): void {
                $transformers->prepend(function (Operation $operation, RouteInfo $routeInfo): void {
                    if ($this->hasOptionalAuth($routeInfo->route)) {
                        $operation->security = [
                            new SecurityRequirement([]),
                            new SecurityRequirement(['http' => []]),
                        ];

                        return;
                    }

                    if (! $this->hasRequiredAuth($routeInfo->route)) {
                        $operation->security = [];
                    }
                });
            });
    }

    private function hasRequiredAuth(Route $route): bool
    {
        return $this->hasMiddleware($route, ['auth', 'auth:*']);
    }

    private function hasOptionalAuth(Route $route): bool
    {
        return $this->hasMiddleware($route, ['optional-auth', 'optional-auth:*']);
    }

    private function hasMiddleware(Route $route, array $patterns): bool
    {
        return collect($route->gatherMiddleware())->contains(fn (string $middleware): bool => Str::is($patterns, $middleware));
    }
}
