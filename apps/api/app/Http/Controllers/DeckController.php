<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDeckRequest;
use App\Http\Requests\UpdateDeckRequest;
use App\Models\Deck;
use App\Models\Review;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class DeckController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Deck::class);
        $validated = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'mine' => ['sometimes', 'accepted'],
        ]);
        $search = addcslashes((string) ($validated['search'] ?? ''), '\\%_');

        return response()->json(Deck::visibleTo($request->user())
            ->select('app.decks.*')
            ->when($request->has('mine'), fn (Builder $query) => $query
                ->where('user_id', $request->user()?->id)
                ->addSelect(['last_studied_at' => Review::query()
                    ->selectRaw('max(app.reviews.review_datetime)')
                    ->join('app.cards as studied_cards', 'studied_cards.id', '=', 'app.reviews.card_id')
                    ->whereColumn('studied_cards.deck_id', 'app.decks.id')])
                ->withCasts(['last_studied_at' => 'immutable_datetime'])
                ->orderByRaw('last_studied_at DESC NULLS LAST'))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('name', "%{$search}%")
                ->orWhereLike('description', "%{$search}%")))
            ->withCount('cards')->orderByDesc('id')->paginate(25)->withQueryString());
    }

    /**
     * List public sets that have cards, with their author and how many people have studied them.
     */
    public function community(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Deck::class);
        $validated = $request->validate([
            'sort' => ['sometimes', Rule::in(['popular', 'newest', 'cards'])],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        $sort = $validated['sort'] ?? 'popular';

        return response()->json(Deck::query()
            ->select('app.decks.*')
            ->addSelect(['learners_count' => Review::query()
                ->selectRaw('count(DISTINCT app.reviews.user_id)')
                ->join('app.cards as studied_cards', 'studied_cards.id', '=', 'app.reviews.card_id')
                ->join('app.decks as studied_decks', 'studied_decks.id', '=', 'studied_cards.deck_id')
                ->where(fn (Builder $query) => $query
                    ->whereColumn('studied_decks.id', 'app.decks.id')
                    ->orWhereColumn('studied_decks.source_deck_id', 'app.decks.id'))])
            ->where('is_public', true)
            ->has('cards')
            ->with('user:id,username')
            ->withCount('cards')
            ->when($sort === 'popular', fn (Builder $query) => $query->orderByDesc('learners_count'))
            ->when($sort === 'cards', fn (Builder $query) => $query->orderByDesc('cards_count'))
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString());
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
