import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowDown, FaArrowRight, FaCamera, FaChartBar, FaCheck, FaKey, FaMoon, FaShieldAlt, FaSun, FaUsers } from "react-icons/fa";
import AppBackground from "../components/shared/AppBackground";
import TrackMark from "../components/shared/TrackMark";
import Reveal from "../components/landing/Reveal";
import useLandingScroll from "../components/landing/useLandingScroll";
import features from "../data/features";
import { useTheme } from "../context/ThemeContext";
import campus from "../assets/images/landing/campus.webp";
import community from "../assets/images/landing/community-service.webp";
import eventTeam from "../assets/images/landing/event-team.webp";
import academicStaff from "../assets/images/landing/academic-staff.webp";
import "../styles/landing.css";

const roles = [
  { n: "01", icon: <FaCamera />, role: "For students", title: "Check in. Follow your records.", description: "Enroll your face, check in at an organizer’s face station, and view your attendance and required service hours. For a recorded absence, submit an excuse with supporting attachments within seven days after the event ends.", image: campus, alt: "Three students walking together outside a campus building", position: "45% 50%" },
  { n: "02", icon: <FaUsers />, role: "For organizers", title: "Manage events, together.", description: "Create and edit shared events, operate face stations, and review other students’ excuse letters. Submit documented manual attendance requests for independent review when students need assistance.", image: eventTeam, alt: "A team planning together with a laptop and notebooks", position: "50% 45%" },
  { n: "03", icon: <FaChartBar />, role: "For administrators", title: "Monitor, review, and manage.", description: "Monitor attendance, create or correct events, review manual requests and face appeals, and export CSV reports. Manage student accounts and grant or remove organizer access while preserving their student records.", image: academicStaff, alt: "A member of academic staff working with a laptop in a lecture hall", position: "50% 43%" },
];
const securityPoints = [
  { icon: <FaCamera />, title: "Face attendance", description: "Students enroll their face before checking in at an organizer-operated station." },
  { icon: <FaUsers />, title: "Independent review", description: "Manual requests need an admin or an organizer assigned to review that event. Requesters and students cannot approve their own attendance." },
  { icon: <FaKey />, title: "Account recovery", description: "Recover your password with a one-time email code and get back to your account." },
  { icon: <FaShieldAlt />, title: "Access with a purpose", description: "Students, organizers, and admins get the tools and permissions their role needs." },
];

