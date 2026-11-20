<?php

namespace App\Http\Controllers;

use App\Models\Deck;
use App\Models\StudyGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class StudyGroupDeckController extends Controller
{
    /**
     * Share a set with the group so every member can study it.
     */
    public function store(Request $request, StudyGroup $studyGroup): JsonResponse
    {
        Gate::authorize('view', $studyGroup);
        $request->validate(['deck_id' => ['required', 'integer', 'min:1']]);
        $deck = Deck::findOrFail($request->integer('deck_id'));
        Gate::authorize('addDeck', [$studyGroup, $deck]);

        if ($studyGroup->decks()->whereKey($deck->id)->exists()) {
            throw ValidationException::withMessages(['deck_id' => 'This set is already shared with the group.']);
        }

        $studyGroup->decks()->attach($deck, ['added_by_id' => $request->user()->id]);

        return response()->json($deck->load('user:id,username')->loadCount('cards'), 201);
    }

    public function destroy(StudyGroup $studyGroup, int $deck): Response
    {
        $sharedDeck = $studyGroup->decks()->withTrashed()->findOrFail($deck);
        Gate::authorize('removeDeck', [$studyGroup, $sharedDeck]);
        $studyGroup->decks()->detach($sharedDeck);

        return response()->noContent();
    }
}
