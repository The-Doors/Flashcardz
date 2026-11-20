import {
	Button,
	Group,
	Paper,
	SimpleGrid,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Copy, GraduationCap, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { copySet, loadSet, type SetDetails } from "../lib/api-lib";
import { useAuth } from "../lib/auth";
import AppLayout from "./AppLayout";
import CardText from "./CardText";
import { cardLabel } from "./formatters";
import PageLayout, { PageMessage } from "./PageLayout";

export default function SetPage({ setId }: { setId: number }) {
	const { userId } = useAuth();
	// undefined while loading, null when the set can't be shown.
	const [set, setSet] = useState<SetDetails | null>();
	const [failed, setFailed] = useState(false);
	const [copying, setCopying] = useState(false);
	const navigate = useNavigate();

	const copyToMySets = async () => {
		setCopying(true);
		try {
			const copyId = await copySet(setId);
			void navigate({ to: "/sets/$setId", params: { setId: String(copyId) } });
		} catch (error) {
			console.error(error);
			notifications.show({
				color: "red",
				message: "Could not copy this set. Please try again.",
			});
		}
		setCopying(false);
	};

	useEffect(() => {
		let active = true;
		setFailed(false);
		loadSet(setId)
			.then((loaded) => {
				if (active) setSet(loaded);
			})
			.catch((error: unknown) => {
				console.error(error);
				if (active) setFailed(true);
			});
		return () => {
			active = false;
		};
	}, [setId, userId]);

	return (
		<AppLayout active="home">
			<PageLayout>
				<Group justify="space-between" gap={16}>
					<Button
						variant="default"
						renderRoot={(props) => <Link {...props} to="/" />}
						leftSection={<ArrowLeft size={16} aria-hidden="true" />}
					>
						Back
					</Button>
					{set && userId && set.ownerId !== userId && (
						<Button
							type="button"
							loading={copying}
							onClick={() => void copyToMySets()}
							leftSection={<Copy size={16} aria-hidden="true" />}
						>
							{copying ? "Copying…" : "Copy to my sets"}
						</Button>
					)}
					{set && (set.ownerId === userId || set.canStudy) && (
						<Group gap={10}>
							{set.ownerId === userId && (
								<Button
									variant="default"
									renderRoot={(props) => (
										<Link
											{...props}
											to="/sets/$setId/edit"
											params={{ setId: String(setId) }}
										/>
									)}
									leftSection={<Pencil size={16} aria-hidden="true" />}
								>
									Edit
								</Button>
							)}
							{set.canStudy && set.cards.length > 0 && (
								<Button
									renderRoot={(props) => (
										<Link
											{...props}
											to="/sets/$setId/study"
											params={{ setId: String(setId) }}
										/>
									)}
									variant="filled"
									leftSection={<GraduationCap size={16} aria-hidden="true" />}
								>
									Study
								</Button>
							)}
						</Group>
					)}
				</Group>

				{failed ? (
					<PageMessage role="alert">
						Could not load this set. Refresh to try again.
					</PageMessage>
				) : set === undefined ? (
					<PageMessage>Loading…</PageMessage>
				) : set === null ? (
					<PageMessage>
						This set doesn't exist, or you need to sign in to see it.
					</PageMessage>
				) : (
					<>
						<header>
							<Title order={1}>{set.name}</Title>
							{set.description && (
								<Text c="dimmed" mt={6}>
									{set.description}
								</Text>
							)}
							<Text c="dimmed" size="sm" mt={6}>
								{cardLabel(set.cards.length)}
								{!set.isPublic && " · Private"}
							</Text>
						</header>

						<Stack gap={10}>
							{set.cards.map((card) => (
								<Paper component="article" key={card.id} withBorder p={16}>
									<SimpleGrid
										cols={{ base: 1, xs: 2 }}
										spacing={{ base: 12, xs: 24 }}
									>
										<CardText text={card.front} />
										<CardText text={card.back} />
									</SimpleGrid>
								</Paper>
							))}
						</Stack>
					</>
				)}
			</PageLayout>
		</AppLayout>
	);
}
