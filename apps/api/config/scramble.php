<?php

use App\Http\Middleware\OptionalAuthSecurityStrategy;

return [
    'security_strategy' => OptionalAuthSecurityStrategy::class,
];
