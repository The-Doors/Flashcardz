import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Clock, ChevronRight, Layers } from "lucide-react";
import AppLayout from "./AppLayout";
import "./HomePage.css";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type FlashcardSet = {
  id: number | string;
  name: string;
  cardCount: number;
  lastWorkedOn: string;
};

type NavId =
  | "community"
  | "create"
  | "tutorial"
  | "groups"
  | "settings"
  | "home"
  | "profile";

type UserInfo = {
  name?: string;
  email?: string;
  avatarUrl?: string;
};

type ActivityData = Record<string, number>;

type AppLayoutProps = {
  appName?: string;
  user?: UserInfo;
  onSearch?: (query: string) => void;
  onLogout?: () => void;
  activity?: ActivityData;
};

type HomePageProps = AppLayoutProps & {
  sets?: FlashcardSet[];
  onOpenSet?: (set: FlashcardSet) => void;
  onEditSet?: (set: FlashcardSet) => void;
  onDeleteSet?: (set: FlashcardSet) => void | Promise<void>;
  onNavigate?: (id: NavId) => void;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

function formatWorkedOn(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS,
  );

  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

const fullDate = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });

const cardLabel = (n: number): string => `${n} ${n === 1 ? "card" : "cards"}`;

// Placeholder data so the page renders before the API is wired up.
const daysAgo = (n: number): string =>
  new Date(Date.now() - n * DAY_MS).toISOString();

const DEMO_SETS: FlashcardSet[] = [
  { id: 1, name: "Spanish: Common Verbs", cardCount: 48, lastWorkedOn: daysAgo(0) },
  { id: 2, name: "Organic Chemistry: Functional Groups", cardCount: 32, lastWorkedOn: daysAgo(1) },
  { id: 3, name: "AWS Cloud Practitioner", cardCount: 120, lastWorkedOn: daysAgo(3) },
  { id: 4, name: "US State Capitals", cardCount: 50, lastWorkedOn: daysAgo(12) },
  { id: 5, name: "Music Theory: Intervals", cardCount: 24, lastWorkedOn: daysAgo(45) },
  { id: 6, name: "Python Built-ins", cardCount: 1, lastWorkedOn: daysAgo(400) },
];

/* ------------------------------------------------------------------ */
/* Recent sets                                                         */
/* ------------------------------------------------------------------ */

type RecentSetsProps = {
  sets: FlashcardSet[];
  onOpen: (set: FlashcardSet) => void;
  onCreate: () => void;
};

