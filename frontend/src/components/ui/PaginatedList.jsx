import React, { useState } from "react";
import Pagination from "./Pagination";
import StablePage from "./StablePage";

export default function PaginatedList({ items, renderItem, label, className = "", disabled = false }) {
  const [page, setPage] = useState(1);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(items.length / 5)));
  if (!items.length) return null;
  return <StablePage pageKey={label} footer={<Pagination page={currentPage} pageSize={5} total={items.length} onChange={setPage} disabled={disabled} label={label} />}>
    <ul className={className}>{items.slice((currentPage - 1) * 5, currentPage * 5).map(renderItem)}</ul>
  </StablePage>;
}
