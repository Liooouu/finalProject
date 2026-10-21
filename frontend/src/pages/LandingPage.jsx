import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaQrcode,
  FaUsers,
  FaChartBar,
  FaCamera,
  FaKey,
  FaShieldAlt,
  FaArrowRight,
  FaChevronDown,
} from "react-icons/fa";
import AppBackground from "../components/shared/AppBackground";
import BrandMark from "../components/shared/BrandMark";
import TrackMark from "../components/shared/TrackMark";
import Reveal from "../components/landing/Reveal";
import features from "../data/features";
import { useTheme } from "../context/ThemeContext";
import techDark from "../assets/images/tech-bg-dark.jpg";
import techLight from "../assets/images/tech-bg-light.jpg";

const steps = [
  {
    n: "01",
    icon: <FaQrcode />,
    title: "Students check in",
    desc: "Enroll your face once, then check in by QR and watch your community-service hours add up. File an excuse when life gets in the way.",
  },
  {
    n: "02",
    icon: <FaUsers />,
    title: "Organizers run the event",
    desc: "Create an event, watch attendance land live, approve excuses as they come in, and export the list the moment it wraps.",
  },
  {
    n: "03",
    icon: <FaChartBar />,
    title: "Admins see everything",
    desc: "Spin up organizer accounts, review reports and exports, and keep every event, user, and hour accounted for.",
  },
];

const securityPoints = [
  {
    icon: <FaCamera />,
    title: "Face enrollment",
    desc: "Forgot your security PIN? Recover it with a live face check on your own device.",
  },
  {
    icon: <FaKey />,
    title: "Staff-verified PIN reset",
    desc: "No camera on your phone? An admin or organizer verifies you in person and hands you a fresh security PIN on the spot.",
  },
  {
    icon: <FaShieldAlt />,
    title: "Device verification",
    desc: "New devices ask for your PIN once; trusted devices sign in straight away.",
  },
];

const eyebrow =
  "text-[10px] font-semibold uppercase tracking-[0.2em] text-brand";

/**
 * LandingPage — the pre-login front page at "/". Free scrolling with soft
 * section snapping; every section's text and cards animate in on entry and
 * back out on exit (components/landing/Reveal). A floating "Get Started"
 * pill follows the scroll and steps aside once the final CTA is on screen.
 * Logged-in users never see this — App.jsx redirects them to their dashboard.
 */
const LandingPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const ctaRef = useRef(null);
  const [ctaInCtaSection, setCtaInCtaSection] = useState(false);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCtaInCtaSection(entry.isIntersecting),
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const goAuth = () => navigate("/auth");
  const goSignup = () => navigate("/auth/signup");

  return (
    <AppBackground>
      {/* Top bar — brand + sign in, stays put while the page scrolls under it */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
            <TrackMark className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-on">
            Track<span className="text-brand">ED</span>
          </span>
        </div>
        <button
          onClick={goAuth}
          className="rounded-full border border-line bg-card/70 px-4 py-2 text-sm font-medium text-on backdrop-blur transition-colors hover:border-brand/30 hover:text-brand"
        >
          Sign in
        </button>
      </header>

      <main className="relative h-[100svh] w-full overflow-x-hidden overflow-y-auto snap-y snap-proximity">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative flex min-h-full w-full snap-start flex-col items-center justify-center overflow-hidden px-6 pb-28 pt-24 text-center">
          <img
            src={isDark ? techDark : techLight}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-[0.25] dark:opacity-[0.38]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              mixBlendMode: "color",
              background: "var(--brand)",
              opacity: isDark ? 0.35 : 0.28,
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/55 to-[var(--app-base)] dark:from-[#070a12]/70 dark:via-[#070a12]/55 dark:to-[#070a12]"
          />

          <div className="relative z-10 flex flex-col items-center">
            <Reveal variant="scale">
              <BrandMark />
            </Reveal>

            <Reveal delay={90}>
              <h1 className="mt-8 max-w-3xl font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-on sm:text-5xl lg:text-6xl">
                Track every{" "}
                <span className="text-brand">event</span> and community
                hour.
              </h1>
            </Reveal>

            <Reveal delay={180}>
              <p className="mt-5 max-w-2xl text-base text-on-dim sm:text-lg">
                TrackED keeps event attendance in clear focus for students,
                organizers, and admins.
              </p>
            </Reveal>

            <Reveal delay={270}>
              <button
                onClick={goAuth}
                className="mt-8 inline-flex items-center gap-2 rounded-full border border-line bg-card/80 px-6 py-3 text-sm font-semibold text-on backdrop-blur transition-colors hover:border-brand/30 hover:text-brand"
              >
                I already have an account
                <FaArrowRight className="text-xs" />
              </button>
            </Reveal>
          </div>

          <Reveal
            delay={420}
            className="absolute inset-x-0 bottom-7 z-10 flex flex-col items-center gap-2 text-on-muted"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.22em]">
              Scroll to explore
            </span>
            <FaChevronDown className="animate-bounce text-sm" />
          </Reveal>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section className="flex min-h-full w-full snap-start items-center px-6 py-24 sm:px-10">
          <div className="mx-auto w-full max-w-6xl">
            <Reveal>
              <p className={eyebrow}>Features</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-on sm:text-4xl">
                Everything attendance, in one place
              </h2>
              <p className="mt-4 max-w-2xl text-on-dim">
                Four jobs TrackED does so nobody has to chase a paper list
                again.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((f, i) => (
                <Reveal
                  key={f.title}
                  variant="scale"
                  delay={i * 90}
                  className="panel-surface panel-glass rounded-[var(--panel-radius)] p-5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                    {f.icon}
                  </span>
                  <p className="mt-4 font-semibold text-on">{f.title}</p>
                  <p className="mt-1 text-sm text-on-muted">{f.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="flex min-h-full w-full snap-start items-center px-6 py-24 sm:px-10">
          <div className="mx-auto w-full max-w-6xl">
            <Reveal>
              <p className={eyebrow}>How it works</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-on sm:text-4xl">
                One system, three vantage points
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((s, i) => (
                <Reveal
                  key={s.n}
                  variant={i % 2 === 0 ? "left" : "right"}
                  delay={i * 110}
                  className="panel-surface panel-glass relative overflow-hidden rounded-[var(--panel-radius)] p-6"
                >
                  <span className="absolute right-5 top-4 font-display text-5xl font-extrabold text-brand/10">
                    {s.n}
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-solid)] text-white shadow-[var(--elev-2)]">
                    {s.icon}
                  </span>
                  <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
                    Step {s.n}
                  </p>
                  <p className="mt-1.5 font-semibold text-on">{s.title}</p>
                  <p className="mt-2 text-sm text-on-muted">{s.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Security ─────────────────────────────────────────── */}
        <section className="flex min-h-full w-full snap-start items-center px-6 py-24 sm:px-10">
          <div className="mx-auto w-full max-w-6xl">
            <Reveal>
              <p className={eyebrow}>Security</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-on sm:text-4xl">
                Locked down — and never a dead end
              </h2>
              <p className="mt-4 max-w-2xl text-on-dim">
                Strong where it matters, human where it has to be: if a student
                can't use face unlock, staff can verify them in person instead
                of leaving them stranded.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {securityPoints.map((p, i) => (
                <Reveal
                  key={p.title}
                  variant={i % 2 === 0 ? "right" : "left"}
                  delay={i * 110}
                  className="panel-surface panel-glass rounded-[var(--panel-radius)] p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                    {p.icon}
                  </span>
                  <p className="mt-4 font-semibold text-on">{p.title}</p>
                  <p className="mt-2 text-sm text-on-muted">{p.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section
          ref={ctaRef}
          className="flex min-h-full w-full snap-start flex-col items-center justify-center px-6 py-24 text-center"
        >
          <Reveal variant="scale">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
              <TrackMark className="h-9 w-9" />
            </span>
            <h2 className="mt-7 font-display text-3xl font-extrabold tracking-tight text-on sm:text-5xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-on-dim">
              Create your account in about a minute — then your next event is
              one scan away.
            </p>
            <button
              onClick={goSignup}
              className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] px-8 py-4 text-base font-semibold text-white shadow-[var(--elev-3)] transition-all hover:brightness-110"
            >
              Get Started
              <FaArrowRight />
            </button>
            <p className="mt-5 text-xs text-on-muted">
              Students register with their school email. Organizers and admins
              are set up by an admin.
            </p>
          </Reveal>
        </section>
      </main>

      {/* Floating CTA — follows the scroll, steps aside over the final CTA */}
      <button
        onClick={goSignup}
        aria-hidden={ctaInCtaSection}
        tabIndex={ctaInCtaSection ? -1 : 0}
        className={`fixed bottom-6 left-1/2 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] px-6 py-3.5 text-sm font-semibold text-white shadow-[var(--elev-3)] transition-all duration-300 hover:brightness-110 ${
          ctaInCtaSection
            ? "pointer-events-none -translate-x-1/2 translate-y-5 opacity-0"
            : "-translate-x-1/2 opacity-100"
        }`}
      >
        Get Started
        <FaArrowRight className="text-xs" />
      </button>
    </AppBackground>
  );
};

export default LandingPage;
