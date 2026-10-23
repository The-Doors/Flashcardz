import { useState, useRef, type FormEvent } from "react";
import { Plus, Trash2, ArrowLeft, Save, Bold, Italic, Code, List } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import AppLayout from "./AppLayout";
import type {
  ActivityData,
  NavId,
  SetCategory,
  SignInPayload,
  SignUpPayload,
  UserInfo,
} from "./types";
import "./CreatePage.css";

type FlashcardInput = {
  id: string;
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
  onSaveSet?: (data: {
    name: string;
    description: string;
    category: SetCategory;
    cards: { front: string; back: string }[];
  }) => void | Promise<void>;
  onNavigate?: (id: NavId) => void;
};

const CATEGORIES: Exclude<SetCategory, "All">[] = [
  "Languages",
  "Science",
  "Tech & IT",
  "Humanities",
  "Math",
  "Other",
];

const genId = () => Math.random().toString(36.25).substring(2, 9);

export default function CreatePage({
  onSaveSet,
  onNavigate,
  ...layoutProps
}: CreatePageProps) {
  const routerNavigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Exclude<SetCategory, "All">>("Tech & IT");
  const [cards, setCards] = useState<FlashcardInput[]>([
    { id: genId(), front: "", back: "" },
    { id: genId(), front: "", back: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep track of textarea refs for Markdown toolbar insertion
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

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

    const validCards = cards.filter((c) => c.front.trim() && c.back.trim());
    if (validCards.length === 0) {
      setError("Add at least one complete flashcard (front and back).");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await onSaveSet?.({
        name: name.trim(),
        description: description.trim(),
        category,
        cards: validCards.map(({ front, back }) => ({ front: front.trim(), back: back.trim() })),
      });
      void routerNavigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save set. Try again.");
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
            onClick={() => void routerNavigate({ to: "/" })}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Cancel</span>
          </button>
          <h1 className="cr-page-title">Create Flashcard Set</h1>
          <button
            type="button"
            form="create-set-form"
            className="cr-save-btn"
            disabled={submitting}
          >
            <Save size={16} aria-hidden="true" />
            <span>{submitting ? "Saving..." : "Save Set"}</span>
          </button>
        </div>

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

            <div className="cr-field">
              <label htmlFor="set-category">Category</label>
              <select
                id="set-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
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
      </div>
    </AppLayout>
  );
}