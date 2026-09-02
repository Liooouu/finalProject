import React from "react";

/**
 * Button — one primary action per screen; secondary actions quieter.
 * Visual layer only: renders a real <button>, so all click handlers work as-is.
 */
const variants = {
  primary:
    "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800",
  secondary:
    "bg-card text-on border border-line hover:bg-card-alt hover:border-line",
  ghost: "text-on-dim hover:bg-card-alt hover:text-on",
  danger:
    "bg-card text-red-600 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 dark:text-red-400",
};

const sizes = {
  sm: "px-3 py-1.5 text-[13px] gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
};

const Button = ({
  variant = "primary",
  size = "md",
  className = "",
  as,
  ...props
}) => {
  const Comp = as || "button";
  return (
    <Comp
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
};

export default Button;