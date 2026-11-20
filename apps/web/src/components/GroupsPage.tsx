import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { notifications } from "@mantine/notifications";
import { Check, ChevronRight, Crown, Mail, Plus, Users, X } from "lucide-react";
import AppLayout from "./AppLayout";
import GroupModal, { notifyError } from "./GroupModal";
import {
  acceptInvitation,
  createGroup,
  declineInvitation,
  listMyGroups,
  listMyInvitations,
  STUDY_GROUP_INVITATIONS_QUERY_KEY,
  STUDY_GROUPS_QUERY_KEY,
  type GroupInvitation,
} from "../lib/api-lib";
import { useAuth } from "../lib/auth";
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
        notifications.show({ color: "green", message: `You joined ${invitation.groupName}.` });
      } else {
        await declineInvitation(invitation.id);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [STUDY_GROUP_INVITATIONS_QUERY_KEY] }),
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
        <div className="gp-page">
          <div className="gp-empty-state">
            <Users size={32} aria-hidden="true" />
            <h3>Study together</h3>
            <p>Sign in to create study groups, invite friends, and study the same sets.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout active="groups">
      <div className="gp-page">
        <div className="gp-header">
          <div>
            <h1 className="gp-title">Study Groups</h1>
            <p className="gp-subtitle">Invite friends and study the same sets together.</p>
          </div>
          <button type="button" className="gp-create-btn" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} aria-hidden="true" />
            <span>Create Group</span>
          </button>
        </div>

        {invitations.data && invitations.data.length > 0 && (
          <section className="gp-invitations" aria-labelledby="gp-invitations-title">
            <h2 id="gp-invitations-title">
              <Mail size={16} aria-hidden="true" /> Invitations
            </h2>
            {invitations.data.map((invitation) => (
              <div key={invitation.id} className="gp-invitation-row">
                <div>
                  <strong>{invitation.groupName}</strong>
                  <span>
                    {invitation.inviterName ? `Invited by ${invitation.inviterName} · ` : ""}
                    {invitation.memberCount} {invitation.memberCount === 1 ? "member" : "members"}
                  </span>
                </div>
                <div className="gp-invitation-actions">
                  <button
                    type="button"
                    className="gp-action-btn outline sm"
                    disabled={answering === invitation.id}
                    onClick={() => void answer(invitation, false)}
                  >
                    <X size={14} aria-hidden="true" /> Decline
                  </button>
                  <button
                    type="button"
                    className="gp-action-btn primary sm"
                    disabled={answering === invitation.id}
                    onClick={() => void answer(invitation, true)}
                  >
                    <Check size={14} aria-hidden="true" /> Join
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {groups.isError ? (
          <p className="gp-message" role="alert">Could not load your study groups. Refresh to try again.</p>
        ) : groups.isPending ? (
          <p className="gp-message">Loading…</p>
        ) : groups.data.length > 0 ? (
          <div className="gp-grid">
            {groups.data.map((group) => (
              <Link
                key={group.id}
                to="/groups/$groupId"
                params={{ groupId: String(group.id) }}
                className="gp-card"
              >
                <div className="gp-card-top">
                  {group.ownerId === userId ? (
                    <span className="gp-member-pill">
                      <Crown size={12} aria-hidden="true" /> Owner
                    </span>
                  ) : (
                    <span className="gp-badge">Owned by {group.ownerName}</span>
                  )}
                  <span className="gp-members-count">
                    <Users size={13} aria-hidden="true" /> {group.memberCount}
                  </span>
                </div>
                <h3 className="gp-card-name">{group.name}</h3>
                {group.description && <p className="gp-card-desc">{group.description}</p>}
                <div className="gp-card-foot">
                  <span>
                    {group.setCount} shared {group.setCount === 1 ? "set" : "sets"}
                  </span>
                  <ChevronRight size={16} className="gp-chevron" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="gp-empty-state">
            <Users size={32} aria-hidden="true" />
            <h3>No study groups yet</h3>
            <p>Create a group, invite friends by username, and share sets to study together.</p>
            <button type="button" className="gp-create-btn" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} aria-hidden="true" /> Create your first group
            </button>
          </div>
        )}

        {showCreateModal && (
          <CreateGroupModal
            onClose={() => setShowCreateModal(false)}
            onCreated={(groupId) => {
              void queryClient.invalidateQueries({ queryKey: [STUDY_GROUPS_QUERY_KEY] });
              void navigate({ to: "/groups/$groupId", params: { groupId: String(groupId) } });
            }}
          />
        )}
      </div>
    </AppLayout>
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
    <GroupModal title="Create Study Group" onClose={onClose}>
        <form onSubmit={(e) => void submit(e)} className="gp-modal-form">
          <div className="gp-field">
            <label htmlFor="gp-group-name">Group name</label>
            <input
              id="gp-group-name"
              type="text"
              placeholder="e.g., Biology 101 study circle"
              value={name}
              maxLength={255}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="gp-field">
            <label htmlFor="gp-group-description">Description</label>
            <textarea
              id="gp-group-description"
              placeholder="What will members focus on in this group?"
              value={description}
              maxLength={1000}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="gp-modal-actions">
            <button type="button" className="gp-action-btn outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="gp-action-btn primary" disabled={saving}>
              {saving ? "Creating…" : "Create group"}
            </button>
          </div>
        </form>
    </GroupModal>
  );
}
