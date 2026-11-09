import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { notifications } from "@mantine/notifications";
import { ArrowLeft, Copy, GraduationCap, Pencil } from "lucide-react";
import AppLayout from "./AppLayout";
import CardText from "./CardText";
import { cardLabel } from "./formatters";
import { copySet, loadSet, type SetDetails } from "../lib/api-lib";
import { useAuth } from "../lib/auth";
import "./SetPage.css";

export default function SetPage({ setId }: { setId: number }) {
  const { userId } = useAuth();
  // undefined while loading, null when the set can't be shown.
  const [set, setSet] = useState<SetDetails | null>();
  const [failed, setFailed] = useState(false);
  const [copying, setCopying] = useState(false);
  const navigate = useNavigate();

  const copyToMySets = async () => {
    setCopying(true);
    try {
      const copyId = await copySet(setId);
      void navigate({ to: "/sets/$setId", params: { setId: String(copyId) } });
    } catch (error) {
      console.error(error);
      notifications.show({ color: "red", message: "Could not copy this set. Please try again." });
    }
    setCopying(false);
  };

  useEffect(() => {
    let active = true;
    setFailed(false);
    loadSet(setId)
      .then((loaded) => {
        if (active) setSet(loaded);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [setId, userId]);

  return (
    <AppLayout active="home">
      <div className="sp-page">
        <div className="sp-topbar">
          <Link to="/" className="sp-btn">
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </Link>
          {set && userId && set.ownerId !== userId && (
            <button type="button" className="sp-btn sp-btn-primary" disabled={copying} onClick={() => void copyToMySets()}>
              <Copy size={16} aria-hidden="true" /> {copying ? "Copying…" : "Copy to my sets"}
            </button>
          )}
          {set && set.ownerId === userId && (
            <div className="sp-actions">
              <Link to="/sets/$setId/edit" params={{ setId: String(setId) }} className="sp-btn">
                <Pencil size={16} aria-hidden="true" /> Edit
              </Link>
              {set.cards.length > 0 && (
                <Link to="/sets/$setId/study" params={{ setId: String(setId) }} className="sp-btn sp-btn-primary">
                  <GraduationCap size={16} aria-hidden="true" /> Study
                </Link>
              )}
            </div>
          )}
        </div>

        {failed ? (
          <p className="sp-message" role="alert">Could not load this set. Refresh to try again.</p>
        ) : set === undefined ? (
          <p className="sp-message">Loading…</p>
        ) : set === null ? (
          <p className="sp-message">This set doesn't exist, or you need to sign in to see it.</p>
        ) : (
          <>
            <header>
              <h1 className="sp-title">{set.name}</h1>
              {set.description && <p className="sp-description">{set.description}</p>}
              <p className="sp-count">
                {cardLabel(set.cards.length)}
                {!set.isPublic && " · Private"}
              </p>
            </header>

            <div className="sp-card-list">
              {set.cards.map((card) => (
                <article key={card.id} className="sp-card-row">
                  <CardText text={card.front} />
                  <CardText text={card.back} />
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
