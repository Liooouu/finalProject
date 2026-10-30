import React, { useLayoutEffect, useRef } from "react";

/** Keep a short final page usable without floating controls over its records. */
export default function StablePage({ pageKey = "records", children, footer, className = "", contentClassName = "", fill = false, loading = false }) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const footerRef = useRef(null);
  const measured = useRef({ key: null, width: 0, height: 0 });
  const footerAnchor = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const main = container.closest("main");
    const measure = () => {
      const width = Math.round(content.getBoundingClientRect().width);
      if (!width) return;
      const previous = measured.current;
      if (previous.key !== pageKey || Math.abs(previous.width - width) > 1) {
        container.style.setProperty("--stable-page-content-height", "0px");
        measured.current = { key: pageKey, width, height: 0 };
      }
      const footerHeight = footerRef.current?.getBoundingClientRect().height || 0;
      // Long lists may scroll normally. Their last page reserves at most one
      // viewport, rather than leaving space for ten large, missing cards.
      const cap = Math.max(120, (main?.clientHeight || window.innerHeight) - footerHeight - 48);
      const height = Math.min(cap, Math.max(measured.current.height, content.scrollHeight));
      measured.current.height = height;
      const value = `${Math.ceil(height)}px`;
      if (container.style.getPropertyValue("--stable-page-content-height") !== value) {
        container.style.setProperty("--stable-page-content-height", value);
      }
    };
    measure();
    // A long page can shrink without reaching the bottom of the whole screen
    // (other dashboard cards may follow). Preserve the clicked control's
    // viewport position by adjusting the main scroll, not by overlaying it.
    const anchor = footerAnchor.current;
    if (anchor && anchor.key === pageKey && anchor.expiresAt > Date.now() && !loading && content.textContent !== anchor.content && main && footerRef.current) {
      main.scrollTop += footerRef.current.getBoundingClientRect().top - anchor.top;
      footerAnchor.current = null;
    }
    if (anchor && (anchor.key !== pageKey || anchor.expiresAt <= Date.now())) footerAnchor.current = null;
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    if (main) observer.observe(main);
    return () => observer.disconnect();
  }, [pageKey, children, footer, loading]);

  return <div ref={containerRef} className={`stable-page ${fill ? "stable-page-fill" : ""} ${className}`}>
    <div ref={contentRef} className={`stable-page-content ${contentClassName}`}>{children}</div>
    {footer && <div ref={footerRef} className="stable-page-footer" onClickCapture={event => {
      const button = event.target.closest("button");
      if (button && !button.disabled) footerAnchor.current = { key: pageKey, top: footerRef.current.getBoundingClientRect().top, content: contentRef.current?.textContent, expiresAt: Date.now() + 10000 };
    }}>{footer}</div>}
  </div>;
}
