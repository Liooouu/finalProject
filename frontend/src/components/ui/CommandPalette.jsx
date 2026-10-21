import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaArrowRight } from "react-icons/fa";

/**
 * CommandPalette — Ctrl/Cmd+K navigation. Items: { name, path, icon, group }.
 * Keeps the keyboard loop inside the dialog and closes on Escape.
 */
const CommandPalette = ({ open, onClose, items = [] }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setActive(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const { filtered, groups } = useMemo(() => {
    const search = query.trim().toLowerCase();
    const matches = search
      ? items.filter((item) =>
          `${item.name} ${item.group || ""}`.toLowerCase().includes(search)
        )
      : items;

    let running = 0;
    const grouped = [];
    matches.forEach((item) => {
      const label = item.group || "Navigate";
      let group = grouped.find((entry) => entry.label === label);
      if (!group) {
        group = { label, items: [] };
        grouped.push(group);
      }
      group.items.push({ ...item, index: running++ });
    });

    return { filtered: matches, groups: grouped };
  }, [items, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        const target = filtered[active];
        if (target) {
          event.preventDefault();
          onClose();
          navigate(target.path);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, filtered, active, navigate, onClose]);

  if (!open) return null;

  const handlePanelKeyDown = (event) => {
    if (event.key !== "Tab") return;
    const nodes = Array.from(
      panelRef.current?.querySelectorAll("input, button, [href]") || []
    ).filter((node) => !node.disabled);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        onKeyDown={handlePanelKeyDown}
        className="animate-fade-up relative w-full max-w-lg overflow-hidden rounded-[var(--panel-radius)] border border-line bg-[var(--panel-bg)] shadow-[var(--elev-3)]"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <FaSearch className="shrink-0 text-sm text-on-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a page..."
            aria-label="Search pages"
            className="h-12 w-full bg-transparent text-sm text-on outline-none placeholder:text-on-muted"
          />
          <kbd className="hidden shrink-0 rounded border border-line bg-card-alt px-1.5 py-0.5 text-[10px] text-on-muted sm:block">
            ESC
          </kbd>
        </div>

        <div className="nice-scroll max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-on-dim">
              No pages match “{query}”.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-1 last:mb-0">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-muted">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const selected = active === item.index;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onMouseEnter={() => setActive(item.index)}
                      onClick={() => {
                        onClose();
                        navigate(item.path);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        selected ? "bg-brand/10 text-on" : "text-on-dim hover:bg-card-alt"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] ${
                          selected ? "bg-brand/15 text-brand" : "bg-card-alt text-on-muted"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      <FaArrowRight
                        className={`shrink-0 text-[9px] ${
                          selected ? "text-brand" : "text-transparent"
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-card-alt/40 px-4 py-2 text-[10px] text-on-muted">
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-line bg-card px-1.5 py-0.5">↑</kbd>
            <kbd className="rounded border border-line bg-card px-1.5 py-0.5">↓</kbd>
            to move
          </span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-line bg-card px-1.5 py-0.5">↵</kbd>
            to open
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CommandPalette;
