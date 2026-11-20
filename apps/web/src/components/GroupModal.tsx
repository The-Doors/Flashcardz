import { useEffect, type ReactNode } from "react";
import { notifications } from "@mantine/notifications";
import { X } from "lucide-react";
import "./GroupsPage.css";

/** Logs the error and shows its message, which the API helpers make readable. */
export const notifyError = (error: unknown, fallback: string) => {
  console.error(error);
  notifications.show({ color: "red", message: error instanceof Error ? error.message : fallback });
};

/** A dialog that closes on Escape or a click outside it. */
export default function GroupModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="gp-modal-overlay" onMouseDown={onClose}>
      <div
        className="gp-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="gp-modal-head">
          <h2>{title}</h2>
          <button type="button" className="gp-close-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
