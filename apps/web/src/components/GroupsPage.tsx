import {
	Badge,
	Button,
	Group,
	Modal,
	Paper,
	SimpleGrid,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronRight, Crown, Mail, Plus, Users, X } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import {
	acceptInvitation,
	createGroup,
	declineInvitation,
	type GroupInvitation,
	listMyGroups,
	listMyInvitations,
	STUDY_GROUP_INVITATIONS_QUERY_KEY,
	STUDY_GROUPS_QUERY_KEY,
} from "../lib/api-lib";
import { useAuth } from "../lib/auth";
import AppLayout from "./AppLayout";
import { notifyError } from "./notifyError";
import PageLayout, { PageMessage } from "./PageLayout";
import "./GroupsPage.css";

export default function GroupsPage() {
	const { userId } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [answering, setAnswering] = useState<number | null>(null);

	const groups = useQuery({
		queryKey: [STUDY_GROUPS_QUERY_KEY, userId],
		queryFn: listMyGroups,
		enabled: !!userId,
	});
	const invitations = useQuery({
		queryKey: [STUDY_GROUP_INVITATIONS_QUERY_KEY, userId],
		queryFn: listMyInvitations,
		enabled: !!userId,
	});

	const answer = async (invitation: GroupInvitation, accept: boolean) => {
		setAnswering(invitation.id);
		try {
			if (accept) {
				await acceptInvitation(invitation.id);
				notifications.show({
					color: "green",
					message: `You joined ${invitation.groupName}.`,
				});
			} else {
				await declineInvitation(invitation.id);
			}
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: [STUDY_GROUP_INVITATIONS_QUERY_KEY],
				}),
				queryClient.invalidateQueries({ queryKey: [STUDY_GROUPS_QUERY_KEY] }),
			]);
		} catch (error) {
			notifyError(error, "Could not answer that invitation.");
		}
		setAnswering(null);
	};

	if (!userId) {
		return (
			<AppLayout active="groups">
				<PageLayout size={1100} gap={20}>
					<EmptyState
						title="Study together"
						text="Sign in to create study groups, invite friends, and study the same sets."
					/>
				</PageLayout>
			</AppLayout>
		);
	}

	return (
		<AppLayout active="groups">
			<PageLayout size={1100} gap={20}>
				<Group justify="space-between" align="flex-start" gap={16}>
					<Stack gap={4}>
						<Title order={1}>Study Groups</Title>
						<Text c="dimmed">
							Invite friends and study the same sets together.
						</Text>
					</Stack>
					<Button
						onClick={() => setShowCreateModal(true)}
						leftSection={<Plus size={16} aria-hidden="true" />}
					>
						Create Group
					</Button>
				</Group>

				{invitations.data && invitations.data.length > 0 && (
					<Paper
						component="section"
						withBorder
						radius={12}
						p={20}
						aria-labelledby="gp-invitations-title"
					>
						<Stack gap={12}>
							<Group gap={8}>
								<Mail size={16} aria-hidden="true" />
								<Title order={2} size={16} id="gp-invitations-title">
									Invitations
								</Title>
							</Group>
							{invitations.data.map((invitation) => (
								<Paper key={invitation.id} withBorder p={12} bg="var(--bg)">
									<Group justify="space-between" gap={12}>
										<Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
											<Text fw={600}>{invitation.groupName}</Text>
											<Text c="dimmed" size="xs">
												{invitation.inviterName
													? `Invited by ${invitation.inviterName} · `
													: ""}
												{invitation.memberCount}{" "}
												{invitation.memberCount === 1 ? "member" : "members"}
											</Text>
										</Stack>
										<Group gap={8}>
											<Button
												size="xs"
												variant="default"
												disabled={answering === invitation.id}
												onClick={() => void answer(invitation, false)}
												leftSection={<X size={14} aria-hidden="true" />}
											>
												Decline
											</Button>
											<Button
												size="xs"
												loading={answering === invitation.id}
												onClick={() => void answer(invitation, true)}
												leftSection={<Check size={14} aria-hidden="true" />}
											>
												Join
											</Button>
										</Group>
									</Group>
								</Paper>
							))}
						</Stack>
					</Paper>
				)}

				{groups.isError ? (
					<PageMessage role="alert">
						Could not load your study groups. Refresh to try again.
					</PageMessage>
				) : groups.isPending ? (
					<PageMessage>Loading…</PageMessage>
				) : groups.data.length > 0 ? (
					<SimpleGrid minColWidth="min(100%, 320px)" spacing={16}>
						{groups.data.map((group) => (
							<Paper
								key={group.id}
								withBorder
								className="gp-card"
								renderRoot={(props) => (
									<Link
										{...props}
										to="/groups/$groupId"
										params={{ groupId: String(group.id) }}
									/>
								)}
							>
								<Group justify="space-between" gap={8}>
									{group.ownerId === userId ? (
										<Badge
											color="teal"
											variant="light"
											leftSection={<Crown size={12} aria-hidden="true" />}
										>
											Owner
										</Badge>
									) : (
										<Badge variant="default">Owned by {group.ownerName}</Badge>
									)}
									<Group component="span" gap={4} c="dimmed" fz={12}>
										<Users size={13} aria-hidden="true" />
										{group.memberCount}
									</Group>
								</Group>
								<Title order={3}>{group.name}</Title>
								{group.description && (
									<Text c="dimmed" size="sm" lineClamp={2}>
										{group.description}
									</Text>
								)}
								<Group
									justify="space-between"
									mt="auto"
									pt={10}
									c="dimmed"
									fz={12}
									style={{ borderTop: "1px solid var(--border)" }}
								>
									<span>
										{group.setCount} shared{" "}
										{group.setCount === 1 ? "set" : "sets"}
									</span>
									<ChevronRight size={16} aria-hidden="true" />
								</Group>
							</Paper>
						))}
					</SimpleGrid>
				) : (
					<EmptyState
						title="No study groups yet"
						text="Create a group, invite friends by username, and share sets to study together."
					>
						<Button
							onClick={() => setShowCreateModal(true)}
							leftSection={<Plus size={16} aria-hidden="true" />}
						>
							Create your first group
						</Button>
					</EmptyState>
				)}

				{showCreateModal && (
					<CreateGroupModal
						onClose={() => setShowCreateModal(false)}
						onCreated={(groupId) => {
							void queryClient.invalidateQueries({
								queryKey: [STUDY_GROUPS_QUERY_KEY],
							});
							void navigate({
								to: "/groups/$groupId",
								params: { groupId: String(groupId) },
							});
						}}
					/>
				)}
			</PageLayout>
		</AppLayout>
	);
}

