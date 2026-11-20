import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
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
import AppLayout from "./AppLayout";
import GroupModal, { notifyError } from "./GroupModal";
import { cardLabel } from "./formatters";
import {
  cancelInvitation,
  deleteGroup,
  inviteToGroup,
  listMySets,
  loadGroup,
  removeGroupMember,
  searchUsers,
  shareSetWithGroup,
  STUDY_GROUPS_QUERY_KEY,
  unshareSetFromGroup,
  type GroupDetails,
  type GroupSet,
} from "../lib/api-lib";
import { useAuth } from "../lib/auth";
import "./GroupsPage.css";

type Confirmation = { title: string; message: string; action: string; run: () => Promise<void> };

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
  const refresh = () => queryClient.invalidateQueries({ queryKey: [STUDY_GROUPS_QUERY_KEY] });

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
  const canRemoveSet = (set: GroupSet) => isOwner || set.ownerId === userId || set.sharedById === userId;

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

  return (
    <AppLayout active="groups">
      <div className="gp-page">
        <div className="gp-detail-header-bar">
          <Link to="/groups" className="gp-back-btn">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to groups</span>
          </Link>

          {details && (
            <div className="gp-detail-actions">
              <button type="button" className="gp-action-btn primary" onClick={() => setModal("share")}>
                <Share2 size={15} aria-hidden="true" /> Share set
              </button>
              {isOwner && (
                <button type="button" className="gp-action-btn outline" onClick={() => setModal("invite")}>
                  <UserPlus size={15} aria-hidden="true" /> Invite
                </button>
              )}
              {isOwner ? (
                <button type="button" className="gp-action-btn outline danger" onClick={() => removeGroup(details)}>
                  <Trash2 size={15} aria-hidden="true" /> Delete group
                </button>
              ) : (
                <button type="button" className="gp-action-btn outline danger" onClick={() => leaveGroup(details)}>
                  Leave group
                </button>
              )}
            </div>
          )}
        </div>

        {!userId ? (
          <p className="gp-message">Sign in to see this study group.</p>
        ) : group.isError ? (
          <p className="gp-message" role="alert">Could not load this study group. Refresh to try again.</p>
        ) : group.isPending ? (
          <p className="gp-message">Loading…</p>
        ) : !details ? (
          <p className="gp-message">This group doesn't exist, or you aren't a member.</p>
        ) : (
          <div className="gp-detail">
            <div className="gp-hero-card">
              <span className="gp-badge">Owned by {details.ownerName}</span>
              <h1 className="gp-hero-title">{details.name}</h1>
              {details.description && <p className="gp-hero-desc">{details.description}</p>}
              <div className="gp-hero-meta">
                <span>
                  <Users size={15} aria-hidden="true" />
                  {details.members.length} {details.members.length === 1 ? "member" : "members"}
                </span>
                <span>•</span>
                <span>
                  {details.sets.length} shared {details.sets.length === 1 ? "set" : "sets"}
                </span>
              </div>
            </div>

            <div className="gp-content-split">
              <section className="gp-main-section">
                <h2>Shared sets</h2>
                {details.sets.length > 0 ? (
                  <div className="gp-sets-grid">
                    {details.sets.map((set) => (
                      <div key={set.id} className="gp-set-card">
                        <span className="gp-set-name">{set.name}</span>
                        <div className="gp-set-foot">
                          <span>{cardLabel(set.cardCount)}</span>
                          <span>By {set.ownerName}</span>
                        </div>
                        <div className="gp-set-actions">
                          {set.cardCount > 0 && (
                            <Link
                              to="/sets/$setId/study"
                              params={{ setId: String(set.id) }}
                              className="gp-action-btn primary sm"
                            >
                              <GraduationCap size={14} aria-hidden="true" /> Study
                            </Link>
                          )}
                          <Link to="/sets/$setId" params={{ setId: String(set.id) }} className="gp-action-btn outline sm">
                            <Eye size={14} aria-hidden="true" /> View
                          </Link>
                          {canRemoveSet(set) && (
                            <button
                              type="button"
                              className="gp-icon-btn"
                              aria-label={`Remove ${set.name} from the group`}
                              title="Remove from group"
                              onClick={() =>
                                setConfirmation({
                                  title: "Remove this set from the group?",
                                  message: `Members will no longer be able to study “${set.name}” through this group. The set itself isn't deleted.`,
                                  action: "Remove set",
                                  run: () => perform(() => unshareSetFromGroup(details.id, set.id), "Could not remove that set."),
                                })
                              }
                            >
                              <X size={15} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="gp-empty-box">
                    <Layers size={24} aria-hidden="true" />
                    <p>No sets shared in this group yet.</p>
                    <button type="button" className="gp-link-btn" onClick={() => setModal("share")}>
                      Share your first set
                    </button>
                  </div>
                )}
              </section>

              <aside className="gp-sidebar-section">
                <h2>Members</h2>
                <div className="gp-members-list">
                  {details.members.map((member) => (
                    <div key={member.id} className="gp-member-row">
                      <div className="gp-avatar-sm" aria-hidden="true">
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="gp-member-name">
                        {member.username}
                        {member.id === userId && " (you)"}
                      </span>
                      {member.id === details.ownerId ? (
                        <Crown size={14} className="gp-owner-icon" aria-label="Owner" />
                      ) : (
                        isOwner && (
                          <button
                            type="button"
                            className="gp-icon-btn"
                            aria-label={`Remove ${member.username}`}
                            title="Remove from group"
                            onClick={() =>
                              setConfirmation({
                                title: `Remove ${member.username}?`,
                                message: `${member.username} will lose access to the sets shared in this group.`,
                                action: "Remove member",
                                run: () => perform(() => removeGroupMember(details.id, member.id), "Could not remove that member."),
                              })
                            }
                          >
                            <UserMinus size={15} aria-hidden="true" />
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>

                {details.invitations.length > 0 && (
                  <>
                    <h3 className="gp-subheading">Invited</h3>
                    <div className="gp-members-list">
                      {details.invitations.map((invitation) => (
                        <div key={invitation.id} className="gp-member-row pending">
                          <div className="gp-avatar-sm" aria-hidden="true">
                            {invitation.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="gp-member-name">{invitation.username}</span>
                          {isOwner && (
                            <button
                              type="button"
                              className="gp-icon-btn"
                              aria-label={`Cancel ${invitation.username}'s invitation`}
                              title="Cancel invitation"
                              onClick={() => void perform(() => cancelInvitation(invitation.id), "Could not cancel that invitation.")}
                            >
                              <X size={15} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </aside>
            </div>
          </div>
        )}

        {details && modal === "invite" && (
          <InviteModal group={details} onClose={() => setModal(null)} onInvited={() => void refresh()} />
        )}
        {details && modal === "share" && (
          <ShareSetModal group={details} onClose={() => setModal(null)} onShared={() => void refresh()} />
        )}
        {confirmation && <ConfirmModal confirmation={confirmation} onClose={() => setConfirmation(null)} />}
      </div>
    </AppLayout>
  );
}

function InviteModal({ group, onClose, onInvited }: { group: GroupDetails; onClose: () => void; onInvited: () => void }) {
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
    <GroupModal title={`Invite to ${group.name}`} onClose={onClose}>
      <div className="gp-modal-body">
        <div className="gp-search gp-user-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by username"
            aria-label="Search by username"
            value={query}
            maxLength={29}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {debouncedQuery.length === 0 ? (
          <p className="gp-modal-hint">Type a username to find people to invite.</p>
        ) : matches.isError ? (
          <p className="gp-modal-hint" role="alert">Could not search for users. Try again.</p>
        ) : matches.isPending ? (
          <p className="gp-modal-hint">Searching…</p>
        ) : matches.data.length === 0 ? (
          <p className="gp-modal-hint">No users start with “{debouncedQuery}”.</p>
        ) : (
          <div className="gp-share-list">
            {matches.data.map((match) => {
              const invited = match.isInvited || invitedNow.has(match.username);
              return (
                <div key={match.id} className="gp-share-item">
                  <div className="gp-user-match">
                    <div className="gp-avatar-sm" aria-hidden="true">
                      {match.username.charAt(0).toUpperCase()}
                    </div>
                    <strong>{match.username}</strong>
                  </div>
                  {match.isMember ? (
                    <span className="gp-status-text">Member</span>
                  ) : invited ? (
                    <span className="gp-status-text">Invited</span>
                  ) : (
                    <button
                      type="button"
                      className="gp-action-btn primary sm"
                      disabled={sending === match.username}
                      onClick={() => void invite(match.username)}
                    >
                      <UserPlus size={14} aria-hidden="true" /> Invite
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GroupModal>
  );
}

function ShareSetModal({ group, onClose, onShared }: { group: GroupDetails; onClose: () => void; onShared: () => void }) {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [sharing, setSharing] = useState<number | null>(null);
  const mySets = useQuery({ queryKey: ["my-sets", userId], queryFn: listMySets });
  const sharedIds = new Set(group.sets.map((set) => set.id));
  const available = mySets.data?.filter((set) => !sharedIds.has(Number(set.id))) ?? [];

  const share = async (setId: number, name: string) => {
    setSharing(setId);
    try {
      await shareSetWithGroup(group.id, setId);
      notifications.show({ color: "green", message: `Shared ${name} with ${group.name}.` });
      onShared();
      onClose();
    } catch (error) {
      notifyError(error, "Could not share that set.");
      setSharing(null);
    }
  };

  return (
    <GroupModal title={`Share a set with ${group.name}`} onClose={onClose}>
      <div className="gp-modal-body">
        {mySets.isError ? (
          <p className="gp-modal-hint" role="alert">Could not load your sets. Try again.</p>
        ) : mySets.isPending ? (
          <p className="gp-modal-hint">Loading your sets…</p>
        ) : available.length > 0 ? (
          <div className="gp-share-list">
            {available.map((set) => (
              <div key={set.id} className="gp-share-item">
                <div>
                  <strong>{set.name}</strong>
                  <span>{cardLabel(set.cardCount)}</span>
                </div>
                <button
                  type="button"
                  className="gp-action-btn primary sm"
                  disabled={sharing !== null}
                  onClick={() => void share(Number(set.id), set.name)}
                >
                  Share
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="gp-empty-box">
            <p>{mySets.data.length > 0 ? "All of your sets are already shared here." : "You don't have any sets to share yet."}</p>
            <button
              type="button"
              className="gp-link-btn"
              onClick={() => {
                onClose();
                void navigate({ to: "/create" });
              }}
            >
              Create a set
            </button>
          </div>
        )}
        <p className="gp-modal-hint">Everyone in the group can view and study the sets you share, even private ones.</p>
      </div>
    </GroupModal>
  );
}

function ConfirmModal({ confirmation, onClose }: { confirmation: Confirmation; onClose: () => void }) {
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
    <GroupModal title={confirmation.title} onClose={onClose}>
      <div className="gp-modal-body">
        <p className="gp-confirm-text">{confirmation.message}</p>
        <div className="gp-modal-actions">
          <button type="button" className="gp-action-btn outline" onClick={onClose} autoFocus>
            Cancel
          </button>
          <button type="button" className="gp-action-btn primary danger" disabled={working} onClick={() => void confirm()}>
            {confirmation.action}
          </button>
        </div>
      </div>
    </GroupModal>
  );
}
