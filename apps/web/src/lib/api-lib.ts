import type {
	ActivityData,
	CommunitySet,
	CommunitySort,
	FlashcardSet,
} from "../components/types";
import {
	type Card,
	type CardsIndexParams,
	cardsDestroy,
	cardsIndex,
	cardsStore,
	cardsUpdate,
	type Deck,
	decksCommunity,
	decksCopy,
	decksDestroy,
	decksIndex,
	decksShow,
	decksStore,
	decksUpdate,
	type Rating,
	reviewsActivity,
	reviewsIndex,
	reviewsStore,
	userShow,
} from "./generated/api-generated.ts";
import { supabase } from "./supabase";

/** Must match the separator the API uses for imported and seeded cards. */
const CARD_SIDE_SEPARATOR = "\n\n<!-- card:back -->\n\n";
const MAX_CARD_CONTENT_LENGTH = 10000;

export type NewFlashcardSet = {
	name: string;
	description: string;
	isPublic: boolean;
	/** `id` is set on cards that already exist on the server. */
	cards: { id?: number; front: string; back: string }[];
};

export type CardSides = { id: number; front: string; back: string };

export type SetDetails = {
	id: number;
	ownerId: string;
	name: string;
	description: string | null;
	isPublic: boolean;
	cards: CardSides[];
};

export type StudyCard = CardSides & { latestReviewId: number | null };

/** `card` is null when nothing can be studied right now; `ready` counts cards studyable now. */
export type StudyQueue = {
	remaining: number;
	ready: number;
	card: StudyCard | null;
};

async function getSession() {
	return supabase ? (await supabase.auth.getSession()).data.session : null;
}

async function optionalAuthRequest() {
	const session = await getSession();
	const headers: Record<string, string> = { Accept: "application/json" };
	if (session) headers.Authorization = `Bearer ${session.access_token}`;
	return { headers };
}

async function authorizedRequest() {
	const session = await getSession();
	if (!session) throw new Error("Sign in to continue.");
	return optionalAuthRequest();
}

function parseCard(id: number, content: string): CardSides {
	const separatorAt = content.indexOf(CARD_SIDE_SEPARATOR);
	if (separatorAt === -1) return { id, front: content, back: "" };
	return {
		id,
		front: content.slice(0, separatorAt),
		back: content.slice(separatorAt + CARD_SIDE_SEPARATOR.length),
	};
}

/** Returns null when the set doesn't exist or this user can't see it. */
export async function loadSet(setId: number): Promise<SetDetails | null> {
	const request = await optionalAuthRequest();
	const deck = await decksShow(setId, request);
	if (Number(deck.status) === 404) return null;
	if (deck.status !== 200) throw new Error("Could not load this set.");

	const cards: Card[] = [];
	for (let page = 1, lastPage = 1; page <= lastPage; page++) {
		const response = await cardsIndex(
			{ deck_id: setId, page } as CardsIndexParams,
			request,
		);
		if (response.status !== 200) throw new Error("Could not load this set.");
		// The generated paginator type doesn't describe its items.
		const result = response.data as unknown as {
			data: Card[];
			last_page: number;
		};
		cards.push(...result.data);
		lastPage = result.last_page;
	}

	return {
		id: deck.data.id,
		ownerId: deck.data.user_id,
		name: deck.data.name,
		description: deck.data.description,
		isPublic: deck.data.is_public,
		cards: cards
			.sort((a, b) => a.id - b.id)
			.map((card) => parseCard(card.id, card.content)),
	};
}

/** Legacy names browsers still report, mapped to the current names the API accepts. */
const TIMEZONE_ALIASES: Record<string, string> = {
	"America/Buenos_Aires": "America/Argentina/Buenos_Aires",
	"Asia/Calcutta": "Asia/Kolkata",
	"Asia/Katmandu": "Asia/Kathmandu",
	"Asia/Rangoon": "Asia/Yangon",
	"Asia/Saigon": "Asia/Ho_Chi_Minh",
	"Europe/Kiev": "Europe/Kyiv",
};

function browserTimezone() {
	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	return TIMEZONE_ALIASES[timezone] ?? timezone;
}

/** Any other name the API rejects is dropped, and the API uses UTC days instead. */
let timezoneRejected = false;
const studyTimezone = () => (timezoneRejected ? undefined : browserTimezone());

