import React from "react";

/**
 * Button — one primary action per screen; secondary actions quieter.
 * Visual layer only: renders a real <button>, so all click handlers work as-is.
 *
 * Hybrid approach: only `primary` is a solid fill (the one CTA per screen).
 * success/warning/danger/info are neutral shells with coloured text.
 *
 * Heaviness matches the neomorphic panels: resting float (-2px) + panel-highlight
 * + panel-shadow, lifts further on hover, presses in on active.
 */
const variants = {
  primary:
    "bg-[var(--brand-solid)] text-white -translate-y-0.5 shadow-[var(--panel-highlight),var(--panel-shadow)] hover:-translate-y-1 hover:shadow-[var(--panel-highlight),var(--panel-shadow),0_8px_18px_-10px_var(--brand)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.06)] active:translate-y-0",
  success:
    "border border-[var(--panel-border)] bg-card text-[var(--ok)] -translate-y-0.5 shadow-[var(--panel-highlight),var(--panel-shadow)] hover:bg-card-alt hover:-translate-y-1 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-0",
  warning:
    "border border-[var(--panel-border)] bg-card text-[var(--warn)] -translate-y-0.5 shadow-[var(--panel-highlight),var(--panel-shadow)] hover:bg-card-alt hover:-translate-y-1 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-0",
  danger:
    "border border-[var(--panel-border)] bg-card text-[var(--danger)] -translate-y-0.5 shadow-[var(--panel-highlight),var(--panel-shadow)] hover:bg-card-alt hover:-translate-y-1 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-0",
  info:
    "border border-[var(--panel-border)] bg-card text-[var(--info)] -translate-y-0.5 shadow-[var(--panel-highlight),var(--panel-shadow)] hover:bg-card-alt hover:-translate-y-1 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-0",
  secondary:
    "border border-[var(--panel-border)] bg-card text-on -translate-y-0.5 shadow-[var(--panel-highlight),var(--panel-shadow)] hover:bg-card-alt hover:-translate-y-1 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-0",
  ghost: "text-on-dim hover:bg-card-alt hover:text-on",
  link: "text-brand underline decoration-brand/40 underline-offset-2 hover:text-on hover:decoration-current",
};

const sizes = {
  sm: "px-3 py-1.5 text-[13px] gap-1.5 rounded-lg",
  md: "px-4 py-2 text-sm gap-2 rounded-xl",
  lg: "px-5 py-2.5 text-sm gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-xl",
  iconSm: "h-7 w-7 rounded-lg",
  inline: "gap-1 p-0 text-xs",
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
      data-ui-variant={variant}
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