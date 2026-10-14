import React, { useEffect, useRef, useState } from "react";

/**
 * Reveal — animates its children in as they enter the viewport and back out
 * as they leave, so scrolling up replays the entrance. IntersectionObserver
 * plus the `.reveal` / `.is-visible` classes in index.css; no animation lib.
 *
 * variant: "" (rise) | "left" | "right" | "scale"
 * delay:   ms, for staggering siblings
 */
const Reveal = ({
  children,
  as,
  variant = "",
  delay = 0,
  className = "",
  ...rest
}) => {
  const Component = as || "div";
  const ref = useRef(null);

  // Read once during render so the effect below never has to push state
  // synchronously; reduced-motion users are simply visible from the start.
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [visible, setVisible] = useState(prefersReduced);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [prefersReduced]);

  return (
    <Component
      {...rest}
      ref={ref}
      className={[
        "reveal",
        variant ? `reveal-${variant}` : "",
        visible ? "is-visible" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Component>
  );
};

export default Reveal;
