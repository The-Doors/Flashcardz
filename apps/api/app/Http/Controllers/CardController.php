<?php

namespace App\Http\Controllers;

use App\Http\Requests\CopyCardRequest;
use App\Http\Requests\StoreCardRequest;
use App\Http\Requests\UpdateCardRequest;
use App\Models\Card;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class CardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Card::class);
        $request->validate(['deck_id' => ['sometimes', 'required', 'integer']]);

        return response()->json(Card::whereHas('deck', fn (Builder $query) => $query->visibleTo($request->user()))
            ->when($request->has('deck_id'), fn (Builder $query) => $query->where('deck_id', $request->integer('deck_id')))
            ->orderByDesc('id')->paginate(25));
    }

    public function store(StoreCardRequest $request): JsonResponse
    {
        $card = new Card($request->validated());
        $card->creator()->associate($request->user());
        $card->save();

        return response()->json($card->refresh(), 201);
    }

    public function show(Card $card): JsonResponse
    {
        Gate::authorize('view', $card);

        return response()->json($card->withoutRelations());
    }

    public function update(UpdateCardRequest $request, Card $card): JsonResponse
    {
        $card->update($request->validated());

        return response()->json($card->withoutRelations());
    }

    public function destroy(Card $card): Response
    {
        Gate::authorize('delete', $card);
        $card->delete();

        return response()->noContent();
    }

    public function copy(CopyCardRequest $request, Card $card): JsonResponse
    {
        $copy = new Card(['deck_id' => $request->integer('deck_id'), 'content' => $card->content]);
        $copy->creator_id = $card->creator_id;
        $copy->sourceCard()->associate($card);
        $copy->save();

        return response()->json($copy->refresh(), 201);
    }
}
