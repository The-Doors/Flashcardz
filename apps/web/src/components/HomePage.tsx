import { useMemo, useState } from "react";
import AppLayout from "./AppLayout";
import RecentSets from "./RecentSets";
import AllSets from "./AllSets";
import ConfirmDelete from "./ConfirmDelete";
import { DAY_MS } from "./formatters";
import type {
  ActivityData,
  FlashcardSet,
  NavId,
  SignInPayload,
  SignUpPayload,
  UserInfo,
} from "./types";
import "./HomePage.css";

type HomePageProps = {
  appName?: string;
  user?: UserInfo;
  onSearch?: (query: string) => void;
  onLogout?: () => void;
  onSignIn?: (data: SignInPayload) => void | Promise<void>;
  onSignUp?: (data: SignUpPayload) => void | Promise<void>;
  activity?: ActivityData;
  sets?: FlashcardSet[];
  onOpenSet?: (set: FlashcardSet) => void;
  onEditSet?: (set: FlashcardSet) => void;
  onDeleteSet?: (set: FlashcardSet) => void | Promise<void>;
  onNavigate?: (id: NavId) => void;
};

// Placeholder data used only while the `sets` prop is undefined (API not wired up).
// Pass `sets={[]}` to show an empty page.
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

export default function HomePage({
  sets,
  onOpenSet,
  onEditSet,
  onDeleteSet,
  onNavigate,
  ...layoutProps
}: HomePageProps) {
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
        <RecentSets sets={recent} onOpen={(set) => onOpenSet?.(set)} />
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
