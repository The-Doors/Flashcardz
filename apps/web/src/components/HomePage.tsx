import { useEffect, useMemo, useState } from "react";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "@tanstack/react-router";
import { deleteSet, listMySets } from "../lib/api-lib";
import { useAuth } from "../lib/auth";
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

const timeOf = (iso?: string | null): number => (iso ? new Date(iso).getTime() : 0);

/** Most recently studied first, then sets that were never studied, newest activity first. */
const compareSets = (a: FlashcardSet, b: FlashcardSet): number =>
  timeOf(b.lastStudiedAt) - timeOf(a.lastStudiedAt) ||
  timeOf(b.lastWorkedOn) - timeOf(a.lastWorkedOn);

export default function HomePage({
  sets: setsOverride,
  onOpenSet,
  onEditSet,
  onDeleteSet,
  onNavigate,
  ...layoutProps
}: HomePageProps) {
  const [pendingDelete, setPendingDelete] = useState<FlashcardSet | null>(null);
  const { userId } = useAuth();
  const [mySets, setMySets] = useState(EMPTY_SETS);
  const sets = setsOverride ?? mySets;
  const navigate = useNavigate();
  const openSet =
    onOpenSet ??
    ((set: FlashcardSet) => void navigate({ to: "/sets/$setId", params: { setId: String(set.id) } }));
  const editSet =
    onEditSet ??
    ((set: FlashcardSet) => void navigate({ to: "/sets/$setId/edit", params: { setId: String(set.id) } }));

  useEffect(() => {
    setMySets(EMPTY_SETS);
    if (!userId) return;
    let active = true;
    listMySets()
      .then((loaded) => {
        if (active) setMySets(loaded);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (active) notifications.show({ color: "red", message: "Could not load your sets." });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const sorted = useMemo(() => [...sets].sort(compareSets), [sets]);
  const recent = sorted.filter((set) => set.lastStudiedAt).slice(0, 3);

  const confirmDelete = async (): Promise<void> => {
    const target = pendingDelete;
    if (!target) return;

    setPendingDelete(null);
    if (onDeleteSet) {
      await onDeleteSet(target);
      return;
    }
    try {
      await deleteSet(Number(target.id));
      setMySets((current) => current.filter((set) => set.id !== target.id));
    } catch (error) {
      console.error(error);
      notifications.show({ color: "red", message: `Could not delete “${target.name}”.` });
    }
  };

  return (
    <AppLayout active="home" onNavigate={onNavigate} {...layoutProps}>
      <div className="hp-page">
        <RecentSets sets={recent} onOpen={openSet} />
        <AllSets
          sets={sorted}
          onOpen={openSet}
          onEdit={editSet}
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