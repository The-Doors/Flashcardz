<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    /**
     * Get info about the logged in user.
     */
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    public function exampleOptionalAuth(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            return response()->json(['message' => 'User authenticated']);
        }

        return response()->json(['message' => 'User not authenticated, but still returning this. This is intentional to show off two different things.']);
    }
}
