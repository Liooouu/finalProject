import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaExternalLinkAlt } from "react-icons/fa";

/**
 * MapModal — a large dialog that hosts an in-app Google Maps Embed API map
 * (directions or Street View). Rendered through a portal to <body> so ancestor
 * `backdrop-filter`/`transform` styles cannot hijack the fixed positioning, and
 * closes on Escape or a backdrop click like ConfirmDialog.
 */
const MapModal = ({ open, title, src, externalUrl, error, onClose, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-pop relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-black/20"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h3 className="truncate text-base font-bold text-on">{title}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-on-dim transition-colors hover:bg-card-alt hover:text-on"
              >
                <FaExternalLinkAlt className="text-[10px]" />
                <span className="hidden sm:inline">Open in Google Maps</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 text-on-muted transition-colors hover:bg-card-alt hover:text-on"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="relative flex h-[65vh] w-full items-center justify-center bg-card-alt">
          {error ? (
            <p className="max-w-sm px-6 text-center text-sm text-on-dim">{error}</p>
          ) : src ? (
            <iframe
              title={title}
              src={src}
              className="h-full w-full"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : children ? (
            children
          ) : (
            <span
              className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-indigo-500"
              aria-label="Loading"
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MapModal;
