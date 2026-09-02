import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Button from "./Button";
import { FaExclamationTriangle } from "react-icons/fa";

/**
 * ConfirmDialog — the app's standard "are you sure?" popup.
 * Overlay with a Yes/Cancel choice, Escape + backdrop-click to dismiss.
 */
const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
  icon,
}) => {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClasses =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700 border-transparent"
      : "bg-indigo-600 text-white hover:bg-indigo-700 border-transparent";

  // Rendered through a portal to <body> so no ancestor `backdrop-filter`,
  // `transform`, or `filter` (e.g. the topbar's backdrop blur) can hijack the
  // fixed positioning and mis-center the dialog.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="animate-pop relative w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-2xl shadow-black/20"
      >
        <div className="mb-4 flex items-start gap-3.5">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${
              variant === "danger"
                ? "bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-inset ring-red-500/20"
                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-500/20"
            }`}
          >
            {icon || <FaExclamationTriangle />}
          </span>
          <div className="min-w-0">
            <h3 id="confirm-title" className="text-lg font-bold text-on">
              {title}
            </h3>
            {message && (
              <p id="confirm-message" className="mt-1 text-sm text-on-dim">
                {message}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`inline-flex flex-1 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;