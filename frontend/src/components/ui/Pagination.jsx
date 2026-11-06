import React from "react";
import Button from "./Button";

const Pagination = ({ page, pageSize, total, onChange, disabled = false, label = "Record pages" }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label={label} className="record-pagination mt-4 border-t border-line pt-4 text-xs text-on-muted">
      <p>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</p>
      <div className="record-pagination-controls">
        <Button variant="secondary" size="sm" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
        <span aria-live="polite" aria-atomic="true">Page {page} of {pages}</span>
        <Button variant="secondary" size="sm" disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </nav>
  );
};

export default Pagination;
