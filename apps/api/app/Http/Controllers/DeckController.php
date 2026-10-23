<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDeckRequest;
use App\Http\Requests\UpdateDeckRequest;
use App\Models\Deck;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class DeckController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Deck::class);

        return response()->json(Deck::visibleTo($request->user())->withCount('cards')->orderByDesc('id')->paginate(25));
    }

    public function store(StoreDeckRequest $request): JsonResponse
    {
        $deck = $request->user()->decks()->create($request->validated());

        return response()->json($deck->refresh(), 201);
    }

    public function show(Deck $deck): JsonResponse
    {
        Gate::authorize('view', $deck);

        return response()->json($deck->loadCount('cards'));
    }

    public function update(UpdateDeckRequest $request, Deck $deck): JsonResponse
    {
        $deck->update($request->validated());

        return response()->json($deck);
    }

    public function destroy(Deck $deck): Response
    {
        Gate::authorize('delete', $deck);
        DB::transaction(function () use ($deck): void {
            $deck->cards()->delete();
            $deck->delete();
        });

        return response()->noContent();
    }

    public function copy(Request $request, Deck $deck): JsonResponse
    {
        Gate::authorize('copy', $deck);
        $copy = DB::transaction(function () use ($request, $deck): Deck {
            $copy = $request->user()->decks()->make([
                'name' => $deck->name,
                'description' => $deck->description,
                'is_public' => false,
            ]);
            $copy->sourceDeck()->associate($deck);
            $copy->save();

            foreach ($deck->cards()->lazyById() as $card) {
                $copiedCard = $copy->cards()->make(['content' => $card->content]);
                $copiedCard->creator_id = $card->creator_id;
                $copiedCard->sourceCard()->associate($card);
                $copiedCard->save();
            }

            return $copy;
        });

        return response()->json($copy->refresh()->loadCount('cards'), 201);
    }
}
