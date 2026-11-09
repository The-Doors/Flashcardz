import { useEffect, useState, useRef, type FormEvent } from "react";
import { Plus, Trash2, ArrowLeft, Save, Bold, Italic, Code, List } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import AppLayout from "./AppLayout";
import {
  isCardTooLong,
  loadSet,
  type NewFlashcardSet,
  saveSet,
  type SetDetails,
  updateSet,
} from "../lib/api-lib";
import { useAuth } from "../lib/auth";
import type {
  ActivityData,
  NavId,
  SignInPayload,
  SignUpPayload,
  UserInfo,
} from "./types";
import "./CreatePage.css";
import "./SetPage.css";

type FlashcardInput = {
  id: string;
  /** Set when this card already exists on the server. */
  serverId?: number;
  front: string;
  back: string;
};

type CreatePageProps = {
  appName?: string;
  user?: UserInfo;
  onSearch?: (query: string) => void;
  onLogout?: () => void;
  onSignIn?: (data: SignInPayload) => void | Promise<void>;
  onSignUp?: (data: SignUpPayload) => void | Promise<void>;
  activity?: ActivityData;
  onSaveSet?: (data: NewFlashcardSet) => void | Promise<void>;
  onNavigate?: (id: NavId) => void;
  /** When set, the form edits this existing set instead of creating one. */
  setId?: number;
};

const genId = () => Math.random().toString(36.25).substring(2, 9);

