import { useEffect, useRef } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

// Smoothing belongs to the public page; portal lists keep their native scrolling.
export default function useLandingScroll(wrapperRef, contentRef) {
  const instance = useRef(null);
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;
    const lenis = new Lenis({ wrapper, content, eventsTarget: wrapper.parentElement, autoRaf: true, lerp: 0.085, smoothWheel: true, syncTouch: false, respectReducedMotion: true });
    instance.current = lenis;
    return () => { instance.current = null; lenis.destroy(); };
  }, [wrapperRef, contentRef]);

  return (event, id) => {
    const target = contentRef.current?.querySelector(`#${id}`);
    if (!target) return;
    event.preventDefault();
    const headerHeight = wrapperRef.current?.parentElement.querySelector("header")?.getBoundingClientRect().height || 80;
    // A numeric destination stays correct even if focus or touch has just
    // scrolled natively while Lenis still has an interpolated frame pending.
    const destination = Math.max(0, target.getBoundingClientRect().top - contentRef.current.getBoundingClientRect().top - headerHeight - 16);
    const focusTarget = () => target.focus({ preventScroll: true });
    if (instance.current) instance.current.scrollTo(destination, { onComplete: focusTarget });
    else { wrapperRef.current?.scrollTo({ top: destination }); focusTarget(); }
  };
}