async function withTimezoneFallback<T extends { status: number }>(
	send: (timezone?: string) => Promise<T>,
) {
	const timezone = studyTimezone();
	const response = await send(timezone);
	if (response.status !== 422 || !timezone) return response;
	timezoneRejected = true;
	return send();
}

export const STUDY_ACTIVITY_QUERY_KEY = "study-activity";

export async function loadStudyActivity(): Promise<ActivityData> {
	const request = await authorizedRequest();
	const response = await withTimezoneFallback((timezone) =>
		reviewsActivity({ timezone }, request),
	);
	if (response.status !== 200)
		throw new Error("Could not load your study activity.");
	return Object.fromEntries(
		response.data.data.map((day) => [day.date, day.cards]),
	);
}

/** The API orders the queue, so the first reviewable card is the next one to study. */
export async function loadStudyQueue(setId: number): Promise<StudyQueue> {
	const request = await authorizedRequest();
	const response = await withTimezoneFallback((timezone) =>
		reviewsIndex({ deck_id: setId, timezone }, request),
	);
	if (response.status !== 200) throw new Error("Could not load your cards.");

	const page = response.data as unknown as {
		total: number;
		data: (Card & { can_review: boolean; latest_review_id: number | null })[];
	};
	const next = page.data.find((card) => card.can_review);
	return {
		remaining: page.total,
		ready: page.total - page.data.filter((card) => !card.can_review).length,
		card: next
			? {
					...parseCard(next.id, next.content),
					latestReviewId: next.latest_review_id,
				}
			: null,
	};
}

export async function reviewCard(
	setId: number,
	card: StudyCard,
	rating: Rating,
	durationMs: number,
) {
	const response = await reviewsStore(
		{
			card_id: card.id,
			deck_id: setId,
			rating,
			previous_review_id: card.latestReviewId,
			review_duration: durationMs,
			timezone: studyTimezone(),
		},
		await authorizedRequest(),
	);
	if (response.status !== 201)
		throw new Error("Could not save that answer. Your cards were refreshed.");
}

// The generated paginator type doesn't describe its items.
type DeckPage = {
	total: number;
	data: (Deck & {
		cards_count: number;
		updated_at: string;
		last_studied_at?: string | null;
	})[];
};

function toFlashcardSet(deck: DeckPage["data"][number]): FlashcardSet {
	return {
		id: deck.id,
		name: deck.name,
		cardCount: deck.cards_count,
		lastWorkedOn: deck.last_studied_at ?? deck.updated_at,
		lastStudiedAt: deck.last_studied_at,
	};
}

export type CommunityPage = {
	page: number;
	lastPage: number;
	sets: CommunitySet[];
};

export async function loadCommunitySets(
	sort: CommunitySort,
	page: number,
): Promise<CommunityPage> {
	const response = await decksCommunity(
		{ sort, page },
		{ headers: { Accept: "application/json" } },
	);
	if (response.status !== 200)
		throw new Error("Could not load community sets.");

	const result = response.data as unknown as {
		current_page: number;
		last_page: number;
		data: (Deck & {
			cards_count: number;
			learners_count: number;
			user: { username: string };
		})[];
	};
	return {
		page: result.current_page,
		lastPage: result.last_page,
		sets: result.data.map((deck) => ({
			id: deck.id,
			name: deck.name,
			description: deck.description ?? undefined,
			cardCount: deck.cards_count,
			studyCount: deck.learners_count,
			author: deck.user.username,
		})),
	};
}

/** Copies a set into the user's own private sets and returns the new set's id. */
export async function copySet(setId: number) {
	const response = await decksCopy(setId, await authorizedRequest());
	if (response.status !== 201) throw new Error("Could not copy this set.");
	return response.data.id;
}

export async function listMySets(): Promise<FlashcardSet[]> {
	const response = await decksIndex(
		{ mine: "true" },
		await authorizedRequest(),
	);
	if (response.status !== 200) throw new Error("Could not load your sets.");

	const page = response.data as unknown as DeckPage;
	return page.data.map(toFlashcardSet);
}

/** Searches every set this user can see: their own and public ones. */
export async function searchSets(search: string) {
	const response = await decksIndex({ search }, await optionalAuthRequest());
	if (response.status !== 200) throw new Error("Could not search sets.");

	const page = response.data as unknown as DeckPage;
	return { total: page.total, sets: page.data.map(toFlashcardSet) };
}