export default function CreatePage({
  onSaveSet = saveSet,
  onNavigate,
  setId,
  ...layoutProps
}: CreatePageProps) {
  const routerNavigate = useNavigate();
  const { userId } = useAuth();
  const isEditing = setId !== undefined;
  const [original, setOriginal] = useState<SetDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [cards, setCards] = useState<FlashcardInput[]>([
    { id: genId(), front: "", back: "" },
    { id: genId(), front: "", back: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep track of textarea refs for Markdown toolbar insertion
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const showSavedSet = (set: SetDetails) => {
    setOriginal(set);
    setName(set.name);
    setDescription(set.description ?? "");
    setIsPrivate(!set.isPublic);
    setCards(set.cards.map((card) => ({ id: genId(), serverId: card.id, front: card.front, back: card.back })));
  };

  useEffect(() => {
    if (setId === undefined) return;
    let active = true;
    setLoadError(null);
    loadSet(setId)
      .then((set) => {
        if (!active) return;
        if (set) showSavedSet(set);
        else setLoadError("This set doesn't exist, or you need to sign in to edit it.");
      })
      .catch((cause: unknown) => {
        console.error(cause);
        if (active) setLoadError("Could not load this set. Refresh to try again.");
      });
    return () => {
      active = false;
    };
  }, [setId, userId]);

  const blockedMessage = !isEditing
    ? null
    : (loadError ??
      (!original ? "Loading…" : original.ownerId !== userId ? "You can only edit your own sets." : null));

  const leavePage = () =>
    setId === undefined
      ? void routerNavigate({ to: "/" })
      : void routerNavigate({ to: "/sets/$setId", params: { setId: String(setId) } });

  const addCard = () => {
    setCards((prev) => [...prev, { id: genId(), front: "", back: "" }]);
  };

  const updateCard = (id: string, field: "front" | "back", value: string) => {
    setCards((prev) =>
      prev.map((card) => (card.id === id ? { ...card, [field]: value } : card)),
    );
  };

  const insertMarkdown = (cardId: string, field: "front" | "back", syntax: string, wrap = true) => {
    const textarea = textareaRefs.current[`${cardId}-${field}`];
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    let newValue = value;
    let newCursorPos = start;

    if (wrap) {
      const selected = value.substring(start, end);
      newValue = value.substring(0, start) + syntax + selected + syntax + value.substring(end);
      newCursorPos = start + syntax.length + selected.length;
    } else {
      // Prefix syntax (e.g. lists "- ")
      newValue = value.substring(0, start) + syntax + value.substring(start);
      newCursorPos = start + syntax.length;
    }

    updateCard(cardId, field, newValue);

    // Restore focus and cursor position after state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const removeCard = (id: string) => {
    if (cards.length <= 1) return;
    setCards((prev) => prev.filter((card) => card.id !== id));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!name.trim()) {
      setError("Please give your set a title.");
      return;
    }

    const incompleteIndex = cards.findIndex((c) => !c.front.trim() !== !c.back.trim());
    if (incompleteIndex !== -1) {
      setError(`Card ${incompleteIndex + 1} needs both a front and a back.`);
      return;
    }

    const tooLongIndex = cards.findIndex(isCardTooLong);
    if (tooLongIndex !== -1) {
      setError(`Card ${tooLongIndex + 1} is too long. Cards can be up to about 10,000 characters.`);
      return;
    }

    const validCards = cards.filter((c) => c.front.trim());
    if (validCards.length === 0) {
      setError("Add at least one complete flashcard (front and back).");
      return;
    }

    setError(null);
    setSubmitting(true);

    const data: NewFlashcardSet = {
      name: name.trim(),
      description: description.trim(),
      isPublic: !isPrivate,
      cards: validCards.map(({ serverId, front, back }) => ({
        id: serverId,
        front: front.trim(),
        back: back.trim(),
      })),
    };

    try {
      if (original) await updateSet(original, data);
      else await onSaveSet(data);
      leavePage();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save set. Try again.";
      // Part of an edit may have saved, so show the set's real state before any retry.
      const latest = original ? await loadSet(original.id).catch(() => null) : null;
      if (latest) showSavedSet(latest);
      setError(latest ? `${message} Showing what was saved.` : message);
      setSubmitting(false);
    }
  };

  return (
    <AppLayout active="create" onNavigate={onNavigate} {...layoutProps}>
      <div className="cr-page">
        <div className="cr-topbar">
          <button
            type="button"
            className="cr-back-btn"
            onClick={leavePage}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Cancel</span>
          </button>
          <h1 className="cr-page-title">{isEditing ? "Edit Flashcard Set" : "Create Flashcard Set"}</h1>
          <button
            type="submit"
            form="create-set-form"
            className="cr-save-btn"
            disabled={submitting || blockedMessage !== null}
          >
            <Save size={16} aria-hidden="true" />
            <span>{submitting ? "Saving..." : isEditing ? "Save Changes" : "Save Set"}</span>
          </button>
        </div>

        {blockedMessage ? (
          <p className="sp-message">{blockedMessage}</p>
        ) : (
        <form id="create-set-form" className="cr-form" onSubmit={handleSubmit}>
          {/* Metadata Section */}
          <section className="cr-section">
            <h2>Set Details</h2>
            <div className="cr-field">
              <label htmlFor="set-name">Title</label>
              <input
                id="set-name"
                type="text"
                placeholder="e.g., React Hooks & Context API"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            <div className="cr-field">
              <label htmlFor="set-desc">Description (optional)</label>
              <textarea
                id="set-desc"
                placeholder="Add a brief overview of what this set covers..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={300}
              />
            </div>

            <label className="cr-private">
              <input
                id="set-private"
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <span>
                <strong>Keep this set private</strong>
                <small>Public sets can be found and viewed by anyone. Only you can see private sets.</small>
              </span>
            </label>
          </section>

          {/* Cards Builder Section */}
          <section className="cr-section">
            <div className="cr-cards-header">
              <h2>Cards ({cards.length})</h2>
              <button type="button" className="cr-add-top-btn" onClick={addCard}>
                <Plus size={16} aria-hidden="true" /> Add card
              </button>
            </div>

            <div className="cr-cards-list">
              {cards.map((card, index) => (
                <div key={card.id} className="cr-card-row">
                  <div className="cr-card-number">{index + 1}</div>
                  <div className="cr-card-inputs">
                    {/* Front Side */}
                    <div className="cr-card-input-group">
                      <div className="cr-group-header">
                        <label>Front <span className="cr-md-badge">Markdown</span></label>
                        <div className="cr-md-toolbar">
                          <button type="button" title="Bold" onClick={() => insertMarkdown(card.id, "front", "**")}><Bold size={12} /></button>
                          <button type="button" title="Italic" onClick={() => insertMarkdown(card.id, "front", "*")}><Italic size={12} /></button>
                          <button type="button" title="Inline Code" onClick={() => insertMarkdown(card.id, "front", "`")}><Code size={12} /></button>
                          <button type="button" title="Bullet List" onClick={() => insertMarkdown(card.id, "front", "- ", false)}><List size={12} /></button>
                        </div>
                      </div>
                      <textarea
                        ref={(el) => { textareaRefs.current[`${card.id}-front`] = el; }}
                        placeholder="e.g., **useState** hook syntax"
                        value={card.front}
                        onChange={(e) => updateCard(card.id, "front", e.target.value)}
                        rows={3}
                      />
                    </div>

                    {/* Back Side */}
                    <div className="cr-card-input-group">
                      <div className="cr-group-header">
                        <label>Back <span className="cr-md-badge">Markdown</span></label>
                        <div className="cr-md-toolbar">
                          <button type="button" title="Bold" onClick={() => insertMarkdown(card.id, "back", "**")}><Bold size={12} /></button>
                          <button type="button" title="Italic" onClick={() => insertMarkdown(card.id, "back", "*")}><Italic size={12} /></button>
                          <button type="button" title="Inline Code" onClick={() => insertMarkdown(card.id, "back", "`")}><Code size={12} /></button>
                          <button type="button" title="Bullet List" onClick={() => insertMarkdown(card.id, "back", "- ", false)}><List size={12} /></button>
                        </div>
                      </div>
                      <textarea
                        ref={(el) => { textareaRefs.current[`${card.id}-back`] = el; }}
                        placeholder="e.g., `const [state, setState] = useState(initial);`"
                        value={card.back}
                        onChange={(e) => updateCard(card.id, "back", e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="cr-delete-card-btn"
                    onClick={() => removeCard(card.id)}
                    disabled={cards.length <= 1}
                    aria-label={`Delete card ${index + 1}`}
                    title="Delete card"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className="cr-add-bottom-btn" onClick={addCard}>
              <Plus size={18} aria-hidden="true" /> Add another card
            </button>
          </section>

          {error && (
            <p className="cr-error" role="alert">
              {error}
            </p>
          )}
        </form>
        )}
      </div>
    </AppLayout>
  );
}