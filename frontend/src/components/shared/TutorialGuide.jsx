import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { FaQuestionCircle, FaTimes } from 'react-icons/fa';
import api from '../../api/axios';
import { getContextRole } from '../../utils/auth';
import { activeGuideSection, pageGuide } from '../../data/guidedTours';
import '../../styles/tutorial-guide.css';

const readCompleted = key => { try { return localStorage.getItem(key) === 'done'; } catch { return false; } };
const remember = key => { try { localStorage.setItem(key, 'done'); } catch { /* Server progress is the fallback. */ } };
const visible = element => element && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';

export default function TutorialGuide({ role = 'public', account = null, className = '', auto = false }) {
  const location = useLocation();
  const [section, setSection] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [position, setPosition] = useState({ left: 16, top: 80 });
  const panel = useRef(null);
  const help = useRef(null);
  const shown = useRef(new Set());
  const synced = useRef(new Set());
  const guide = pageGuide(role, location.pathname, location.search, section);
  const storageKey = account?._id ? `tracked:tutorial:2:${account._id}:${role}:${guide.key}` : '';
  const current = guide.steps[Math.min(index, guide.steps.length - 1)];

  // Local tabs (Profile, Reports) have their own remembered guide.
  useEffect(() => {
    const update = () => setSection(activeGuideSection());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected', 'aria-pressed'] });
    return () => observer.disconnect();
  }, [location.pathname, location.search]);

  useEffect(() => {
    setOpen(false);
    setIndex(0);
    if (!auto || !storageKey || !account) return;
    if (account.tutorialPages?.[role]?.includes(`2:${guide.key}`)) { remember(storageKey); return; }
    if (readCompleted(storageKey)) {
      if (!synced.current.has(storageKey)) {
        synced.current.add(storageKey);
        if (getContextRole() === role) api.patch('/account/tutorial', { version: 2, page: guide.key }).catch(() => {});
      }
      return;
    }
    if ((role === 'student' || account.accountRole === 'student') && !account.faceEnrolledAt) return;
    if (shown.current.has(storageKey)) return;
    const timer = setTimeout(() => { shown.current.add(storageKey); setOpen(true); }, 650);
    return () => clearTimeout(timer);
    // Account polling must not reset a walkthrough already in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, storageKey, account?._id, account?.faceEnrolledAt, account?.accountRole]);

  // Moving to another page also counts as leaving this page's guide.
  useEffect(() => () => {
    if (storageKey && shown.current.has(storageKey)) {
      remember(storageKey);
      if (getContextRole() === role) api.patch('/account/tutorial', { version: 2, page: guide.key }).catch(() => {});
    }
  }, [storageKey, guide.key, role]);

  useEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true });
  }, [open]);

  const dismiss = () => {
    setOpen(false);
    if (storageKey) {
      remember(storageKey);
      if (getContextRole() === role) api.patch('/account/tutorial', { version: 2, page: guide.key }).catch(() => {});
    }
    if (panel.current?.contains(document.activeElement)) help.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    let target, frame;
    const measure = () => {
      const candidates = current.targets.flatMap(selector => [...document.querySelectorAll(selector)]);
      target = candidates.find(visible) || help.current;
      const box = target?.getBoundingClientRect();
      const width = window.innerWidth, height = window.innerHeight;
      const panelHeight = panel.current?.offsetHeight || 310;
      const panelWidth = Math.min(380, width - 32);
      const bounded = box ? { left: Math.max(4, box.left - 5), top: Math.max(4, box.top - 5), width: Math.max(0, Math.min(box.width + 10, width - Math.max(4, box.left - 5) - 4)), height: Math.max(0, Math.min(box.height + 10, height - Math.max(4, box.top - 5) - 4)) } : null;
      setRect(bounded);
      const left = width < 600 ? 16 : box && box.right + 24 + panelWidth < width ? box.right + 24 : Math.max(16, Math.min(box?.left || 16, width - panelWidth - 16));
      let top = box && box.bottom + panelHeight + 24 < height ? box.bottom + 20 : Math.max(16, (box?.top || height) - panelHeight - 20);
      if (width >= 600 && box && left > box.right) top = Math.min(Math.max(16, box.top), height - panelHeight - 16);
      if (width < 600 && box && box.bottom + panelHeight + 24 >= height) top = Math.max(16, height - panelHeight - 16);
      top = Math.max(16, Math.min(top, height - panelHeight - 16));
      setPosition({ left, top });
    };
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure();
    // Scroll only for a new step, never on every automatic data refresh.
    const bounds = target?.getBoundingClientRect();
    if (bounds && (bounds.top < 64 || bounds.bottom > window.innerHeight)) target.scrollIntoView({ block: 'center', behavior: 'instant' });
    measure();
    const observer = new ResizeObserver(update);
    if (panel.current) observer.observe(panel.current);
    const mutation = new MutationObserver(update);
    mutation.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); mutation.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
    // Step descriptions/targets remain stable during record refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, guide.key]);

  useEffect(() => {
    if (!open) return;
    const escape = event => { if (event.key === 'Escape') { event.stopPropagation(); dismiss(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  });

  return <>
    <button ref={help} type="button" className={`tutorial-help ${className}`} aria-label="Open TrackED tutorial" title="Help & tutorial" onClick={() => { if (storageKey) shown.current.add(storageKey); setIndex(0); setOpen(true); }}><FaQuestionCircle aria-hidden="true" /><span className="sr-only">Help & tutorial</span></button>
    {open && createPortal(<div className="tutorial-layer">
      {rect && <div aria-hidden="true" className="tutorial-spotlight" style={rect} />}
      <section ref={panel} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby={`tutorial-title-${role}`} aria-describedby={`tutorial-description-${role}`} className="tutorial-coach" style={position}>
        <div className="tutorial-header"><p>PAGE GUIDE · {index + 1} OF {guide.steps.length}</p><button type="button" className="tutorial-close" aria-label="Close tutorial" onClick={dismiss}><FaTimes aria-hidden="true" /></button></div>
        <h2 id={`tutorial-title-${role}`}>{current.title}</h2>
        <p id={`tutorial-description-${role}`} aria-live="polite" className="tutorial-description">{current.description}</p>
        {current.example && <div className="tutorial-example"><strong>Example</strong><p>{current.example}</p></div>}
        <p className="tutorial-note">You can open another page anytime. Each page has its own guide.</p>
        <div className="tutorial-footer"><button type="button" className="tutorial-skip" onClick={dismiss}>Skip guide</button><div><button type="button" className="tutorial-secondary" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>Back</button><button type="button" className="tutorial-primary" onClick={() => index === guide.steps.length - 1 ? dismiss() : setIndex(i => i + 1)}>{index === guide.steps.length - 1 ? 'Done' : 'Next'}</button></div></div>
      </section>
    </div>, document.body)}
  </>;
}
