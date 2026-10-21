import React from "react";

/**
 * Button — one primary action per screen; secondary actions quieter.
 * Visual layer only: renders a real <button>, so all click handlers work as-is.
 */
const variants = {
  primary:
    "bg-[var(--brand-solid)] text-white shadow-[0_10px_24px_-14px_rgba(79,70,229,0.9)] hover:bg-indigo-700 active:bg-indigo-800",
  secondary:
    "border border-line bg-card text-on shadow-[var(--elev-1)] hover:bg-card-alt hover:border-brand/30",
  ghost: "text-on-dim hover:bg-card-alt hover:text-on",
  danger:
    "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15 dark:border-danger/25",
};

const sizes = {
  sm: "px-3 py-1.5 text-[13px] gap-1.5 rounded-lg",
  md: "px-4 py-2 text-sm gap-2 rounded-xl",
  lg: "px-5 py-2.5 text-sm gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-xl",
};

const Button = ({
  variant = "primary",
  size = "md",
  className = "",
  as,
  loading = false,
  children,
  disabled,
  ...props
}) => {
  const Comp = as || "button";
  return (
    <Comp
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={Comp === "button" ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </Comp>
  );
};

export default Button;