export default function LandingPage() {
  const { isDark, toggleTheme } = useTheme();
  const scrollRef = useRef(null), contentRef = useRef(null), ctaRef = useRef(null);
  const [hideFloatingCta, setHideFloatingCta] = useState(true);
  const scrollTo = useLandingScroll(scrollRef, contentRef);
  useEffect(() => {
    const target = ctaRef.current;
    if (!target) return;
    const visible = new Set();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target); });
      setHideFloatingCta(visible.size > 0);
    }, { root: scrollRef.current, threshold: 0.12 });
    observer.observe(target);
    const hero = contentRef.current?.querySelector("#home");
    if (hero) observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return <AppBackground className="tracked-landing">
    <a className="landing-skip" href="#features" onClick={event => scrollTo(event, "features")}>Skip to features</a>
    <header className="landing-header">
      <a href="#home" className="landing-brand" aria-label="TrackED home" onClick={event => scrollTo(event, "home")}><span className="landing-brand-icon"><TrackMark className="h-6 w-6" /></span><span>Track<span className="text-brand">ED</span></span></a>
      <nav className="landing-nav" aria-label="Landing page sections"><a href="#features" onClick={event => scrollTo(event, "features")}>Features</a><a href="#how-it-works" onClick={event => scrollTo(event, "how-it-works")}>How it works</a><a href="#security" onClick={event => scrollTo(event, "security")}>Security</a></nav>
      <div className="landing-header-actions"><button className="landing-theme" onClick={toggleTheme} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>{isDark ? <FaSun /> : <FaMoon />}</button><Link className="landing-button landing-button-quiet" to="/auth">Sign in <FaArrowRight aria-hidden="true" /></Link></div>
    </header>
    <main ref={scrollRef} className="landing-scroll" aria-label="About TrackED" tabIndex={-1}>
      <div ref={contentRef} className="landing-content">
        <section id="home" className="landing-hero landing-container" aria-labelledby="landing-title" tabIndex={-1}>
          <div className="landing-hero-copy">
            <Reveal><p className="landing-eyebrow"><span /> CCIT departmental event attendance</p></Reveal>
            <Reveal delay={70}><h1 id="landing-title">Track every event.<br />Keep your <span>records clear.</span></h1></Reveal>
            <Reveal delay={140}><p className="landing-lead">Monitor departmental event attendance, review excuse letters, and track required community service hours—all in TrackED.</p></Reveal>
            <Reveal delay={210} className="landing-hero-actions"><Link to="/auth/signup" className="landing-button landing-button-primary">Get started <FaArrowRight aria-hidden="true" /></Link><a href="#how-it-works" className="landing-text-link" onClick={event => scrollTo(event, "how-it-works")}>See how it works <FaArrowDown aria-hidden="true" /></a></Reveal>
            <Reveal delay={250}><div className="landing-audience"><span><FaCheck aria-hidden="true" /> Students</span><span><FaCheck aria-hidden="true" /> Organizers</span><span><FaCheck aria-hidden="true" /> Administrators</span></div></Reveal>
          </div>
          <Reveal variant="scale" delay={120} className="landing-hero-visual">
            <figure className="landing-hero-frame"><img src={campus} width={1400} height={933} fetchPriority="high" alt="Three students walking together with books outside a campus building" /><span className="landing-photo-label">Made for campus life</span><figcaption><span className="landing-caption-line" />Every event.<br />A chance to belong.</figcaption></figure>
            <div className="landing-visual-note"><span className="landing-note-icon"><FaCamera aria-hidden="true" /></span><div><strong>A familiar face. A simpler check-in.</strong><p>Face verification at the event station.</p></div><FaArrowRight aria-hidden="true" /></div>
          </Reveal>
          <a href="#features" className="landing-explore" onClick={event => scrollTo(event, "features")}><span>Explore TrackED</span><FaArrowDown aria-hidden="true" /></a>
        </section>
        <section id="features" className="landing-section landing-container" aria-labelledby="features-title" tabIndex={-1}>
          <Reveal className="landing-section-heading"><div><p className="landing-eyebrow">Attendance monitoring and reporting</p><h2 id="features-title">Attendance and records,<br />in one place.</h2></div><p>Keep event attendance, required service hours, and review decisions connected and easy to find.</p></Reveal>
          <div className="landing-features">{features.map((feature, index) => <Reveal key={feature.title} delay={index * 65} as="article" className="landing-feature"><span className="landing-feature-index">0{index + 1}</span><span className="landing-feature-icon">{feature.icon}</span><h3>{feature.title}</h3><p>{feature.desc}</p></Reveal>)}</div>
        </section>
        <section className="landing-section landing-container landing-community" aria-labelledby="community-title">
          <Reveal className="landing-community-photo"><img src={community} width={1200} height={800} loading="lazy" decoding="async" alt="Volunteers working together to collect litter from a green field" /><span>Participation that makes a difference.</span></Reveal>
          <Reveal className="landing-community-copy"><p className="landing-eyebrow">Community service ledger</p><h2 id="community-title">Know your balance.<br />See where the hours came from.</h2><p>Absences and late marks add required community service hours. Your ledger shows the related events, penalties, and hours removed through approved excuses or administrator adjustments.</p><ul><li><FaCheck aria-hidden="true" /> Required service hours remaining</li><li><FaCheck aria-hidden="true" /> Event-by-event attendance history</li><li><FaCheck aria-hidden="true" /> Penalty and adjustment breakdowns</li></ul><a href="#how-it-works" className="landing-text-link" onClick={event => scrollTo(event, "how-it-works")}>Tools for each role <FaArrowRight aria-hidden="true" /></a></Reveal>
        </section>
        <section id="how-it-works" className="landing-section landing-container" aria-labelledby="roles-title" tabIndex={-1}>
          <Reveal className="landing-section-heading"><div><p className="landing-eyebrow">How it works</p><h2 id="roles-title">Three roles.<br />One connected department.</h2></div><p>Everyone has a clear place to start, with the right tools for the work they do.</p></Reveal>
          <div className="landing-roles">{roles.map((role, index) => <Reveal as="article" key={role.n} delay={index * 80} className="landing-role"><div className="landing-role-photo"><img src={role.image} alt={role.alt} width={1000} height={667} style={{ objectPosition: role.position }} loading="lazy" decoding="async" /><span>{role.n}</span></div><div className="landing-role-copy"><p className="landing-eyebrow">{role.icon} {role.role}</p><h3>{role.title}</h3><p>{role.description}</p></div></Reveal>)}</div>
        </section>
        <section id="security" className="landing-section landing-container landing-security" aria-labelledby="security-title" tabIndex={-1}>
          <Reveal className="landing-security-intro"><span className="landing-security-symbol"><FaShieldAlt aria-hidden="true" /></span><p className="landing-eyebrow">Attendance verification and review</p><h2 id="security-title">Face check-in.<br />Reviewed manual requests.</h2><p>Organizers operate face stations and submit documented manual requests when needed. Approved manual attendance uses the verified check-in time to determine attendance status.</p></Reveal>
          <div className="landing-security-grid">{securityPoints.map((point, index) => <Reveal as="article" key={point.title} delay={index * 50} className="landing-security-item"><span className="landing-feature-icon">{point.icon}</span><h3>{point.title}</h3><p>{point.description}</p></Reveal>)}</div>
        </section>
        <section ref={ctaRef} className="landing-final landing-container" aria-labelledby="get-started-title">
          <Reveal className="landing-final-inner"><span className="landing-brand-icon"><TrackMark className="h-7 w-7" /></span><p className="landing-eyebrow">Your next event starts here</p><h2 id="get-started-title">Show up.<br /><span>We’ll help you keep track.</span></h2><p>Create your student account, enroll your face, and get ready for your next departmental event.</p><Link to="/auth/signup" className="landing-button landing-button-primary">Get started <FaArrowRight aria-hidden="true" /></Link><p className="landing-final-note">Already registered? <Link to="/auth">Sign in to your account</Link>.<br />Organizer access is granted to students by an administrator.</p></Reveal>
        </section>
        <footer className="landing-footer landing-container"><span>© {new Date().getFullYear()} TrackED</span><span>CCIT departmental event attendance &amp; reporting</span><a href="https://www.pexels.com/" target="_blank" rel="noreferrer">Photography: Pexels <FaArrowRight aria-hidden="true" /></a></footer>
      </div>
    </main>
    <Link to="/auth/signup" aria-hidden={hideFloatingCta} tabIndex={hideFloatingCta ? -1 : 0} className={`landing-floating-cta landing-button landing-button-primary ${hideFloatingCta ? "is-hidden" : ""}`}>Get started <FaArrowRight aria-hidden="true" /></Link>
  </AppBackground>;
}
