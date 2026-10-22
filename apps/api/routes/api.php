<?php

use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')
    ->group(function () {
        Route::get('/me', UserController::class)->name('user.show')->middleware('auth');
        Route::get('/example-optional-auth', [UserController::class, 'exampleOptionalAuth'])
            ->middleware('optional-auth:api')
            ->name('example.optional.auth');
    });
