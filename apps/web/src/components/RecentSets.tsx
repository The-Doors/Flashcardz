import { Clock, ChevronRight } from "lucide-react";
import type { FlashcardSet } from "./types";
import { cardLabel, formatWorkedOn, fullDate } from "./formatters";
import "./RecentSets.css";

type RecentSetCardProps = {
  set: FlashcardSet;
  onOpen: (set: FlashcardSet) => void;
};

export function RecentSetCard({ set, onOpen }: RecentSetCardProps) {
  return (
    <button className="rs-card" onClick={() => onOpen(set)}>
      <span className="rs-name">{set.name}</span>
      <span className="rs-meta">
        <span>{cardLabel(set.cardCount)}</span>
        <span className="rs-when" title={fullDate(set.lastWorkedOn)}>
          <Clock size={13} aria-hidden="true" /> {formatWorkedOn(set.lastWorkedOn)}
        </span>
      </span>
      <ChevronRight size={18} className="rs-chevron" aria-hidden="true" />
    </button>
  );
}

type RecentSetsProps = {
  sets: FlashcardSet[];
  onOpen: (set: FlashcardSet) => void;
};

/** Renders nothing when there are no sets. */
export default function RecentSets({ sets, onOpen }: RecentSetsProps) {
  if (sets.length === 0) return null;

  return (
    <section className="rs-section" aria-labelledby="rs-title">
      <h2 id="rs-title" className="rs-title">Recent</h2>
      <div className="rs-grid">
        {sets.map((set) => (
          <RecentSetCard key={set.id} set={set} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
