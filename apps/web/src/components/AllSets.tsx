import { Pencil, Trash2 } from "lucide-react";
import type { FlashcardSet } from "./types";
import { cardLabel, formatWorkedOn, fullDate } from "./formatters";
import "./AllSets.css";

type SetRowProps = {
  set: FlashcardSet;
  onOpen: (set: FlashcardSet) => void;
  onEdit: (set: FlashcardSet) => void;
  onRequestDelete: (set: FlashcardSet) => void;
};

export function SetRow({ set, onOpen, onEdit, onRequestDelete }: SetRowProps) {
  return (
    <li className="as-row">
      <button className="as-row-main" onClick={() => onOpen(set)}>
        <span className="as-row-name">{set.name}</span>
        <span className="as-row-date" title={fullDate(set.lastWorkedOn)}>
          {formatWorkedOn(set.lastWorkedOn)}
        </span>
        <span className="as-row-cards">{cardLabel(set.cardCount)}</span>
      </button>

      <div className="as-row-actions">
        <button
          className="as-icon"
          onClick={() => onEdit(set)}
          aria-label={`Edit ${set.name}`}
          title="Edit"
        >
          <Pencil size={16} />
        </button>
        <button
          className="as-icon as-icon-danger"
          onClick={() => onRequestDelete(set)}
          aria-label={`Delete ${set.name}`}
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}

type AllSetsProps = {
  sets: FlashcardSet[];
  onOpen: (set: FlashcardSet) => void;
  onEdit: (set: FlashcardSet) => void;
  onRequestDelete: (set: FlashcardSet) => void;
};

/** Renders nothing when there are no sets. */
export default function AllSets({ sets, onOpen, onEdit, onRequestDelete }: AllSetsProps) {
  if (sets.length === 0) return null;

  return (
    <section className="as-section" aria-labelledby="as-title">
      <h2 id="as-title" className="as-title">
        All sets <span className="as-count">{sets.length}</span>
      </h2>

      <div className="as-list">
        <div className="as-list-head" aria-hidden="true">
          <span>Name</span>
          <span>Last worked on</span>
          <span>Cards</span>
        </div>

        <ul>
          {sets.map((set) => (
            <SetRow
              key={set.id}
              set={set}
              onOpen={onOpen}
              onEdit={onEdit}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
