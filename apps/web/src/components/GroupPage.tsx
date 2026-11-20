import {
	ActionIcon,
	Avatar,
	Badge,
	Button,
	Grid,
	Group,
	Modal,
	Paper,
	ScrollArea,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Crown,
	Eye,
	GraduationCap,
	Layers,
	Search,
	Share2,
	Trash2,
	UserMinus,
	UserPlus,
	Users,
	X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import {
	cancelInvitation,
	deleteGroup,
	type GroupDetails,
	type GroupSet,
	inviteToGroup,
	listMySets,
	loadGroup,
	removeGroupMember,
	STUDY_GROUPS_QUERY_KEY,
	searchUsers,
	shareSetWithGroup,
	unshareSetFromGroup,
} from "../lib/api-lib";
import { useAuth } from "../lib/auth";
import AppLayout from "./AppLayout";
import { cardLabel } from "./formatters";
import { notifyError } from "./notifyError";
import PageLayout, { PageMessage } from "./PageLayout";

type Confirmation = {
	title: string;
	message: string;
	action: string;
	run: () => Promise<void>;
};

export default function GroupPage({ groupId }: { groupId: number }) {
	const { userId } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [modal, setModal] = useState<"invite" | "share" | null>(null);
	const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

	const group = useQuery({
		queryKey: [STUDY_GROUPS_QUERY_KEY, userId, groupId],
		queryFn: () => loadGroup(groupId),
		enabled: !!userId,
	});
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: [STUDY_GROUPS_QUERY_KEY] });

	/** Runs an action, refreshes the group, and reports failures. */
	const perform = async (run: () => Promise<void>, fallback: string) => {
		try {
			await run();
			await refresh();
		} catch (error) {
			notifyError(error, fallback);
		}
	};

	const details = group.data;
	const isOwner = !!details && details.ownerId === userId;
	const canRemoveSet = (set: GroupSet) =>
		isOwner || set.ownerId === userId || set.sharedById === userId;

	const leaveGroup = (current: GroupDetails) =>
		setConfirmation({
			title: "Leave this group?",
			message: `You'll lose access to the sets shared in “${current.name}” unless you're invited again.`,
			action: "Leave group",
			run: async () => {
				if (!userId) return;
				await removeGroupMember(current.id, userId);
				await refresh();
				void navigate({ to: "/groups" });
			},
		});

	const removeGroup = (current: GroupDetails) =>
		setConfirmation({
			title: "Delete this group?",
			message: `“${current.name}” will be deleted for every member. Their sets and study progress are kept.`,
			action: "Delete group",
			run: async () => {
				await deleteGroup(current.id);
				await refresh();
				void navigate({ to: "/groups" });
			},
		});

	const confirmRemoveSet = (current: GroupDetails, set: GroupSet) =>
		setConfirmation({
			title: "Remove this set from the group?",
			message: `Members will no longer be able to study “${set.name}” through this group. The set itself isn't deleted.`,
			action: "Remove set",
			run: () =>
				perform(
					() => unshareSetFromGroup(current.id, set.id),
					"Could not remove that set.",
				),
		});

	const confirmRemoveMember = (
		current: GroupDetails,
		member: { id: string; username: string },
	) =>
		setConfirmation({
			title: `Remove ${member.username}?`,
			message: `${member.username} will lose access to the sets shared in this group.`,
			action: "Remove member",
			run: () =>
				perform(
					() => removeGroupMember(current.id, member.id),
					"Could not remove that member.",
				),
		});

	return (
		<AppLayout active="groups">
			<PageLayout size={1100} gap={20}>
				<Group justify="space-between" gap={16}>
					<Button
						variant="default"
						renderRoot={(props) => <Link {...props} to="/groups" />}
						leftSection={<ArrowLeft size={16} aria-hidden="true" />}
					>
						Back to groups
					</Button>
					{details && (
						<Group gap={8}>
							<Button
								onClick={() => setModal("share")}
								leftSection={<Share2 size={15} aria-hidden="true" />}
							>
								Share set
							</Button>
							{isOwner && (
								<Button
									variant="default"
									onClick={() => setModal("invite")}
									leftSection={<UserPlus size={15} aria-hidden="true" />}
								>
									Invite
								</Button>
							)}
							{isOwner ? (
								<Button
									variant="light"
									color="red"
									onClick={() => removeGroup(details)}
									leftSection={<Trash2 size={15} aria-hidden="true" />}
								>
									Delete group
								</Button>
							) : (
								<Button
									variant="light"
									color="red"
									onClick={() => leaveGroup(details)}
								>
									Leave group
								</Button>
							)}
						</Group>
					)}
				</Group>

				{!userId ? (
					<PageMessage>Sign in to see this study group.</PageMessage>
				) : group.isError ? (
					<PageMessage role="alert">
						Could not load this study group. Refresh to try again.
					</PageMessage>
				) : group.isPending ? (
					<PageMessage>Loading…</PageMessage>
				) : !details ? (
					<PageMessage>
						This group doesn't exist, or you aren't a member.
					</PageMessage>
				) : (
					<>
						<Paper withBorder radius={12} p={24}>
							<Stack gap={8}>
								<Badge variant="default" w="fit-content">
									Owned by {details.ownerName}
								</Badge>
								<Title order={1} size={22}>
									{details.name}
								</Title>
								{details.description && (
									<Text c="dimmed">{details.description}</Text>
								)}
								<Group gap={8} mt={4} c="dimmed" fz={12}>
									<Users size={15} aria-hidden="true" />
									<span>
										{details.members.length}{" "}
										{details.members.length === 1 ? "member" : "members"}
									</span>
									<span>•</span>
									<span>
										{details.sets.length} shared{" "}
										{details.sets.length === 1 ? "set" : "sets"}
									</span>
								</Group>
							</Stack>
						</Paper>

						<Grid gap={20}>
							<Grid.Col span={{ base: 12, sm: 8 }}>
								<Paper component="section" withBorder radius={12} p={20}>
									<Stack gap={12}>
										<Title order={2} size={16}>
											Shared sets
										</Title>
										{details.sets.length > 0 ? (
											<Stack gap={10}>
												{details.sets.map((set) => (
													<Paper key={set.id} withBorder p={12} bg="var(--bg)">
														<Group justify="space-between" gap={12}>
															<Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
																<Text fw={600}>{set.name}</Text>
																<Text c="dimmed" fz={12}>
																	{cardLabel(set.cardCount)} · By{" "}
																	{set.ownerName}
																</Text>
															</Stack>
															<Group gap={6}>
																{set.cardCount > 0 && (
																	<Button
																		size="xs"
																		renderRoot={(props) => (
																			<Link
																				{...props}
																				to="/sets/$setId/study"
																				params={{ setId: String(set.id) }}
																			/>
																		)}
																		leftSection={
																			<GraduationCap
																				size={14}
																				aria-hidden="true"
																			/>
																		}
																	>
																		Study
																	</Button>
																)}
																<Button
																	size="xs"
																	variant="default"
																	renderRoot={(props) => (
																		<Link
																			{...props}
																			to="/sets/$setId"
																			params={{ setId: String(set.id) }}
																		/>
																	)}
																	leftSection={
																		<Eye size={14} aria-hidden="true" />
																	}
																>
																	View
																</Button>
																{canRemoveSet(set) && (
																	<ActionIcon
																		variant="subtle"
																		color="gray"
																		aria-label={`Remove ${set.name} from the group`}
																		title="Remove from group"
																		onClick={() =>
																			confirmRemoveSet(details, set)
																		}
																	>
																		<X size={15} aria-hidden="true" />
																	</ActionIcon>
																)}
															</Group>
														</Group>
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
												<Button
													variant="transparent"
													onClick={() => setModal("share")}
												>
													Share your first set
												</Button>
											</Stack>
										)}
									</Stack>
								</Paper>
							</Grid.Col>

							<Grid.Col span={{ base: 12, sm: 4 }}>
								<Paper component="aside" withBorder radius={12} p={20}>
									<Stack gap={12}>
										<Title order={2} size={16}>
											Members
										</Title>
										<Stack gap={4}>
											{details.members.map((member) => (
												<PersonRow key={member.id} username={member.username}>
													{member.id === userId && (
														<Text span c="dimmed" size="sm">
															(you)
														</Text>
													)}
													{member.id === details.ownerId ? (
														<Crown
															size={14}
															color="var(--mantine-color-yellow-6)"
															aria-label="Owner"
														/>
													) : (
														isOwner && (
															<ActionIcon
																variant="subtle"
																color="gray"
																aria-label={`Remove ${member.username}`}
																title="Remove from group"
																onClick={() =>
																	confirmRemoveMember(details, member)
																}
															>
																<UserMinus size={15} aria-hidden="true" />
															</ActionIcon>
														)
													)}
												</PersonRow>
											))}
										</Stack>

										{details.invitations.length > 0 && (
											<>
												<Text size="sm" fw={600} c="dimmed" mt={8}>
													Invited
												</Text>
												<Stack gap={4} opacity={0.7}>
													{details.invitations.map((invitation) => (
														<PersonRow
															key={invitation.id}
															username={invitation.username}
														>
															{isOwner && (
																<ActionIcon
																	variant="subtle"
																	color="gray"
																	aria-label={`Cancel ${invitation.username}'s invitation`}
																	title="Cancel invitation"
																	onClick={() =>
																		void perform(
																			() => cancelInvitation(invitation.id),
																			"Could not cancel that invitation.",
																		)
																	}
																>
																	<X size={15} aria-hidden="true" />
																</ActionIcon>
															)}
														</PersonRow>
													))}
												</Stack>
											</>
										)}
									</Stack>
								</Paper>
							</Grid.Col>
						</Grid>
					</>
				)}

				{details && modal === "invite" && (
					<InviteModal
						group={details}
						onClose={() => setModal(null)}
						onInvited={() => void refresh()}
					/>
				)}
				{details && modal === "share" && (
					<ShareSetModal
						group={details}
						onClose={() => setModal(null)}
						onShared={() => void refresh()}
					/>
				)}
				{confirmation && (
					<ConfirmModal
						confirmation={confirmation}
						onClose={() => setConfirmation(null)}
					/>
				)}
			</PageLayout>
		</AppLayout>
	);
}

function PersonRow({
	username,
	children,
}: {
	username: string;
	children?: ReactNode;
}) {
	return (
		<Group gap={10} py={6} wrap="nowrap">
			<Avatar size={28} color="flashcardz" radius="xl">
				{username.charAt(0).toUpperCase()}
			</Avatar>
			<Text size="sm" fw={500} truncate>
				{username}
			</Text>
			<Group gap={6} ml="auto" wrap="nowrap">
				{children}
			</Group>
		</Group>
	);
}

function InviteModal({
	group,
	onClose,
	onInvited,
}: {
	group: GroupDetails;
	onClose: () => void;
	onInvited: () => void;
}) {
	const [query, setQuery] = useState("");
	const [debouncedQuery] = useDebouncedValue(query.trim(), 250);
	const [invitedNow, setInvitedNow] = useState<Set<string>>(new Set());
	const [sending, setSending] = useState<string | null>(null);

	const matches = useQuery({
		queryKey: ["user-search", group.id, debouncedQuery],
		queryFn: () => searchUsers(debouncedQuery, group.id),
		enabled: debouncedQuery.length > 0,
		staleTime: 10_000,
	});

	const invite = async (username: string) => {
		setSending(username);
		try {
			await inviteToGroup(group.id, username);
			setInvitedNow((current) => new Set(current).add(username));
			notifications.show({ color: "green", message: `Invited ${username}.` });
			onInvited();
		} catch (error) {
			notifyError(error, "Could not send that invitation.");
		}
		setSending(null);
	};

	return (
		<Modal
			opened
			onClose={onClose}
			title={`Invite to ${group.name}`}
			size={440}
		>
			<Stack gap={14}>
				<TextInput
					data-autofocus
					type="search"
					aria-label="Search by username"
					placeholder="Search by username"
					value={query}
					maxLength={29}
					onChange={(e) => setQuery(e.target.value)}
					leftSection={<Search size={16} aria-hidden="true" />}
				/>
				{debouncedQuery.length === 0 ? (
					<Hint>Type a username to find people to invite.</Hint>
				) : matches.isError ? (
					<Hint role="alert">Could not search for users. Try again.</Hint>
				) : matches.isPending ? (
					<Hint>Searching…</Hint>
				) : matches.data.length === 0 ? (
					<Hint>No users start with “{debouncedQuery}”.</Hint>
				) : (
					<ScrollArea.Autosize mah={300}>
						<Stack gap={2}>
							{matches.data.map((match) => {
								const invited =
									match.isInvited || invitedNow.has(match.username);
								return (
									<PersonRow key={match.id} username={match.username}>
										{match.isMember ? (
											<Text c="dimmed" size="sm">
												Member
											</Text>
										) : invited ? (
											<Text c="dimmed" size="sm">
												Invited
											</Text>
										) : (
											<Button
												size="xs"
												loading={sending === match.username}
												onClick={() => void invite(match.username)}
												leftSection={<UserPlus size={14} aria-hidden="true" />}
											>
												Invite
											</Button>
										)}
									</PersonRow>
								);
							})}
						</Stack>
					</ScrollArea.Autosize>
				)}
			</Stack>
		</Modal>
	);
}

function ShareSetModal({
	group,
	onClose,
	onShared,
}: {
	group: GroupDetails;
	onClose: () => void;
	onShared: () => void;
}) {
	const navigate = useNavigate();
	const { userId } = useAuth();
	const [sharing, setSharing] = useState<number | null>(null);
	const mySets = useQuery({
		queryKey: ["my-sets", userId],
		queryFn: listMySets,
	});
	const sharedIds = new Set(group.sets.map((set) => set.id));
	const available =
		mySets.data?.filter((set) => !sharedIds.has(Number(set.id))) ?? [];

	const share = async (setId: number, name: string) => {
		setSharing(setId);
		try {
			await shareSetWithGroup(group.id, setId);
			notifications.show({
				color: "green",
				message: `Shared ${name} with ${group.name}.`,
			});
			onShared();
			onClose();
		} catch (error) {
			notifyError(error, "Could not share that set.");
			setSharing(null);
		}
	};

	return (
		<Modal
			opened
			onClose={onClose}
			title={`Share a set with ${group.name}`}
			size={440}
		>
			<Stack gap={14}>
				{mySets.isError ? (
					<Hint role="alert">Could not load your sets. Try again.</Hint>
				) : mySets.isPending ? (
					<Hint>Loading your sets…</Hint>
				) : available.length > 0 ? (
					<ScrollArea.Autosize mah={260}>
						<Stack gap={8}>
							{available.map((set) => (
								<Paper key={set.id} withBorder p={12} bg="var(--bg)">
									<Group justify="space-between" gap={12}>
										<Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
											<Text fw={600}>{set.name}</Text>
											<Text c="dimmed" size="xs">
												{cardLabel(set.cardCount)}
											</Text>
										</Stack>
										<Button
											loading={sharing === Number(set.id)}
											disabled={sharing !== null}
											onClick={() => void share(Number(set.id), set.name)}
										>
											Share
										</Button>
									</Group>
								</Paper>
							))}
						</Stack>
					</ScrollArea.Autosize>
				) : (
					<Stack align="center" p={20} gap={8} ta="center" c="dimmed">
						<Text>
							{mySets.data.length > 0
								? "All of your sets are already shared here."
								: "You don't have any sets to share yet."}
						</Text>
						<Button
							variant="transparent"
							onClick={() => {
								onClose();
								void navigate({ to: "/create" });
							}}
						>
							Create a set
						</Button>
					</Stack>
				)}
				<Hint>
					Everyone in the group can view and study the sets you share, even
					private ones.
				</Hint>
			</Stack>
		</Modal>
	);
}

function ConfirmModal({
	confirmation,
	onClose,
}: {
	confirmation: Confirmation;
	onClose: () => void;
}) {
	const [working, setWorking] = useState(false);

	const confirm = async () => {
		setWorking(true);
		try {
			await confirmation.run();
			onClose();
		} catch (error) {
			notifyError(error, "Something went wrong. Please try again.");
			setWorking(false);
		}
	};

	return (
		<Modal
			opened
			onClose={onClose}
			title={confirmation.title}
			size={400}
			role="alertdialog"
			aria-describedby="gp-confirm-desc"
		>
			<Text id="gp-confirm-desc">{confirmation.message}</Text>
			<Group justify="flex-end" gap={8} mt={20}>
				<Button data-autofocus variant="default" onClick={onClose}>
					Cancel
				</Button>
				<Button color="red" loading={working} onClick={() => void confirm()}>
					{confirmation.action}
				</Button>
			</Group>
		</Modal>
	);
}

function Hint({ children, role }: { children: ReactNode; role?: "alert" }) {
	return (
		<Text c="dimmed" size="sm" ta="center" role={role}>
			{children}
		</Text>
	);
}
