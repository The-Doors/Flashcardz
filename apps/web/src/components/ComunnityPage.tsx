import { useEffect, useMemo, useRef, useState } from "react";
import {
  SlidersHorizontal,
  TrendingUp,
  Sparkles,
  Layers,
  Users,
  User,
  ChevronRight,
  Check,
} from "lucide-react";
import AppLayout from "./AppLayout";
import { cardLabel } from "./formatters";
import type {
  ActivityData,
  CommunitySet,
  CommunitySort,
  NavId,
  SetCategory,
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
  sets?: CommunitySet[];
  onOpenSet?: (set: CommunitySet) => void;
  onNavigate?: (id: NavId) => void;
};

const CATEGORIES: SetCategory[] = [
  "All",
  "Languages",
  "Science",
  "Tech & IT",
  "Humanities",
  "Math",
  "Other",
];

const SORT_OPTIONS: { id: CommunitySort; label: string; icon: typeof TrendingUp }[] = [
  { id: "popular", label: "Most popular", icon: TrendingUp },
  { id: "newest", label: "Newest", icon: Sparkles },
  { id: "cards", label: "Most cards", icon: Layers },
];

const EMPTY_SETS: CommunitySet[] = [];

export default function CommunityPage({
  sets = EMPTY_SETS,
  onOpenSet,
  onNavigate,
  ...layoutProps
}: CommunityPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<SetCategory>("All");
  const [sortBy, setSortBy] = useState<CommunitySort>("popular");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close the filter popover on outside click or Escape
  useEffect(() => {
    if (!filterOpen) return;
    const onClick = (e: globalThis.MouseEvent) => {
      if (
        filterRef.current &&
        e.target instanceof Node &&
        !filterRef.current.contains(e.target)
      ) {
        setFilterOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFilterOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

  const filteredSets = useMemo(() => {
    const byCategory =
      selectedCategory === "All"
        ? sets
        : sets.filter((s) => s.category === selectedCategory);

    return [...byCategory].sort((a, b) => {
      if (sortBy === "popular") return b.studyCount - a.studyCount;
      if (sortBy === "cards") return b.cardCount - a.cardCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [sets, selectedCategory, sortBy]);

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.id === sortBy)?.label ?? "Most popular";

  const activeFilterCount =
    (selectedCategory !== "All" ? 1 : 0) + (sortBy !== "popular" ? 1 : 0);

  return (
    <AppLayout active="community" onNavigate={onNavigate} {...layoutProps}>
      <div className="cp-page">
        {/* Page Header + Filter Button */}
        <div className="cp-header">
          <div>
            <h1 className="cp-title">Community Sets</h1>
            <p className="cp-subtitle">
              Discover and study flashcard sets shared by learners across the community.
            </p>
          </div>

          <div className="cp-filter-wrap" ref={filterRef}>
            <button
              type="button"
              className={`cp-filter-btn ${filterOpen ? "active" : ""}`}
              onClick={() => setFilterOpen((o) => !o)}
              aria-haspopup="dialog"
              aria-expanded={filterOpen}
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span>Filter & Sort</span>
              <span className="cp-filter-summary">
                {currentSortLabel}
                {selectedCategory !== "All" ? ` · ${selectedCategory}` : ""}
              </span>
              {activeFilterCount > 0 && (
                <span className="cp-filter-badge">{activeFilterCount}</span>
              )}
            </button>

            {filterOpen && (
              <div className="cp-filter-menu" role="dialog" aria-label="Filter and sort sets">
                <div className="cp-filter-group">
                  <span className="cp-filter-label">Sort by</span>
                  <div className="cp-filter-options">
                    {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        className={`cp-menu-item ${sortBy === id ? "selected" : ""}`}
                        onClick={() => setSortBy(id)}
                      >
                        <Icon size={15} aria-hidden="true" />
                        <span>{label}</span>
                        {sortBy === id && <Check size={15} className="cp-check" />}
                      </button>
                    ))}
                  </div>
                </div>

                <hr className="cp-divider" />

                <div className="cp-filter-group">
                  <span className="cp-filter-label">Type of set</span>
                  <div className="cp-type-grid">
                    {CATEGORIES.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={`cp-type-chip ${
                          selectedCategory === category ? "selected" : ""
                        }`}
                        onClick={() => setSelectedCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    className="cp-reset-btn"
                    onClick={() => {
                      setSelectedCategory("All");
                      setSortBy("popular");
                    }}
                  >
                    Reset to default
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Category Bar */}
        <div className="cp-categories" role="tablist" aria-label="Set categories">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              role="tab"
              aria-selected={selectedCategory === category}
              className={`cp-category-pill ${
                selectedCategory === category ? "active" : ""
              }`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Grid of Sets or Empty Placeholders */}
        {filteredSets.length > 0 ? (
          <div className="cp-grid">
            {filteredSets.map((set) => (
              <button
                key={set.id}
                className="cp-card"
                onClick={() => onOpenSet?.(set)}
              >
                <div className="cp-card-top">
                  <span className="cp-badge">{set.category}</span>
                  <span className="cp-studies" title={`${set.studyCount} learners studied this`}>
                    <Users size={13} aria-hidden="true" />
                    {set.studyCount.toLocaleString()}
                  </span>
                </div>

                <span className="cp-card-name">{set.name}</span>
                {set.description && (
                  <span className="cp-card-desc">{set.description}</span>
                )}

                <div className="cp-card-foot">
                  <span className="cp-author">
                    <User size={13} aria-hidden="true" />
                    {set.author}
                  </span>
                  <span className="cp-cards-count">{cardLabel(set.cardCount)}</span>
                </div>

                <ChevronRight size={18} className="cp-chevron" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <div className="cp-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="cp-card cp-card-empty" aria-hidden={i > 0}>
                {i === 0 && (
                  <div className="cp-empty-msg">
                    <Layers size={22} aria-hidden="true" />
                    <strong>No community sets found</strong>
                    <span>
                      {selectedCategory !== "All"
                        ? `No sets in "${selectedCategory}" yet.`
                        : "Community flashcard sets will appear here."}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}