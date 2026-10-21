import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Button from "./Button";
import { FaExclamationTriangle } from "react-icons/fa";

/**
 * ConfirmDialog — the app's standard "are you sure?" popup.
 * Overlay with a Yes/Cancel choice, Escape + backdrop-click to dismiss.
 * `busy` disables dismissal while an async action is in flight so a pending
 * result (e.g. a freshly minted PIN) can't be dismissed and lost.
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
  children,
  busy = false,
}) => {
  const confirmRef = useRef(null);
  const dialogRef = useRef(null);
  const cancelRef = useRef(onCancel);
  const busyRef = useRef(busy);

  // Keep the latest callbacks without making them effect dependencies: callers
  // pass inline functions, so depending on onCancel would rerun the effect on
  // every keystroke and steal focus from the dialog's inputs.
  useEffect(() => {
    cancelRef.current = onCancel;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;

    const onKey = (e) => {
      if (e.key === "Escape") {
        if (busyRef.current) return;
        e.preventDefault();
        cancelRef.current?.();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;

      const focusables = Array.from(
        dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    confirmRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      // Return focus to whatever opened the dialog.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [open]);

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
        onClick={() => {
          if (!busy) onCancel?.();
        }}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-busy={busy}
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="animate-pop relative w-full max-w-sm rounded-[var(--panel-radius)] border border-line bg-card p-6 shadow-2xl shadow-black/20"
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
            {children}
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex flex-1 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${confirmClasses} disabled:cursor-not-allowed disabled:opacity-60`}
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
