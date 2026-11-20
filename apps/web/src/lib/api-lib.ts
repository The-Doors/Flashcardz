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
	studyGroupInvitationsAccept,
	studyGroupInvitationsDecline,
	studyGroupInvitationsDestroy,
	studyGroupInvitationsIndex,
	studyGroupsDecksDestroy,
	studyGroupsDecksStore,
	studyGroupsDestroy,
	studyGroupsIndex,
	studyGroupsInvitationsStore,
	studyGroupsMembersDestroy,
	studyGroupsShow,
	studyGroupsStore,
	userShow,
	usersSearch,
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
	/** True when the viewer owns the set or it is shared with one of their study groups. */
	canStudy: boolean;
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
		canStudy: (deck.data as { can_study?: boolean }).can_study ?? false,
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

/* ------------------------------------------------------------------ */
/* Study groups                                                        */
/* ------------------------------------------------------------------ */

export const STUDY_GROUPS_QUERY_KEY = "study-groups";
export const STUDY_GROUP_INVITATIONS_QUERY_KEY = "study-group-invitations";

export type GroupSummary = {
	id: number;
	name: string;
	description: string | null;
	ownerId: string;
	ownerName: string;
	memberCount: number;
	setCount: number;
};

export type GroupMember = { id: string; username: string };

export type GroupSet = {
	id: number;
	name: string;
	cardCount: number;
	ownerId: string;
	ownerName: string;
	/** Null when the member who shared it has deleted their account. */
	sharedById: string | null;
};

export type GroupDetails = {
	id: number;
	name: string;
	description: string | null;
	ownerId: string;
	ownerName: string;
	members: GroupMember[];
	sets: GroupSet[];
	/** Invitations that haven't been answered yet. */
	invitations: { id: number; username: string }[];
};

export type GroupInvitation = {
	id: number;
	groupId: number;
	groupName: string;
	memberCount: number;
	/** Null when the inviter has deleted their account. */
	inviterName: string | null;
};

export type UserMatch = {
	id: string;
	username: string;
	isMember: boolean;
	isInvited: boolean;
};

type ApiUser = { id: string; username: string };

// The generated types don't describe the related records the API includes.
type ApiGroup = {
	id: number;
	name: string;
	description: string | null;
	owner_id: string;
	owner: ApiUser;
	members_count?: number;
	decks_count?: number;
	members?: ApiUser[];
	decks?: (Deck & {
		cards_count: number;
		user: ApiUser;
		pivot: { added_by_id: string | null };
	})[];
	invitations?: { id: number; invitee: ApiUser }[];
};

/** Turns any failed response into an error carrying the API's message when it has one. */
function throwUnlessOk(
	response: { status: number; data: unknown },
	expectedStatus: number,
	fallbackMessage: string,
) {
	if (response.status === expectedStatus) return;
	const message = (response.data as { message?: string } | null)?.message;
	throw new Error(
		[403, 422].includes(response.status) && message ? message : fallbackMessage,
	);
}

export async function listMyGroups(): Promise<GroupSummary[]> {
	const response = await studyGroupsIndex(await authorizedRequest());
	throwUnlessOk(response, 200, "Could not load your study groups.");
	const page = response.data as unknown as { data: ApiGroup[] };
	return page.data.map((group) => ({
		id: group.id,
		name: group.name,
		description: group.description,
		ownerId: group.owner_id,
		ownerName: group.owner.username,
		memberCount: group.members_count ?? 0,
		setCount: group.decks_count ?? 0,
	}));
}

/** Returns null when the group doesn't exist or the user isn't a member. */
export async function loadGroup(groupId: number): Promise<GroupDetails | null> {
	const response = await studyGroupsShow(groupId, await authorizedRequest());
	if (Number(response.status) === 404) return null;
	throwUnlessOk(response, 200, "Could not load this study group.");
	const group = response.data as unknown as ApiGroup;
	return {
		id: group.id,
		name: group.name,
		description: group.description,
		ownerId: group.owner_id,
		ownerName: group.owner.username,
		members: (group.members ?? []).map(({ id, username }) => ({
			id,
			username,
		})),
		sets: (group.decks ?? []).map((deck) => ({
			id: deck.id,
			name: deck.name,
			cardCount: deck.cards_count,
			ownerId: deck.user_id,
			ownerName: deck.user.username,
			sharedById: deck.pivot.added_by_id,
		})),
		invitations: (group.invitations ?? []).map((invitation) => ({
			id: invitation.id,
			username: invitation.invitee.username,
		})),
	};
}