function RecentSets({ sets, onOpen, onCreate }: RecentSetsProps) {
  return (
    <section className="hp-section" aria-labelledby="hp-recent-title">
      <h2 id="hp-recent-title" className="hp-title">Recent</h2>

      {sets.length === 0 ? (
        <div className="hp-empty">
          <Layers size={28} aria-hidden="true" />
          <h3>Start your first flashcard set</h3>
          <p>
            Your most recent sets will show up here so you can pick up right where you left off.
          </p>
          <button className="hp-primary" onClick={onCreate}>
            <Plus size={16} aria-hidden="true" /> Create a set
          </button>
        </div>
      ) : (
        <div className="hp-recent-grid">
          {sets.map((set) => (
            <button key={set.id} className="hp-recent-card" onClick={() => onOpen(set)}>
              <span className="hp-recent-name">{set.name}</span>
              <span className="hp-recent-meta">
                <span>{cardLabel(set.cardCount)}</span>
                <span className="hp-recent-when" title={fullDate(set.lastWorkedOn)}>
                  <Clock size={13} aria-hidden="true" /> {formatWorkedOn(set.lastWorkedOn)}
                </span>
              </span>
              <ChevronRight size={18} className="hp-recent-chevron" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Delete confirmation                                                 */
/* ------------------------------------------------------------------ */

type ConfirmDeleteProps = {
  set: FlashcardSet;
  onCancel: () => void;
  onConfirm: () => void;
};

function ConfirmDelete({ set, onCancel, onConfirm }: ConfirmDeleteProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="hp-overlay" onMouseDown={onCancel}>
      <div
        className="hp-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="hp-del-title"
        aria-describedby="hp-del-desc"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="hp-del-title">Delete this set?</h3>
        <p id="hp-del-desc">
          “{set.name}” and its {cardLabel(set.cardCount)} will be permanently deleted. This can’t be undone.
        </p>
        <div className="hp-dialog-actions">
          <button ref={cancelRef} className="hp-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="hp-danger" onClick={onConfirm}>Delete set</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* All sets                                                            */
/* ------------------------------------------------------------------ */

type AllSetsProps = {
  sets: FlashcardSet[];
  onOpen: (set: FlashcardSet) => void;
  onEdit: (set: FlashcardSet) => void;
  onRequestDelete: (set: FlashcardSet) => void;
};

function AllSets({ sets, onOpen, onEdit, onRequestDelete }: AllSetsProps) {
  return (
    <section className="hp-section" aria-labelledby="hp-all-title">
      <h2 id="hp-all-title" className="hp-title">
        All sets <span className="hp-count">{sets.length}</span>
      </h2>

      {sets.length === 0 ? (
        <p className="hp-muted">Sets you create or study will be listed here.</p>
      ) : (
        <div className="hp-list">
          <div className="hp-list-head" aria-hidden="true">
            <span>Name</span>
            <span>Last worked on</span>
            <span>Cards</span>
          </div>

          <ul>
            {sets.map((set) => (
              <li key={set.id} className="hp-row">
                <button className="hp-row-main" onClick={() => onOpen(set)}>
                  <span className="hp-row-name">{set.name}</span>
                  <span className="hp-row-date" title={fullDate(set.lastWorkedOn)}>
                    {formatWorkedOn(set.lastWorkedOn)}
                  </span>
                  <span className="hp-row-cards">{cardLabel(set.cardCount)}</span>
                </button>

                <div className="hp-row-actions">
                  <button
                    className="hp-icon"
                    onClick={() => onEdit(set)}
                    aria-label={`Edit ${set.name}`}
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="hp-icon hp-icon-danger"
                    onClick={() => onRequestDelete(set)}
                    aria-label={`Delete ${set.name}`}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page (default export)                                               */
/* ------------------------------------------------------------------ */

export default function HomePage({
  sets,
  onOpenSet,
  onEditSet,
  onDeleteSet,
  onNavigate,
  ...layoutProps
}: HomePageProps) {
  // When no `sets` prop is given, the page manages demo data itself.
  const [demoSets, setDemoSets] = useState<FlashcardSet[]>(DEMO_SETS);
  const [pendingDelete, setPendingDelete] = useState<FlashcardSet | null>(null);

  const data = sets ?? demoSets;

  const sorted = useMemo(
    () =>
      [...data].sort(
        (a, b) => new Date(b.lastWorkedOn).getTime() - new Date(a.lastWorkedOn).getTime(),
      ),
    [data],
  );
  const recent = sorted.slice(0, 3);

  const confirmDelete = async (): Promise<void> => {
    const target = pendingDelete;
    if (!target) return;

    setPendingDelete(null);
    await onDeleteSet?.(target);

    if (!sets) {
      setDemoSets((prev) => prev.filter((set) => set.id !== target.id));
    }
  };

  return (
    <AppLayout active="home" onNavigate={onNavigate} {...layoutProps}>
      <div className="hp-page">
        <RecentSets
          sets={recent}
          onOpen={(set) => onOpenSet?.(set)}
          onCreate={() => onNavigate?.("create")}
        />
        <AllSets
          sets={sorted}
          onOpen={(set) => onOpenSet?.(set)}
          onEdit={(set) => onEditSet?.(set)}
          onRequestDelete={setPendingDelete}
        />
      </div>

      {pendingDelete && (
        <ConfirmDelete
          set={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </AppLayout>
  );
}