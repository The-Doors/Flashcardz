import {
	ActionIcon,
	Alert,
	Badge,
	Button,
	Checkbox,
	Group,
	Paper,
	SimpleGrid,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Bold,
	Code,
	Download,
	Italic,
	List,
	Plus,
	Save,
	Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
	isCardTooLong,
	loadSet,
	type NewFlashcardSet,
	type SetDetails,
	saveSet,
	updateSet,
} from "../lib/api-lib";
import { useAuth } from "../lib/auth";
import AppLayout from "./AppLayout";
import PageLayout, { PageMessage } from "./PageLayout";
import QuizletImportModal from "./QuizletImportModal";
import type {
	ActivityData,
	NavId,
	SignInPayload,
	SignUpPayload,
	UserInfo,
} from "./types";

type FlashcardInput = {
	id: string;
	/** Set when this card already exists on the server. */
	serverId?: number;
	front: string;
	back: string;
};

type CreatePageProps = {
	appName?: string;
	user?: UserInfo;
	onSearch?: (query: string) => void;
	onLogout?: () => void;
	onSignIn?: (data: SignInPayload) => void | Promise<void>;
	onSignUp?: (data: SignUpPayload) => void | Promise<void>;
	activity?: ActivityData;
	onSaveSet?: (data: NewFlashcardSet) => void | Promise<void>;
	onNavigate?: (id: NavId) => void;
	/** When set, the form edits this existing set instead of creating one. */
	setId?: number;
};

const genId = () => Math.random().toString(36.25).substring(2, 9);

