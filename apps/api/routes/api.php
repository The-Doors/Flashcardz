<?php

use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/user', UserController::class)->middleware('auth')->name('user.show');
