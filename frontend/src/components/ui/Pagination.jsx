import React from "react";
import Button from "./Button";

const Pagination = ({ page, pageSize, total, onChange, label = "Record pages" }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label={label} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-on-muted">
      <p>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
        <span aria-live="polite">Page {page} of {pages}</span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </nav>
  );
};

export default Pagination;
