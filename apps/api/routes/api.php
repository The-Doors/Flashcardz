<?php

use App\Http\Controllers\CardController;
use App\Http\Controllers\DeckController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')
    ->group(function () {
        Route::get('/me', UserController::class)->name('user.show')->middleware('auth');
        Route::get('/example-optional-auth', [UserController::class, 'exampleOptionalAuth'])
            ->middleware('optional-auth:api')
            ->name('example.optional.auth');
    });

Route::middleware('optional-auth:api')->group(function (): void {
    Route::apiResource('decks', DeckController::class)->only(['index', 'show']);
    Route::apiResource('cards', CardController::class)->only(['index', 'show']);
});

Route::middleware('auth')->group(function (): void {
    Route::apiResource('decks', DeckController::class)->only(['store', 'update', 'destroy']);
    Route::apiResource('cards', CardController::class)->only(['store', 'update', 'destroy']);
    Route::post('decks/{deck}/copy', [DeckController::class, 'copy'])->name('decks.copy');
    Route::post('cards/{card}/copy', [CardController::class, 'copy'])->name('cards.copy');
});