export default function CreatePage({
	onSaveSet = saveSet,
	onNavigate,
	setId,
	...layoutProps
}: CreatePageProps) {
	const routerNavigate = useNavigate();
	const { userId } = useAuth();
	const isEditing = setId !== undefined;
	const [original, setOriginal] = useState<SetDetails | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [isPrivate, setIsPrivate] = useState(false);
	const [cards, setCards] = useState<FlashcardInput[]>([
		{ id: genId(), front: "", back: "" },
		{ id: genId(), front: "", back: "" },
	]);
	const [submitting, setSubmitting] = useState(false);
	const [importOpened, setImportOpened] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Keep track of textarea refs for Markdown toolbar insertion
	const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

	const showSavedSet = (set: SetDetails) => {
		setOriginal(set);
		setName(set.name);
		setDescription(set.description ?? "");
		setIsPrivate(!set.isPublic);
		setCards(
			set.cards.map((card) => ({
				id: genId(),
				serverId: card.id,
				front: card.front,
				back: card.back,
			})),
		);
	};

	useEffect(() => {
		if (setId === undefined) return;
		let active = true;
		setLoadError(null);
		loadSet(setId)
			.then((set) => {
				if (!active) return;
				if (set) showSavedSet(set);
				else
					setLoadError(
						"This set doesn't exist, or you need to sign in to edit it.",
					);
			})
			.catch((cause: unknown) => {
				console.error(cause);
				if (active)
					setLoadError("Could not load this set. Refresh to try again.");
			});
		return () => {
			active = false;
		};
	}, [setId, userId]);

	const blockedMessage = !isEditing
		? null
		: (loadError ??
			(!original
				? "Loading…"
				: original.ownerId !== userId
					? "You can only edit your own sets."
					: null));

	const leavePage = () =>
		setId === undefined
			? void routerNavigate({ to: "/" })
			: void routerNavigate({
					to: "/sets/$setId",
					params: { setId: String(setId) },
				});

	const addCard = () => {
		setCards((prev) => [...prev, { id: genId(), front: "", back: "" }]);
	};

	const updateCard = (id: string, field: "front" | "back", value: string) => {
		setCards((prev) =>
			prev.map((card) => (card.id === id ? { ...card, [field]: value } : card)),
		);
	};

	const insertMarkdown = (
		cardId: string,
		field: "front" | "back",
		syntax: string,
		wrap = true,
	) => {
		const textarea = textareaRefs.current[`${cardId}-${field}`];
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const value = textarea.value;

		let newValue = value;
		let newCursorPos = start;

		if (wrap) {
			const selected = value.substring(start, end);
			newValue =
				value.substring(0, start) +
				syntax +
				selected +
				syntax +
				value.substring(end);
			newCursorPos = start + syntax.length + selected.length;
		} else {
			// Prefix syntax (e.g. lists "- ")
			newValue = value.substring(0, start) + syntax + value.substring(start);
			newCursorPos = start + syntax.length;
		}

		updateCard(cardId, field, newValue);

		// Restore focus and cursor position after state update
		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(newCursorPos, newCursorPos);
		}, 0);
	};

	const removeCard = (id: string) => {
		if (cards.length <= 1) return;
		setCards((prev) => prev.filter((card) => card.id !== id));
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (submitting) return;

		if (!name.trim()) {
			setError("Please give your set a title.");
			return;
		}

		const incompleteIndex = cards.findIndex(
			(c) => !c.front.trim() !== !c.back.trim(),
		);
		if (incompleteIndex !== -1) {
			setError(`Card ${incompleteIndex + 1} needs both a front and a back.`);
			return;
		}

		const tooLongIndex = cards.findIndex(isCardTooLong);
		if (tooLongIndex !== -1) {
			setError(
				`Card ${tooLongIndex + 1} is too long. Cards can be up to about 10,000 characters.`,
			);
			return;
		}

		const validCards = cards.filter((c) => c.front.trim());
		if (validCards.length === 0) {
			setError("Add at least one complete flashcard (front and back).");
			return;
		}

		setError(null);
		setSubmitting(true);

		const data: NewFlashcardSet = {
			name: name.trim(),
			description: description.trim(),
			isPublic: !isPrivate,
			cards: validCards.map(({ serverId, front, back }) => ({
				id: serverId,
				front: front.trim(),
				back: back.trim(),
			})),
		};

		try {
			if (original) await updateSet(original, data);
			else await onSaveSet(data);
			leavePage();
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to save set. Try again.";
			// Part of an edit may have saved, so show the set's real state before any retry.
			const latest = original
				? await loadSet(original.id).catch(() => null)
				: null;
			if (latest) showSavedSet(latest);
			setError(latest ? `${message} Showing what was saved.` : message);
			setSubmitting(false);
		}
	};

	return (
		<AppLayout active="create" onNavigate={onNavigate} {...layoutProps}>
			<PageLayout>
				<Group justify="space-between" gap={16}>
					<Button
						variant="default"
						onClick={leavePage}
						leftSection={<ArrowLeft size={16} aria-hidden="true" />}
					>
						Cancel
					</Button>
					<Title order={1} size={20}>
						{isEditing ? "Edit Flashcard Set" : "Create Flashcard Set"}
					</Title>
					<Group gap={8}>
						{!isEditing && (
							<Button
								variant="default"
								disabled={submitting}
								onClick={() => setImportOpened(true)}
								leftSection={<Download size={16} aria-hidden="true" />}
							>
								Import from Quizlet
							</Button>
						)}
						<Button
							type="submit"
							form="create-set-form"
							loading={submitting}
							disabled={blockedMessage !== null}
							leftSection={<Save size={16} aria-hidden="true" />}
						>
							{submitting
								? "Saving..."
								: isEditing
									? "Save Changes"
									: "Save Set"}
						</Button>
					</Group>
				</Group>
				{blockedMessage ? (
					<PageMessage>{blockedMessage}</PageMessage>
				) : (
					<Stack
						component="form"
						id="create-set-form"
						onSubmit={handleSubmit}
						gap={24}
					>
						<Paper component="section" withBorder radius={12} p={20}>
							<Stack gap={14}>
								<Title order={2} size={16}>
									Set Details
								</Title>
								<TextInput
									id="set-name"
									label="Title"
									placeholder="e.g., React Hooks & Context API"
									value={name}
									onChange={(e) => setName(e.target.value)}
									maxLength={120}
									required
								/>
								<Textarea
									id="set-desc"
									label="Description (optional)"
									placeholder="Add a brief overview of what this set covers..."
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									rows={2}
									maxLength={300}
								/>
								<Checkbox
									id="set-private"
									checked={isPrivate}
									onChange={(e) => setIsPrivate(e.target.checked)}
									label="Keep this set private"
									description="Public sets can be found and viewed by anyone. Only you can see private sets."
								/>
							</Stack>
						</Paper>
						<Paper
							component="section"
							withBorder
							radius={12}
							p={{ base: 12, xs: 20 }}
						>
							<Stack gap={14}>
								<Group justify="space-between" gap={8}>
									<Title order={2} size={16}>
										Cards ({cards.length})
									</Title>
									<Button
										type="button"
										variant="default"
										onClick={addCard}
										leftSection={<Plus size={16} aria-hidden="true" />}
									>
										Add card
									</Button>
								</Group>
								<Stack gap={12}>
									{cards.map((card, index) => (
										<Paper
											key={card.id}
											withBorder
											p={{ base: 10, xs: 14 }}
											bg="var(--bg)"
										>
											<Group align="flex-start" gap={8} wrap="nowrap">
												<Badge
													variant="default"
													circle
													size="lg"
													mt={6}
													style={{ flexShrink: 0 }}
												>
													{index + 1}
												</Badge>
												<SimpleGrid
													cols={{ base: 1, sm: 2 }}
													spacing={14}
													style={{ flex: 1, minWidth: 0 }}
												>
													{(["front", "back"] as const).map((side) => (
														<Stack key={side} gap={4} miw={0}>
															<Group justify="space-between" gap={4}>
																<Group gap={6}>
																	<Text
																		component="label"
																		htmlFor={`${card.id}-${side}`}
																		size="xs"
																		fw={600}
																		c="dimmed"
																		tt="uppercase"
																	>
																		{side}
																	</Text>
																	<Badge
																		size="xs"
																		variant="outline"
																		tt="lowercase"
																	>
																		Markdown
																	</Badge>
																</Group>
																<Group gap={2}>
																	{[
																		{ label: "Bold", icon: Bold, marker: "**" },
																		{
																			label: "Italic",
																			icon: Italic,
																			marker: "*",
																		},
																		{
																			label: "Inline Code",
																			icon: Code,
																			marker: "`",
																		},
																		{
																			label: "Bullet List",
																			icon: List,
																			marker: "- ",
																		},
																	].map(({ label, icon: Icon, marker }) => (
																		<ActionIcon
																			key={label}
																			type="button"
																			variant="default"
																			size={22}
																			title={label}
																			aria-label={`${label} on ${side} of card ${index + 1}`}
																			onClick={() =>
																				insertMarkdown(
																					card.id,
																					side,
																					marker,
																					marker !== "- ",
																				)
																			}
																		>
																			<Icon size={12} />
																		</ActionIcon>
																	))}
																</Group>
															</Group>
															<Textarea
																id={`${card.id}-${side}`}
																aria-label={`${side === "front" ? "Front" : "Back"} of card ${index + 1}`}
																ref={(el) => {
																	textareaRefs.current[`${card.id}-${side}`] =
																		el;
																}}
																placeholder={
																	side === "front"
																		? "e.g., **useState** hook syntax"
																		: "e.g., `const [state, setState] = useState(initial);`"
																}
																value={card[side]}
																onChange={(e) =>
																	updateCard(card.id, side, e.target.value)
																}
																rows={3}
																resize="vertical"
																styles={{
																	input: {
																		background: "var(--panel)",
																		fontFamily: "monospace",
																		fontSize: 13,
																	},
																}}
															/>
														</Stack>
													))}
												</SimpleGrid>
												<ActionIcon
													type="button"
													variant="subtle"
													color="red"
													mt={26}
													onClick={() => removeCard(card.id)}
													disabled={cards.length <= 1}
													aria-label={`Delete card ${index + 1}`}
													title="Delete card"
													style={{ flexShrink: 0 }}
												>
													<Trash2 size={16} />
												</ActionIcon>
											</Group>
										</Paper>
									))}
								</Stack>
								<Button
									type="button"
									variant="default"
									fullWidth
									h={42}
									style={{ borderStyle: "dashed" }}
									onClick={addCard}
									leftSection={<Plus size={18} aria-hidden="true" />}
								>
									Add another card
								</Button>
							</Stack>
						</Paper>
						{error && (
							<Alert color="red" role="alert">
								{error}
							</Alert>
						)}
					</Stack>
				)}
			</PageLayout>
			{!isEditing && (
				<QuizletImportModal
					opened={importOpened}
					onClose={() => setImportOpened(false)}
					onImported={(id) =>
						void routerNavigate({
							to: "/sets/$setId",
							params: { setId: String(id) },
						})
					}
				/>
			)}
		</AppLayout>
	);
}
