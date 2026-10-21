import React from "react";

const variants = {
  solid: "panel-surface",
  glass: "panel-surface panel-glass",
  inset: "border border-line bg-card-alt/60 shadow-[var(--elev-1)]",
  accent: "panel-surface panel-accent",
  gradient: "panel-gradient",
  plain: "",
};

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

/**
 * Card — the single surface primitive for Aurora Calm 2026.
 * Keeps radius, hairline and elevation in one place so every panel matches.
 */
const Card = (props) => {
  const {
    as,
    variant = "solid",
    padding = "md",
    className = "",
    children,
    ...rest
  } = props;
  const Comp = as || "div";

  return (
    <Comp
      className={`relative rounded-[var(--panel-radius)] ${variants[variant] || variants.solid} ${
        paddings[padding] ?? paddings.md
      } ${className}`}
      {...rest}
    >
      {children}
    </Comp>
  );
};

export default Card;
