import { useMemo, useState } from "react";
import AppLayout from "./AppLayout";
import RecentSets from "./RecentSets";
import AllSets from "./AllSets";
import ConfirmDelete from "./ConfirmDelete";
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

const EMPTY_SETS: FlashcardSet[] = [];

export default function HomePage({
  sets = EMPTY_SETS,
  onOpenSet,
  onEditSet,
  onDeleteSet,
  onNavigate,
  ...layoutProps
}: HomePageProps) {
  const [pendingDelete, setPendingDelete] = useState<FlashcardSet | null>(null);

  const sorted = useMemo(
    () =>
      [...sets].sort(
        (a, b) => new Date(b.lastWorkedOn).getTime() - new Date(a.lastWorkedOn).getTime(),
      ),
    [sets],
  );
  const recent = sorted.slice(0, 3);

  const confirmDelete = async (): Promise<void> => {
    const target = pendingDelete;
    if (!target) return;

    setPendingDelete(null);
    await onDeleteSet?.(target);
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