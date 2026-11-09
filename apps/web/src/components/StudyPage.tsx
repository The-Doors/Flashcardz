import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import AppLayout from "./AppLayout";
import CardText from "./CardText";
import { cardLabel } from "./formatters";
import { loadStudyQueue, reviewCard, STUDY_ACTIVITY_QUERY_KEY, type StudyQueue } from "../lib/api-lib";
import { useAuth } from "../lib/auth";
import { Rating } from "../lib/generated/api-generated.ts";
import "./SetPage.css";

const RATINGS = [
  { label: "Again", value: Rating.NUMBER_1 },
  { label: "Hard", value: Rating.NUMBER_2 },
  { label: "Good", value: Rating.NUMBER_3 },
  { label: "Easy", value: Rating.NUMBER_4 },
];

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Could not load your cards.";

export default function StudyPage({ setId }: { setId: number }) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<StudyQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keepPracticing, setKeepPracticing] = useState(false);
  const shownAt = useRef(0);
  const studiedIds = useRef(new Set<number>());
  const sessionSize = useRef<number | null>(null);

  const showQueue = (next: StudyQueue) => {
    sessionSize.current ??= next.ready;
    setQueue(next);
    setRevealed(false);
    setError(null);
    shownAt.current = Date.now();
  };

  useEffect(() => {
    let active = true;
    loadStudyQueue(setId)
      .then((next) => {
        if (active) showQueue(next);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [setId, userId]);

  const rate = async (rating: Rating) => {
    if (!queue?.card || saving) return;
    setSaving(true);
    try {
      await reviewCard(setId, queue.card, rating, Date.now() - shownAt.current);
      studiedIds.current.add(queue.card.id);
      void queryClient.invalidateQueries({ queryKey: [STUDY_ACTIVITY_QUERY_KEY] });
    } catch (cause) {
      notifications.show({ color: "red", message: errorMessage(cause) });
    }
    // The API decides what comes next, including when a missed card returns.
    try {
      showQueue(await loadStudyQueue(setId));
    } catch (cause) {
      setError(errorMessage(cause));
    }
    setSaving(false);
  };

  // Cards the user is still learning keep coming back, so mark the end of the first pass.
  const reachedEndOfSet =
    !keepPracticing &&
    !!queue?.card &&
    studiedIds.current.has(queue.card.id) &&
    studiedIds.current.size >= (sessionSize.current ?? Infinity);

  const finishButton = (
    <Link to="/sets/$setId" params={{ setId: String(setId) }} className="sp-btn sp-btn-primary">
      Finish studying
    </Link>
  );

  return (
    <AppLayout active="home">
      <div className="sp-page sp-study">
        <div className="sp-topbar">
          <Link to="/sets/$setId" params={{ setId: String(setId) }} className="sp-btn">
            <ArrowLeft size={16} aria-hidden="true" /> Back to set
          </Link>
          {queue?.card && !reachedEndOfSet && <span className="sp-count">{queue.remaining} left</span>}
        </div>

        {error ? (
          <p className="sp-message" role="alert">{error}</p>
        ) : !queue ? (
          <p className="sp-message">Loading…</p>
        ) : !queue.card ? (
          <div className="sp-done">
            <h1 className="sp-title">{queue.remaining === 0 ? "All caught up" : "Done for now"}</h1>
            <p className="sp-description">
              {queue.remaining === 0
                ? "You've finished everything due today."
                : `${cardLabel(queue.remaining)} will be ready again later today.`}
            </p>
            {finishButton}
          </div>
        ) : reachedEndOfSet ? (
          <div className="sp-done">
            <h1 className="sp-title">You reached the end of the set</h1>
            <p className="sp-description">
              Your progress is saved. Cards you're still learning will come back the next time you study.
            </p>
            <div className="sp-actions">
              <button
                type="button"
                className="sp-btn"
                onClick={() => {
                  setKeepPracticing(true);
                  shownAt.current = Date.now();
                }}
              >
                Keep practicing
              </button>
              {finishButton}
            </div>
          </div>
        ) : (
          <>
            <article className="sp-flashcard">
              <CardText text={queue.card.front} />
              {revealed && (
                <>
                  <hr />
                  <CardText text={queue.card.back} />
                </>
              )}
            </article>

            {revealed ? (
              <div className="sp-ratings">
                {RATINGS.map(({ label, value }) => (
                  <button key={value} type="button" className="sp-btn" disabled={saving} onClick={() => void rate(value)}>
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" className="sp-btn sp-btn-primary sp-reveal" onClick={() => setRevealed(true)}>
                Show answer
              </button>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
