import {
	Avatar,
	Badge,
	Button,
	Grid,
	Group,
	Modal,
	NativeSelect,
	Paper,
	ScrollArea,
	SimpleGrid,
	Stack,
	Tabs,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	ChevronRight,
	Layers,
	Plus,
	Search,
	Share2,
	UserCheck,
	UserPlus,
	Users,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import AppLayout from "./AppLayout";
import { cardLabel } from "./formatters";
import PageLayout from "./PageLayout";
import type {
	ActivityData,
	FlashcardSet,
	NavId,
	SignInPayload,
	SignUpPayload,
	StudyGroup,
	UserInfo,
} from "./types";
import "./GroupsPage.css";

type GroupsPageProps = {
	appName?: string;
	user?: UserInfo;
	onSearch?: (query: string) => void;
	onLogout?: () => void;
	onSignIn?: (data: SignInPayload) => void | Promise<void>;
	onSignUp?: (data: SignUpPayload) => void | Promise<void>;
	activity?: ActivityData;
	groups?: StudyGroup[];
	mySets?: FlashcardSet[];
	onCreateGroup?: (data: {
		name: string;
		description: string;
		category: string;
	}) => void | Promise<void>;
	onJoinGroup?: (groupId: string | number) => void | Promise<void>;
	onLeaveGroup?: (groupId: string | number) => void | Promise<void>;
	onShareSet?: (
		groupId: string | number,
		set: FlashcardSet,
	) => void | Promise<void>;
	onNavigate?: (id: NavId) => void;
};

const EMPTY_GROUPS: StudyGroup[] = [];

export default function GroupsPage({
	groups = EMPTY_GROUPS,
	mySets = [],
	onCreateGroup,
	onJoinGroup,
	onLeaveGroup,
	onShareSet,
	onNavigate,
	...layoutProps
}: GroupsPageProps) {
	const routerNavigate = useNavigate();
	const [tab, setTab] = useState<"my" | "discover">("my");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);

	// Modals state
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [newGroupName, setNewGroupName] = useState("");
	const [newGroupDesc, setNewGroupDesc] = useState("");
	const [newGroupCategory, setNewGroupCategory] = useState("Tech & IT");

	const [showShareModal, setShowShareModal] = useState(false);

	const filteredGroups = useMemo(() => {
		return groups.filter((g) => {
			const matchesTab = tab === "my" ? g.isMember : true;
			const matchesSearch =
				g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				g.description.toLowerCase().includes(searchQuery.toLowerCase());
			return matchesTab && matchesSearch;
		});
	}, [groups, tab, searchQuery]);

	const handleCreateSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!newGroupName.trim()) return;

		await onCreateGroup?.({
			name: newGroupName.trim(),
			description: newGroupDesc.trim(),
			category: newGroupCategory,
		});

		setNewGroupName("");
		setNewGroupDesc("");
		setShowCreateModal(false);
	};

	return (
		<AppLayout active="groups" onNavigate={onNavigate} {...layoutProps}>
			<PageLayout size={1100} gap={20}>
				{selectedGroup ? (
					<Stack gap={20}>
						<Group justify="space-between" gap={16}>
							<Button
								variant="default"
								onClick={() => setSelectedGroup(null)}
								leftSection={<ArrowLeft size={16} aria-hidden="true" />}
							>
								Back to groups
							</Button>
							<Group gap={8}>
								{selectedGroup.isMember ? (
									<>
										<Button
											onClick={() => setShowShareModal(true)}
											leftSection={<Share2 size={15} aria-hidden="true" />}
										>
											Share set
										</Button>
										<Button
											variant="default"
											onClick={() => {
												onLeaveGroup?.(selectedGroup.id);
												setSelectedGroup({
													...selectedGroup,
													isMember: false,
													memberCount: selectedGroup.memberCount - 1,
												});
											}}
										>
											Leave group
										</Button>
									</>
								) : (
									<Button
										onClick={() => {
											onJoinGroup?.(selectedGroup.id);
											setSelectedGroup({
												...selectedGroup,
												isMember: true,
												memberCount: selectedGroup.memberCount + 1,
											});
										}}
										leftSection={<UserPlus size={15} aria-hidden="true" />}
									>
										Join group
									</Button>
								)}
							</Group>
						</Group>
						<Paper withBorder radius={12} p={24}>
							<Stack gap={8}>
								<Badge variant="default" w="fit-content">
									{selectedGroup.category}
								</Badge>
								<Title order={1} size={22}>
									{selectedGroup.name}
								</Title>
								<Text c="dimmed">{selectedGroup.description}</Text>
								<Group gap={8} mt={4} c="dimmed" fz={12}>
									<Users size={15} aria-hidden="true" />
									<span>{selectedGroup.memberCount} members</span>
									<span>•</span>
									<span>{selectedGroup.sharedSets.length} shared sets</span>
								</Group>
							</Stack>
						</Paper>
						<Grid gap={20}>
							<Grid.Col span={{ base: 12, sm: 8 }}>
								<Paper withBorder radius={12} p={20}>
									<Stack gap={12}>
										<Title order={2} size={16}>
											Shared Flashcard Sets
										</Title>
										{selectedGroup.sharedSets.length > 0 ? (
											<Stack gap={10}>
												{selectedGroup.sharedSets.map((set) => (
													<Paper key={set.id} withBorder p={12} bg="var(--bg)">
														<Stack gap={6}>
															<Text fw={600}>{set.name}</Text>
															<Group
																justify="space-between"
																gap={8}
																c="dimmed"
																fz={12}
															>
																<span>{cardLabel(set.cardCount)}</span>
																<span>Shared by {set.sharedBy}</span>
															</Group>
														</Stack>
													</Paper>
												))}
											</Stack>
										) : (
											<Stack
												align="center"
												gap={8}
												p={30}
												ta="center"
												c="dimmed"
											>
												<Layers size={24} aria-hidden="true" />
												<Text>No sets shared in this group yet.</Text>
												{selectedGroup.isMember && (
													<Button
														variant="transparent"
														onClick={() => setShowShareModal(true)}
													>
														Share your first set
													</Button>
												)}
											</Stack>
										)}
									</Stack>
								</Paper>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 4 }}>
								<Paper withBorder radius={12} p={20}>
									<Stack gap={12}>
										<Title order={2} size={16}>
											Members
										</Title>
										<Stack gap={8}>
											{selectedGroup.members.map((m) => (
												<Group key={m.id} gap={10} py={6}>
													<Avatar size={28} color="flashcardz" radius="xl">
														{m.name.charAt(0)}
													</Avatar>
													<Text size="sm" fw={500}>
														{m.name}
													</Text>
												</Group>
											))}
										</Stack>
									</Stack>
								</Paper>
							</Grid.Col>
						</Grid>
					</Stack>
				) : (
					<Stack gap={20}>
						<Group justify="space-between" align="flex-start" gap={16}>
							<Stack gap={4}>
								<Title order={1}>Study Groups</Title>
								<Text c="dimmed">
									Connect with peers, collaborate, and share flashcard sets
									together.
								</Text>
							</Stack>
							<Button
								onClick={() => setShowCreateModal(true)}
								leftSection={<Plus size={16} aria-hidden="true" />}
							>
								Create Group
							</Button>
						</Group>
						<Tabs
							value={tab}
							onChange={(value) => setTab(value as "my" | "discover")}
							variant="pills"
						>
							<Group justify="space-between" gap={16} mt={4}>
								<Tabs.List aria-label="Study groups">
									<Tabs.Tab value="my">My Groups</Tabs.Tab>
									<Tabs.Tab value="discover">Discover All</Tabs.Tab>
								</Tabs.List>
								<TextInput
									type="search"
									aria-label="Search groups"
									placeholder="Search groups..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									leftSection={<Search size={16} aria-hidden="true" />}
									w={{ base: "100%", xs: 280 }}
								/>
							</Group>
							<Tabs.Panel value={tab} pt={20}>
								{filteredGroups.length > 0 ? (
									<SimpleGrid minColWidth="min(100%, 320px)" spacing={16}>
										{filteredGroups.map((group) => (
											<Paper
												component="button"
												type="button"
												withBorder
												key={group.id}
												className="gp-card"
												onClick={() => setSelectedGroup(group)}
											>
												<Group justify="space-between" gap={8}>
													<Badge variant="default">{group.category}</Badge>
													{group.isMember ? (
														<Badge
															color="teal"
															variant="light"
															leftSection={
																<UserCheck size={12} aria-hidden="true" />
															}
														>
															Member
														</Badge>
													) : (
														<Group component="span" gap={4} c="dimmed" fz={12}>
															<Users size={13} aria-hidden="true" />
															{group.memberCount}
														</Group>
													)}
												</Group>
												<Title order={3}>{group.name}</Title>
												<Text c="dimmed" size="sm" lineClamp={2}>
													{group.description}
												</Text>
												<Group
													justify="space-between"
													mt="auto"
													pt={10}
													c="dimmed"
													fz={12}
													style={{ borderTop: "1px solid var(--border)" }}
												>
													<span>{group.sharedSets.length} shared sets</span>
													<ChevronRight size={16} aria-hidden="true" />
												</Group>
											</Paper>
										))}
									</SimpleGrid>
								) : (
									<Paper withBorder radius={12} px={20} py={60}>
										<Stack align="center" gap={10} ta="center" c="dimmed">
											<Users size={32} aria-hidden="true" />
											<Title order={2} c="var(--text)">
												No study groups found
											</Title>
											<Text>
												{tab === "my"
													? "You haven't joined any groups yet. Explore the 'Discover All' tab to find communities!"
													: "No groups match your search criteria."}
											</Text>
											{tab === "my" && (
												<Button onClick={() => setTab("discover")}>
													Discover groups
												</Button>
											)}
										</Stack>
									</Paper>
								)}
							</Tabs.Panel>
						</Tabs>
					</Stack>
				)}
				<Modal
					opened={showCreateModal}
					onClose={() => setShowCreateModal(false)}
					title="Create Study Group"
					size={440}
				>
					<Stack component="form" onSubmit={handleCreateSubmit} gap={14}>
						<TextInput
							data-autofocus
							label="Group Name"
							placeholder="e.g., Advanced Calculus Study Circle"
							value={newGroupName}
							onChange={(e) => setNewGroupName(e.target.value)}
							required
						/>
						<Textarea
							label="Description"
							placeholder="What will members focus on in this group?"
							value={newGroupDesc}
							onChange={(e) => setNewGroupDesc(e.target.value)}
							rows={3}
						/>
						<NativeSelect
							label="Category"
							value={newGroupCategory}
							onChange={(e) => setNewGroupCategory(e.target.value)}
							data={[
								"Tech & IT",
								"Science",
								"Languages",
								"Humanities",
								"Math",
								"Other",
							]}
						/>
						<Group justify="flex-end" gap={8} mt={4}>
							<Button
								variant="default"
								onClick={() => setShowCreateModal(false)}
							>
								Cancel
							</Button>
							<Button type="submit">Create group</Button>
						</Group>
					</Stack>
				</Modal>
				<Modal
					opened={showShareModal && !!selectedGroup}
					onClose={() => setShowShareModal(false)}
					title={`Share Set to ${selectedGroup?.name ?? ""}`}
					size={440}
				>
					{selectedGroup &&
						(mySets.length > 0 ? (
							<ScrollArea.Autosize mah={260}>
								<Stack gap={8}>
									{mySets.map((set) => (
										<Paper key={set.id} withBorder p={12} bg="var(--bg)">
											<Group justify="space-between" gap={12}>
												<Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
													<Text fw={600}>{set.name}</Text>
													<Text c="dimmed" size="xs">
														{cardLabel(set.cardCount)}
													</Text>
												</Stack>
												<Button
													onClick={() => {
														onShareSet?.(selectedGroup.id, set);
														setShowShareModal(false);
													}}
												>
													Share
												</Button>
											</Group>
										</Paper>
									))}
								</Stack>
							</ScrollArea.Autosize>
						) : (
							<Stack align="center" p={30} gap={8} ta="center" c="dimmed">
								<Text>You have no personal sets created yet to share.</Text>
								<Button
									variant="transparent"
									onClick={() => {
										setShowShareModal(false);
										void routerNavigate({ to: "/create" });
									}}
								>
									Create a set now
								</Button>
							</Stack>
						))}
				</Modal>
			</PageLayout>
		</AppLayout>
	);
}
