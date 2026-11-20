import { SimpleGrid, Text, Title } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { searchSets } from "../lib/api-lib";
import { useAuth } from "../lib/auth";
import AppLayout from "./AppLayout";
import PageLayout, { PageMessage } from "./PageLayout";
import { RecentSetCard } from "./RecentSets";
import type { FlashcardSet } from "./types";

type SearchResults = { query: string; total: number; sets: FlashcardSet[] };

export default function SearchPage({ query }: { query: string }) {
	const navigate = useNavigate();
	const { userId } = useAuth();
	const [results, setResults] = useState<SearchResults | null>(null);
	const [failed, setFailed] = useState(false);
	const search = query.trim();

	useEffect(() => {
		if (!search) return;
		let active = true;
		setFailed(false);
		searchSets(search)
			.then((found) => {
				if (active) setResults({ query: search, ...found });
			})
			.catch((error: unknown) => {
				console.error(error);
				if (active) setFailed(true);
			});
		return () => {
			active = false;
		};
	}, [search, userId]);

	const current = results?.query === search ? results : null;

	return (
		<AppLayout active="home">
			<PageLayout>
				<header>
					<Title order={1}>
						{search ? `Results for “${search}”` : "Search"}
					</Title>
					{current && current.total > current.sets.length && (
						<Text c="dimmed" size="sm" mt={6}>
							Showing the {current.sets.length} newest of {current.total}{" "}
							matches.
						</Text>
					)}
				</header>

				{!search ? (
					<PageMessage>
						Use the search bar above to find flashcard sets.
					</PageMessage>
				) : failed ? (
					<PageMessage role="alert">
						Search failed. Please try again.
					</PageMessage>
				) : !current ? (
					<PageMessage>Searching…</PageMessage>
				) : current.sets.length === 0 ? (
					<PageMessage>No sets match your search.</PageMessage>
				) : (
					<SimpleGrid minColWidth="min(100%, 260px)" spacing={16}>
						{current.sets.map((set) => (
							<RecentSetCard
								key={set.id}
								set={set}
								onOpen={() =>
									void navigate({
										to: "/sets/$setId",
										params: { setId: String(set.id) },
									})
								}
							/>
						))}
					</SimpleGrid>
				)}
			</PageLayout>
		</AppLayout>
	);
}