function cardContent({ front, back }: { front: string; back: string }) {
	return `${front}${CARD_SIDE_SEPARATOR}${back}`;
}

export function isCardTooLong(card: { front: string; back: string }) {
	return cardContent(card).length > MAX_CARD_CONTENT_LENGTH;
}

function throwUnlessStatus(
	response: { status: number; data: unknown },
	expectedStatus: number,
	fallbackMessage: string,
) {
	if (response.status === expectedStatus) return;
	throw new Error(
		response.status === 422
			? (response.data as { message: string }).message
			: fallbackMessage,
	);
}

/** Cards are saved one at a time to keep their order; a failure removes the partial deck. */
export async function saveSet({
	name,
	description,
	isPublic,
	cards,
}: NewFlashcardSet) {
	const request = await authorizedRequest();

	const deck = await decksStore(
		{ name, description: description || null, is_public: isPublic },
		request,
	);
	if (deck.status !== 201) {
		throwUnlessStatus(deck, 201, "Could not save your set.");
		return;
	}

	try {
		for (const card of cards) {
			const response = await cardsStore(
				{ deck_id: deck.data.id, content: cardContent(card) },
				request,
			);
			throwUnlessStatus(response, 201, "Could not save your cards.");
		}
	} catch (error) {
		await decksDestroy(deck.data.id, request).catch(console.error);
		throw error;
	}
}

/** Sends only what changed, so edited cards keep their study history. */
export async function updateSet(
	original: SetDetails,
	{ name, description, isPublic, cards }: NewFlashcardSet,
) {
	const request = await authorizedRequest();
	const newDescription = description || null;

	if (
		name !== original.name ||
		newDescription !== original.description ||
		isPublic !== original.isPublic
	) {
		const deck = await decksUpdate(
			original.id,
			{ name, description: newDescription, is_public: isPublic },
			request,
		);
		throwUnlessStatus(deck, 200, "Could not save your set.");
	}

	const keptIds = new Set(cards.map((card) => card.id));
	for (const card of original.cards) {
		if (keptIds.has(card.id)) continue;
		const response = await cardsDestroy(card.id, request);
		throwUnlessStatus(response, 204, "Could not remove a card.");
	}

	const originalCards = new Map(original.cards.map((card) => [card.id, card]));
	for (const card of cards) {
		const existing = card.id === undefined ? null : originalCards.get(card.id);
		if (!existing) {
			const response = await cardsStore(
				{ deck_id: original.id, content: cardContent(card) },
				request,
			);
			throwUnlessStatus(response, 201, "Could not save your cards.");
		} else if (cardContent(card) !== cardContent(existing)) {
			const response = await cardsUpdate(
				existing.id,
				{ content: cardContent(card) },
				request,
			);
			throwUnlessStatus(response, 200, "Could not save your cards.");
		}
	}
}

export async function deleteSet(setId: number) {
	const response = await decksDestroy(setId, await authorizedRequest());
	throwUnlessStatus(response, 204, "Could not delete this set.");
}

function fetchCurrentUser(accessToken: string) {
	return userShow({
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${accessToken}`,
		},
	});
}

/** Returns null when the account has no usable profile yet (none exists, or its username is taken). */
export async function readCurrentUser(accessToken: string) {
	const response = await fetchCurrentUser(accessToken);
	if ([401, 404, 409].includes(Number(response.status))) return null;
	if (response.status !== 200) throw new Error("Could not check your profile.");
	return response.data;
}

/**
 * The API creates a profile from the token's `username` metadata, so save the
 * username to Supabase, get a token containing it, and ask the API for the profile.
 */
export async function createUser(username: string) {
	if (!supabase) throw new Error("Supabase is not configured.");

	const { error } = await supabase.auth.updateUser({ data: { username } });
	if (error) throw new Error(error.message);

	const { data, error: refreshError } = await supabase.auth.refreshSession();
	if (refreshError || !data.session)
		throw new Error("Sign in to finish setting up your profile.");

	const response = await fetchCurrentUser(data.session.access_token);
	if (Number(response.status) === 409)
		throw new Error("That username is already taken.");
	if (response.status !== 200)
		throw new Error("Could not create your profile. Please retry.");
	return response.data;
}
