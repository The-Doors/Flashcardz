import {
	Button,
	Center,
	Group,
	Menu,
	Paper,
	SimpleGrid,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	Check,
	ChevronRight,
	Layers,
	SlidersHorizontal,
	Sparkles,
	TrendingUp,
	User,
	Users,
} from "lucide-react";
import { useState } from "react";
import { loadCommunitySets } from "../lib/api-lib";
import AppLayout from "./AppLayout";
import { cardLabel } from "./formatters";
import PageLayout, { PageMessage } from "./PageLayout";
import type {
	ActivityData,
	CommunitySet,
	CommunitySort,
	NavId,
	SignInPayload,
	SignUpPayload,
	UserInfo,
} from "./types";
import "./CommunityPage.css";

type CommunityPageProps = {
	appName?: string;
	user?: UserInfo;
	onSearch?: (query: string) => void;
	onLogout?: () => void;
	onSignIn?: (data: SignInPayload) => void | Promise<void>;
	onSignUp?: (data: SignUpPayload) => void | Promise<void>;
	activity?: ActivityData;
	onOpenSet?: (set: CommunitySet) => void;
	onNavigate?: (id: NavId) => void;
};

const SORT_OPTIONS: {
	id: CommunitySort;
	label: string;
	icon: typeof TrendingUp;
}[] = [
	{ id: "popular", label: "Most popular", icon: TrendingUp },
	{ id: "newest", label: "Newest", icon: Sparkles },
	{ id: "cards", label: "Most cards", icon: Layers },
];

const EMPTY_SETS: CommunitySet[] = [];

export default function CommunityPage({
	onOpenSet,
	onNavigate,
	...layoutProps
}: CommunityPageProps) {
	const navigate = useNavigate();
	const [sortBy, setSortBy] = useState<CommunitySort>("popular");

	const community = useInfiniteQuery({
		queryKey: ["community-sets", sortBy],
		queryFn: ({ pageParam }) => loadCommunitySets(sortBy, pageParam),
		initialPageParam: 1,
		getNextPageParam: (last) =>
			last.page < last.lastPage ? last.page + 1 : undefined,
	});
	const sets = community.data?.pages.flatMap((page) => page.sets) ?? EMPTY_SETS;

	const openSet =
		onOpenSet ??
		((set: CommunitySet) =>
			void navigate({ to: "/sets/$setId", params: { setId: String(set.id) } }));

	const currentSortLabel =
		SORT_OPTIONS.find((o) => o.id === sortBy)?.label ?? "Most popular";

	return (
		<AppLayout active="community" onNavigate={onNavigate} {...layoutProps}>
			<PageLayout size={1100} gap={20}>
				<Group justify="space-between" align="flex-start" gap={16}>
					<Stack gap={4}>
						<Title order={1}>Community Sets</Title>
						<Text c="dimmed">
							Discover and study flashcard sets shared by learners across the
							community.
						</Text>
					</Stack>
					<Menu position="bottom-end" width={240}>
						<Menu.Target>
							<Button
								variant="default"
								leftSection={<SlidersHorizontal size={16} aria-hidden="true" />}
							>
								Sort{" "}
								<Text component="span" c="dimmed" size="sm" ml={10}>
									{currentSortLabel}
								</Text>
							</Button>
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Label>Sort by</Menu.Label>
							{SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
								<Menu.Item
									key={id}
									leftSection={<Icon size={15} aria-hidden="true" />}
									rightSection={
										sortBy === id ? (
											<Check size={15} aria-hidden="true" />
										) : undefined
									}
									onClick={() => setSortBy(id)}
								>
									{label}
								</Menu.Item>
							))}
						</Menu.Dropdown>
					</Menu>
				</Group>
				{community.isPending ? (
					<PageMessage>Loading…</PageMessage>
				) : community.isError ? (
					<PageMessage role="alert">
						Could not load community sets. Refresh to try again.
					</PageMessage>
				) : sets.length > 0 ? (
					<>
						<SimpleGrid minColWidth="min(100%, 280px)" spacing={16}>
							{sets.map((set) => (
								<Paper
									component="button"
									type="button"
									withBorder
									key={set.id}
									className="cp-card"
									onClick={() => openSet(set)}
								>
									<Group justify="flex-end" gap={8}>
										<Group
											component="span"
											gap={4}
											c="dimmed"
											fz={12}
											title={`${set.studyCount} ${set.studyCount === 1 ? "person has" : "people have"} studied this`}
										>
											<Users size={13} aria-hidden="true" />
											{set.studyCount.toLocaleString()}
										</Group>
									</Group>
									<Text
										component="span"
										size="15px"
										fw={600}
										lh={1.35}
										lineClamp={2}
									>
										{set.name}
									</Text>
									{set.description && (
										<Text
											component="span"
											size="xs"
											c="dimmed"
											lh={1.4}
											lineClamp={2}
										>
											{set.description}
										</Text>
									)}
									<Group
										justify="space-between"
										gap={8}
										mt="auto"
										pt={6}
										c="dimmed"
										fz={12}
									>
										<Group component="span" gap={5}>
											<User size={13} aria-hidden="true" />
											{set.author}
										</Group>
										<span>{cardLabel(set.cardCount)}</span>
									</Group>
									<ChevronRight
										size={18}
										className="cp-chevron"
										aria-hidden="true"
									/>
								</Paper>
							))}
						</SimpleGrid>
						{community.hasNextPage && (
							<Center mt={8}>
								<Button
									variant="default"
									loading={community.isFetchingNextPage}
									onClick={() => void community.fetchNextPage()}
								>
									{community.isFetchingNextPage ? "Loading…" : "Load more"}
								</Button>
							</Center>
						)}
					</>
				) : (
					<SimpleGrid minColWidth="min(100%, 280px)" spacing={16}>
						{[0, 1, 2, 3, 4, 5].map((i) => (
							<Paper
								key={i}
								withBorder
								bg="transparent"
								className="cp-card cp-card-empty"
								aria-hidden={i > 0}
							>
								{i === 0 && (
									<Stack gap={6} align="center" c="dimmed" fz={12}>
										<Layers size={22} aria-hidden="true" />
										<Text fw={600}>No community sets found</Text>
										<span>Community flashcard sets will appear here.</span>
									</Stack>
								)}
							</Paper>
						))}
					</SimpleGrid>
				)}
			</PageLayout>
		</AppLayout>
	);
}
