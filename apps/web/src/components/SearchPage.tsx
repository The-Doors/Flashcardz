import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import AppLayout from "./AppLayout";
import { RecentSetCard } from "./RecentSets";
import type { FlashcardSet } from "./types";
import { searchSets } from "../lib/api-lib";
import { useAuth } from "../lib/auth";
import "./SetPage.css";

type SearchResults = { query: string; total: number; sets: FlashcardSet[] };

export default function SearchPage({ query }: { query: string }) {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [results, setResults] = useState<SearchResults | null>(null);
  const [failed, setFailed] = useState(false);
  const search = query.trim();

  useEffect(() => {
    if (!search) return;
    let active = true;
    setFailed(false);
    searchSets(search)
      .then((found) => {
        if (active) setResults({ query: search, ...found });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [search, userId]);

  const current = results?.query === search ? results : null;

  return (
    <AppLayout active="home">
      <div className="sp-page">
        <header>
          <h1 className="sp-title">{search ? `Results for “${search}”` : "Search"}</h1>
          {current && current.total > current.sets.length && (
            <p className="sp-count">Showing the {current.sets.length} newest of {current.total} matches.</p>
          )}
        </header>

        {!search ? (
          <p className="sp-message">Use the search bar above to find flashcard sets.</p>
        ) : failed ? (
          <p className="sp-message" role="alert">Search failed. Please try again.</p>
        ) : !current ? (
          <p className="sp-message">Searching…</p>
        ) : current.sets.length === 0 ? (
          <p className="sp-message">No sets match your search.</p>
        ) : (
          <div className="rs-grid">
            {current.sets.map((set) => (
              <RecentSetCard
                key={set.id}
                set={set}
                onOpen={() => void navigate({ to: "/sets/$setId", params: { setId: String(set.id) } })}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
