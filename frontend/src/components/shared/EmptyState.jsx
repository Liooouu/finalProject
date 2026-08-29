import React from "react";
import FoxMark from "./FoxMark";

const EmptyState = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon ? (
        <span className="text-5xl mb-4 text-on-muted block">{icon}</span>
      ) : (
        <span className="mb-4 block rounded-2xl bg-card border border-line p-3">
          <FoxMark className="w-14 h-14" />
        </span>
      )}
      {title && <p className="text-on font-medium">{title}</p>}
      {description && (
        <p className="text-on-dim text-sm mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
