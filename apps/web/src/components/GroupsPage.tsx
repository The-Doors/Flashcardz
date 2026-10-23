import { useState, useMemo, type FormEvent } from "react";
import {
  Users,
  Plus,
  Search,
  Layers,
  UserPlus,
  UserCheck,
  ChevronRight,
  ArrowLeft,
  Share2,
  X,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import AppLayout from "./AppLayout";
import { cardLabel } from "./formatters";
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
  onCreateGroup?: (data: { name: string; description: string; category: string }) => void | Promise<void>;
  onJoinGroup?: (groupId: string | number) => void | Promise<void>;
  onLeaveGroup?: (groupId: string | number) => void | Promise<void>;
  onShareSet?: (groupId: string | number, set: FlashcardSet) => void | Promise<void>;
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
      <div className="gp-page">
        {selectedGroup ? (
          /* --- GROUP DETAIL VIEW --- */
          <div className="gp-detail">
            <div className="gp-detail-header-bar">
              <button
                type="button"
                className="gp-back-btn"
                onClick={() => setSelectedGroup(null)}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Back to groups</span>
              </button>

              <div className="gp-detail-actions">
                {selectedGroup.isMember ? (
                  <>
                    <button
                      type="button"
                      className="gp-action-btn primary"
                      onClick={() => setShowShareModal(true)}
                    >
                      <Share2 size={15} aria-hidden="true" />
                      <span>Share set</span>
                    </button>
                    <button
                      type="button"
                      className="gp-action-btn outline danger"
                      onClick={() => {
                        onLeaveGroup?.(selectedGroup.id);
                        setSelectedGroup({ ...selectedGroup, isMember: false, memberCount: selectedGroup.memberCount - 1 });
                      }}
                    >
                      Leave group
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="gp-action-btn primary"
                    onClick={() => {
                      onJoinGroup?.(selectedGroup.id);
                      setSelectedGroup({ ...selectedGroup, isMember: true, memberCount: selectedGroup.memberCount + 1 });
                    }}
                  >
                    <UserPlus size={15} aria-hidden="true" />
                    <span>Join group</span>
                  </button>
                )}
              </div>
            </div>

            <div className="gp-hero-card">
              <span className="gp-badge">{selectedGroup.category}</span>
              <h1 className="gp-hero-title">{selectedGroup.name}</h1>
              <p className="gp-hero-desc">{selectedGroup.description}</p>
              <div className="gp-hero-meta">
                <span>
                  <Users size={15} aria-hidden="true" />
                  {selectedGroup.memberCount} members
                </span>
                <span>•</span>
                <span>{selectedGroup.sharedSets.length} shared sets</span>
              </div>
            </div>

            <div className="gp-content-split">
              {/* Left: Shared Sets in this group */}
              <div className="gp-main-section">
                <h2>Shared Flashcard Sets</h2>
                {selectedGroup.sharedSets.length > 0 ? (
                  <div className="gp-sets-grid">
                    {selectedGroup.sharedSets.map((set) => (
                      <div key={set.id} className="gp-set-card">
                        <span className="gp-set-name">{set.name}</span>
                        <div className="gp-set-foot">
                          <span>{cardLabel(set.cardCount)}</span>
                          <span>Shared by {set.sharedBy}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="gp-empty-box">
                    <Layers size={24} aria-hidden="true" />
                    <p>No sets shared in this group yet.</p>
                    {selectedGroup.isMember && (
                      <button
                        type="button"
                        className="gp-link-btn"
                        onClick={() => setShowShareModal(true)}
                      >
                        Share your first set
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Members list */}
              <div className="gp-sidebar-section">
                <h2>Members</h2>
                <div className="gp-members-list">
                  {selectedGroup.members.map((m) => (
                    <div key={m.id} className="gp-member-row">
                      <div className="gp-avatar-sm">{m.name.charAt(0)}</div>
                      <span className="gp-member-name">{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* --- GROUPS LIST VIEW --- */
          <div className="gp-list-view">
            <div className="gp-header">
              <div>
                <h1 className="gp-title">Study Groups</h1>
                <p className="gp-subtitle">
                  Connect with peers, collaborate, and share flashcard sets together.
                </p>
              </div>

              <button
                type="button"
                className="gp-create-btn"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={16} aria-hidden="true" />
                <span>Create Group</span>
              </button>
            </div>

            {/* Controls Bar: Tabs & Search */}
            <div className="gp-controls">
              <div className="gp-tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={tab === "my"}
                  className={`gp-tab ${tab === "my" ? "active" : ""}`}
                  onClick={() => setTab("my")}
                >
                  My Groups
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "discover"}
                  className={`gp-tab ${tab === "discover" ? "active" : ""}`}
                  onClick={() => setTab("discover")}
                >
                  Discover All
                </button>
              </div>

              <div className="gp-search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Groups Grid */}
            {filteredGroups.length > 0 ? (
              <div className="gp-grid">
                {filteredGroups.map((group) => (
                  <div
                    key={group.id}
                    className="gp-card"
                    onClick={() => setSelectedGroup(group)}
                  >
                    <div className="gp-card-top">
                      <span className="gp-badge">{group.category}</span>
                      {group.isMember ? (
                        <span className="gp-member-pill">
                          <UserCheck size={12} aria-hidden="true" /> Member
                        </span>
                      ) : (
                        <span className="gp-members-count">
                          <Users size={13} aria-hidden="true" /> {group.memberCount}
                        </span>
                      )}
                    </div>

                    <h3 className="gp-card-name">{group.name}</h3>
                    <p className="gp-card-desc">{group.description}</p>

                    <div className="gp-card-foot">
                      <span>{group.sharedSets.length} shared sets</span>
                      <ChevronRight size={16} className="gp-chevron" aria-hidden="true" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="gp-empty-state">
                <Users size={32} aria-hidden="true" />
                <h3>No study groups found</h3>
                <p>
                  {tab === "my"
                    ? "You haven't joined any groups yet. Explore the 'Discover All' tab to find communities!"
                    : "No groups match your search criteria."}
                </p>
                {tab === "my" && (
                  <button
                    type="button"
                    className="gp-create-btn"
                    onClick={() => setTab("discover")}
                  >
                    Discover groups
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* CREATE GROUP MODAL */}
        {showCreateModal && (
          <div className="gp-modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="gp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="gp-modal-head">
                <h2>Create Study Group</h2>
                <button
                  type="button"
                  className="gp-close-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="gp-modal-form">
                <div className="gp-field">
                  <label>Group Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Advanced Calculus Study Circle"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                  />
                </div>

                <div className="gp-field">
                  <label>Description</label>
                  <textarea
                    placeholder="What will members focus on in this group?"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="gp-field">
                  <label>Category</label>
                  <select
                    value={newGroupCategory}
                    onChange={(e) => setNewGroupCategory(e.target.value)}
                  >
                    <option value="Tech & IT">Tech & IT</option>
                    <option value="Science">Science</option>
                    <option value="Languages">Languages</option>
                    <option value="Humanities">Humanities</option>
                    <option value="Math">Math</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="gp-modal-actions">
                  <button
                    type="button"
                    className="gp-action-btn outline"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="gp-action-btn primary">
                    Create group
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SHARE SET MODAL */}
        {showShareModal && selectedGroup && (
          <div className="gp-modal-overlay" onClick={() => setShowShareModal(false)}>
            <div className="gp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="gp-modal-head">
                <h2>Share Set to {selectedGroup.name}</h2>
                <button
                  type="button"
                  className="gp-close-btn"
                  onClick={() => setShowShareModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="gp-modal-body">
                {mySets.length > 0 ? (
                  <div className="gp-share-list">
                    {mySets.map((set) => (
                      <div key={set.id} className="gp-share-item">
                        <div>
                          <strong>{set.name}</strong>
                          <span>{cardLabel(set.cardCount)}</span>
                        </div>
                        <button
                          type="button"
                          className="gp-action-btn primary sm"
                          onClick={() => {
                            onShareSet?.(selectedGroup.id, set);
                            setShowShareModal(false);
                          }}
                        >
                          Share
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="gp-empty-box">
                    <p>You have no personal sets created yet to share.</p>
                    <button
                      type="button"
                      className="gp-link-btn"
                      onClick={() => {
                        setShowShareModal(false);
                        void routerNavigate({ to: "/create" });
                      }}
                    >
                      Create a set now
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}