function EmptyState({
	title,
	text,
	children,
}: {
	title: string;
	text: string;
	children?: ReactNode;
}) {
	return (
		<Paper withBorder radius={12} px={20} py={60}>
			<Stack align="center" gap={10} ta="center" c="dimmed">
				<Users size={32} aria-hidden="true" />
				<Title order={2} c="var(--text)">
					{title}
				</Title>
				<Text>{text}</Text>
				{children}
			</Stack>
		</Paper>
	);
}

function CreateGroupModal({
	onClose,
	onCreated,
}: {
	onClose: () => void;
	onCreated: (groupId: number) => void;
}) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [saving, setSaving] = useState(false);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (!name.trim()) return;
		setSaving(true);
		try {
			onCreated(await createGroup(name.trim(), description.trim()));
		} catch (error) {
			notifyError(error, "Could not create the study group.");
			setSaving(false);
		}
	};

	return (
		<Modal opened onClose={onClose} title="Create Study Group" size={440}>
			<Stack component="form" onSubmit={(e) => void submit(e)} gap={14}>
				<TextInput
					data-autofocus
					label="Group name"
					placeholder="e.g., Biology 101 study circle"
					value={name}
					maxLength={255}
					onChange={(e) => setName(e.target.value)}
					required
				/>
				<Textarea
					label="Description"
					placeholder="What will members focus on in this group?"
					value={description}
					maxLength={1000}
					onChange={(e) => setDescription(e.target.value)}
					rows={3}
				/>
				<Group justify="flex-end" gap={8} mt={4}>
					<Button variant="default" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" loading={saving}>
						Create group
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
