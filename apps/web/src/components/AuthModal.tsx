import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import type { AuthMode, SignInPayload, SignUpPayload } from "./types";
import "./AuthModal.css";

type AuthModalProps = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  /** Throw an Error (e.g. "Incorrect email or password") to show it in the form. */
  onSignIn?: (data: SignInPayload) => void | Promise<void>;
  onSignUp?: (data: SignUpPayload) => void | Promise<void>;
};

type Errors = Partial<Record<"name" | "email" | "password" | "confirm", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export default function AuthModal({ mode, onModeChange, onClose, onSignIn, onSignUp }: AuthModalProps) {
  const isSignUp = mode === "signup";
  const uid = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Focus the first field whenever the modal opens or switches mode.
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
  }, [mode]);

  // Escape closes (unless a request is in flight).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  // Keep Tab focus inside the dialog.
  const trapFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const items = dialogRef.current.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled])",
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const switchMode = () => {
    setErrors({});
    setFormError(null);
    setPassword("");
    setConfirm("");
    setShowPassword(false);
    onModeChange(isSignUp ? "signin" : "signup");
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (isSignUp && !name.trim()) next.name = "Enter your name.";
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    else if (isSignUp && password.length < MIN_PASSWORD)
      next.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (isSignUp && confirm !== password) next.confirm = "Passwords don’t match.";
    return next;
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setFormError(null);
    setSubmitting(true);
    try {
      if (isSignUp) await onSignUp?.({ name: name.trim(), email: email.trim(), password });
      else await onSignIn?.({ email: email.trim(), password });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const id = (field: string) => `${uid}-${field}`;
  const fieldProps = (field: keyof Errors) => ({
    id: id(field),
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? id(`${field}-err`) : undefined,
  });
  const fieldError = (field: keyof Errors) =>
    errors[field] && (
      <span id={id(`${field}-err`)} className="am-error">
        {errors[field]}
      </span>
    );

  return (
    <div className="am-overlay" onMouseDown={() => !submitting && onClose()}>
      <div
        ref={dialogRef}
        className="am-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id("title")}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={trapFocus}
      >
        <button className="am-close" onClick={onClose} aria-label="Close" disabled={submitting}>
          <X size={18} aria-hidden="true" />
        </button>

        <h2 id={id("title")} className="am-title">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h2>
        <p className="am-sub">
          {isSignUp ? "Sign up to save your sets and track your progress." : "Sign in to pick up where you left off."}
        </p>

        <form className="am-form" onSubmit={submit} noValidate>
          {isSignUp && (
            <div className="am-field">
              <label htmlFor={id("name")}>Name</label>
              <input
                {...fieldProps("name")}
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {fieldError("name")}
            </div>
          )}

          <div className="am-field">
            <label htmlFor={id("email")}>Email</label>
            <input
              {...fieldProps("email")}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {fieldError("email")}
          </div>

          <div className="am-field">
            <label htmlFor={id("password")}>Password</label>
            <div className="am-password">
              <input
                {...fieldProps("password")}
                type={showPassword ? "text" : "password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="am-eye"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
            {fieldError("password")}
          </div>

          {isSignUp && (
            <div className="am-field">
              <label htmlFor={id("confirm")}>Confirm password</label>
              <input
                {...fieldProps("confirm")}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {fieldError("confirm")}
            </div>
          )}

          {formError && (
            <p className="am-form-error" role="alert">
              {formError}
            </p>
          )}

          <button type="submit" className="am-submit" disabled={submitting}>
            {submitting ? "Please wait…" : isSignUp ? "Sign up" : "Sign in"}
          </button>
        </form>

        <p className="am-switch">
          {isSignUp ? "Already have an account?" : "New to FlashCardz?"}{" "}
          <button type="button" className="am-link" onClick={switchMode} disabled={submitting}>
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