/** Creates a group owned by the user and returns its id. */
export async function createGroup(name: string, description: string) {
	const response = await studyGroupsStore(
		{ name, description: description || null },
		await authorizedRequest(),
	);
	throwUnlessOk(response, 201, "Could not create the study group.");
	return (response.data as unknown as ApiGroup).id;
}

export async function deleteGroup(groupId: number) {
	const response = await studyGroupsDestroy(groupId, await authorizedRequest());
	throwUnlessOk(response, 204, "Could not delete the study group.");
}

/** Removes a member, or leaves the group when `userId` is the current user. */
export async function removeGroupMember(groupId: number, userId: string) {
	const response = await studyGroupsMembersDestroy(
		groupId,
		userId,
		await authorizedRequest(),
	);
	throwUnlessOk(response, 204, "Could not remove that member.");
}

export async function shareSetWithGroup(groupId: number, setId: number) {
	const response = await studyGroupsDecksStore(
		groupId,
		{ deck_id: setId },
		await authorizedRequest(),
	);
	throwUnlessOk(response, 201, "Could not share that set.");
}

export async function unshareSetFromGroup(groupId: number, setId: number) {
	const response = await studyGroupsDecksDestroy(
		groupId,
		setId,
		await authorizedRequest(),
	);
	throwUnlessOk(response, 204, "Could not remove that set from the group.");
}

/** Finds users whose username starts with `username`, marking who is already in or invited to the group. */
export async function searchUsers(
	username: string,
	groupId: number,
): Promise<UserMatch[]> {
	const response = await usersSearch(
		{ username, study_group_id: groupId },
		await authorizedRequest(),
	);
	throwUnlessOk(response, 200, "Could not search for users.");
	const result = response.data as unknown as {
		data: (ApiUser & { is_member: boolean; is_invited: boolean })[];
	};
	return result.data.map((user) => ({
		id: user.id,
		username: user.username,
		isMember: user.is_member,
		isInvited: user.is_invited,
	}));
}

export async function inviteToGroup(groupId: number, username: string) {
	const response = await studyGroupsInvitationsStore(
		groupId,
		{ username },
		await authorizedRequest(),
	);
	throwUnlessOk(response, 201, "Could not send that invitation.");
}

export async function cancelInvitation(invitationId: number) {
	const response = await studyGroupInvitationsDestroy(
		invitationId,
		await authorizedRequest(),
	);
	throwUnlessOk(response, 204, "Could not cancel that invitation.");
}

export async function listMyInvitations(): Promise<GroupInvitation[]> {
	const response = await studyGroupInvitationsIndex(await authorizedRequest());
	throwUnlessOk(response, 200, "Could not load your invitations.");
	const page = response.data as unknown as {
		data: {
			id: number;
			study_group: ApiGroup;
			inviter: ApiUser | null;
		}[];
	};
	return page.data.map((invitation) => ({
		id: invitation.id,
		groupId: invitation.study_group.id,
		groupName: invitation.study_group.name,
		memberCount: invitation.study_group.members_count ?? 0,
		inviterName: invitation.inviter?.username ?? null,
	}));
}

export async function acceptInvitation(invitationId: number) {
	const response = await studyGroupInvitationsAccept(
		invitationId,
		await authorizedRequest(),
	);
	throwUnlessOk(response, 200, "Could not accept that invitation.");
}

export async function declineInvitation(invitationId: number) {
	const response = await studyGroupInvitationsDecline(
		invitationId,
		await authorizedRequest(),
	);
	throwUnlessOk(response, 204, "Could not decline that invitation.");
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
