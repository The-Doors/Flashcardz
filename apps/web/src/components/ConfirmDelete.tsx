import { useEffect, useRef } from "react";
import type { FlashcardSet } from "./types";
import { cardLabel } from "./formatters";
import "./ConfirmDelete.css";

type ConfirmDeleteProps = {
  set: FlashcardSet;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDelete({ set, onCancel, onConfirm }: ConfirmDeleteProps) {
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
    <div className="cd-overlay" onMouseDown={onCancel}>
      <div
        className="cd-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        aria-describedby="cd-desc"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="cd-title">Delete this set?</h3>
        <p id="cd-desc">
          “{set.name}” and its {cardLabel(set.cardCount)} will be permanently deleted. This can’t be undone.
        </p>
        <div className="cd-actions">
          <button ref={cancelRef} className="cd-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="cd-danger" onClick={onConfirm}>Delete set</button>
        </div>
      </div>
    </div>
  );
}
