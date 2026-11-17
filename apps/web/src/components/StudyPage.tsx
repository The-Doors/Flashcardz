import {
	Button,
	Divider,
	Group,
	Paper,
	SimpleGrid,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	loadStudyQueue,
	reviewCard,
	STUDY_ACTIVITY_QUERY_KEY,
	type StudyQueue,
} from "../lib/api-lib";
import { useAuth } from "../lib/auth";
import { Rating } from "../lib/generated/api-generated.ts";
import AppLayout from "./AppLayout";
import CardText from "./CardText";
import { cardLabel } from "./formatters";
import PageLayout, { PageMessage } from "./PageLayout";

const RATINGS = [
	{ label: "Again", value: Rating.NUMBER_1 },
	{ label: "Hard", value: Rating.NUMBER_2 },
	{ label: "Good", value: Rating.NUMBER_3 },
	{ label: "Easy", value: Rating.NUMBER_4 },
];

const errorMessage = (cause: unknown) =>
	cause instanceof Error ? cause.message : "Could not load your cards.";

export default function StudyPage({ setId }: { setId: number }) {
	const { userId } = useAuth();
	const queryClient = useQueryClient();
	const [queue, setQueue] = useState<StudyQueue | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [revealed, setRevealed] = useState(false);
	const [saving, setSaving] = useState(false);
	const [keepPracticing, setKeepPracticing] = useState(false);
	const shownAt = useRef(0);
	const studiedIds = useRef(new Set<number>());
	const sessionSize = useRef<number | null>(null);

	const showQueue = (next: StudyQueue) => {
		sessionSize.current ??= next.ready;
		setQueue(next);
		setRevealed(false);
		setError(null);
		shownAt.current = Date.now();
	};

	useEffect(() => {
		let active = true;
		loadStudyQueue(setId)
			.then((next) => {
				if (active) showQueue(next);
			})
			.catch((cause: unknown) => {
				if (active) setError(errorMessage(cause));
			});
		return () => {
			active = false;
		};
	}, [setId, userId]);

	const rate = async (rating: Rating) => {
		if (!queue?.card || saving) return;
		setSaving(true);
		try {
			await reviewCard(setId, queue.card, rating, Date.now() - shownAt.current);
			studiedIds.current.add(queue.card.id);
			void queryClient.invalidateQueries({
				queryKey: [STUDY_ACTIVITY_QUERY_KEY],
			});
		} catch (cause) {
			notifications.show({ color: "red", message: errorMessage(cause) });
		}
		// The API decides what comes next, including when a missed card returns.
		try {
			showQueue(await loadStudyQueue(setId));
		} catch (cause) {
			setError(errorMessage(cause));
		}
		setSaving(false);
	};

	// Cards the user is still learning keep coming back, so mark the end of the first pass.
	const reachedEndOfSet =
		!keepPracticing &&
		!!queue?.card &&
		studiedIds.current.has(queue.card.id) &&
		studiedIds.current.size >= (sessionSize.current ?? Infinity);

	const finishButton = (
		<Button
			renderRoot={(props) => (
				<Link {...props} to="/sets/$setId" params={{ setId: String(setId) }} />
			)}
		>
			Finish studying
		</Button>
	);

	return (
		<AppLayout active="home">
			<PageLayout>
				<Group justify="space-between" gap={16}>
					<Button
						renderRoot={(props) => (
							<Link
								{...props}
								to="/sets/$setId"
								params={{ setId: String(setId) }}
							/>
						)}
						variant="default"
						leftSection={<ArrowLeft size={16} aria-hidden="true" />}
					>
						Back to set
					</Button>
					{queue?.card && !reachedEndOfSet && (
						<Text c="dimmed" size="sm">
							{queue.remaining} left
						</Text>
					)}
				</Group>

				<Stack gap={24} maw={640} w="100%" mx="auto">
					{error ? (
						<PageMessage role="alert">{error}</PageMessage>
					) : !queue ? (
						<PageMessage>Loading…</PageMessage>
					) : !queue.card ? (
						<Stack align="center" gap={16} mt={40} ta="center">
							<Title order={1}>
								{queue.remaining === 0 ? "All caught up" : "Done for now"}
							</Title>
							<Text c="dimmed">
								{queue.remaining === 0
									? "You've finished everything due today."
									: `${cardLabel(queue.remaining)} will be ready again later today.`}
							</Text>
							{finishButton}
						</Stack>
					) : reachedEndOfSet ? (
						<Stack align="center" gap={16} mt={40} ta="center">
							<Title order={1}>You reached the end of the set</Title>
							<Text c="dimmed">
								Your progress is saved. Cards you're still learning will come
								back the next time you study.
							</Text>
							<Group justify="center" gap={10}>
								<Button
									type="button"
									variant="default"
									onClick={() => {
										setKeepPracticing(true);
										shownAt.current = Date.now();
									}}
								>
									Keep practicing
								</Button>
								{finishButton}
							</Group>
						</Stack>
					) : (
						<>
							<Paper
								component="article"
								withBorder
								radius={12}
								p={{ base: 20, xs: 32 }}
								mih={260}
								ta="center"
								fz={18}
							>
								<Stack gap={20} justify="center" mih={194}>
									<CardText text={queue.card.front} />
									{revealed && (
										<>
											<Divider />
											<CardText text={queue.card.back} />
										</>
									)}
								</Stack>
							</Paper>

							{revealed ? (
								<SimpleGrid cols={{ base: 2, xs: 4 }} spacing={10}>
									{RATINGS.map(({ label, value }) => (
										<Button
											key={value}
											type="button"
											variant="default"
											disabled={saving}
											onClick={() => void rate(value)}
										>
											{label}
										</Button>
									))}
								</SimpleGrid>
							) : (
								<Button
									type="button"
									miw={200}
									style={{ alignSelf: "center" }}
									onClick={() => setRevealed(true)}
								>
									Show answer
								</Button>
							)}
						</>
					)}
				</Stack>
			</PageLayout>
		</AppLayout>
	);
}
