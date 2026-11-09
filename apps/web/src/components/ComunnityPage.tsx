import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import { loadCommunitySets } from "../lib/api-lib";
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
import "./SetPage.css";

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

const SORT_OPTIONS: { id: CommunitySort; label: string; icon: typeof TrendingUp }[] = [
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
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const community = useInfiniteQuery({
    queryKey: ["community-sets", sortBy],
    queryFn: ({ pageParam }) => loadCommunitySets(sortBy, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
  });
  const sets = community.data?.pages.flatMap((page) => page.sets) ?? EMPTY_SETS;

  const openSet =
    onOpenSet ??
    ((set: CommunitySet) => void navigate({ to: "/sets/$setId", params: { setId: String(set.id) } }));

  // Close the sort popover on outside click or Escape
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

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.id === sortBy)?.label ?? "Most popular";

  return (
    <AppLayout active="community" onNavigate={onNavigate} {...layoutProps}>
      <div className="cp-page">
        {/* Page Header + Sort Button */}
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
              <span>Sort</span>
              <span className="cp-filter-summary">{currentSortLabel}</span>
            </button>

            {filterOpen && (
              <div className="cp-filter-menu" role="dialog" aria-label="Sort sets">
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
              </div>
            )}
          </div>
        </div>

        {community.isPending ? (
          <p className="sp-message">Loading…</p>
        ) : community.isError ? (
          <p className="sp-message" role="alert">Could not load community sets. Refresh to try again.</p>
        ) : sets.length > 0 ? (
          <>
            <div className="cp-grid">
              {sets.map((set) => (
                <button
                  key={set.id}
                  className="cp-card"
                  onClick={() => openSet(set)}
                >
                  <div className="cp-card-top">
                    <span
                      className="cp-studies"
                      title={`${set.studyCount} ${set.studyCount === 1 ? "person has" : "people have"} studied this`}
                    >
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

            {community.hasNextPage && (
              <div className="cp-load-more">
                <button
                  type="button"
                  className="sp-btn"
                  disabled={community.isFetchingNextPage}
                  onClick={() => void community.fetchNextPage()}
                >
                  {community.isFetchingNextPage ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="cp-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="cp-card cp-card-empty" aria-hidden={i > 0}>
                {i === 0 && (
                  <div className="cp-empty-msg">
                    <Layers size={22} aria-hidden="true" />
                    <strong>No community sets found</strong>
                    <span>Community flashcard sets will appear here.</span>
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
