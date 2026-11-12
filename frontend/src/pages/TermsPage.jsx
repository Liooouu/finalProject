import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import TrackMark from "../components/shared/TrackMark";
import ThemeToggle from "../components/ui/ThemeToggle";
import TutorialGuide from "../components/shared/TutorialGuide";
import "../styles/terms.css";

const sections = [
  {
    id: "purpose",
    title: "1. Purpose and scope",
    paragraphs: [
      "TrackED supports CCIT departmental event attendance, excuse-letter review, community service records, and administrative reporting. Use it for authorized departmental activities. These system-use terms supplement the school’s attendance and student-conduct rules; the department determines the applicable academic requirements.",
    ],
  },
  {
    id: "accounts",
    title: "2. Accounts and access",
    paragraphs: [
      "Provide accurate account and academic information. Keep your password and email recovery codes private, use your own account, and report suspected unauthorized access to your department administrator.",
      "Verify email ownership before signing in and provide accurate academic details. TrackED does not check registration against an official registrar or departmental masterlist. Email verification confirms access to the email address; it does not establish current enrollment or CCIT membership. Administrators maintain student academic details and access permissions.",
      "Public registration is for students. An administrator may grant organizer access to a student, who retains their student account and records. Organizer access may be removed by an administrator. Administrators manage accounts and events, monitor records, and review requests; event organizers operate attendance stations.",
    ],
  },
  {
    id: "attendance",
    title: "3. Attendance and community service",
    paragraphs: [
      "Enroll your own face before using face attendance. Attend in person and follow the organizer’s station instructions. Do not impersonate another student, share access to submit attendance for someone else, use photographs or recordings to attempt a false check-in, or alter attendance evidence.",
      "Attendance follows the event’s configured attendance schedule. Late and absent marks can add required community service hours under the department’s rules. The ledger shows hours remaining, penalties, and approved adjustments; it does not automatically certify that service work has been completed.",
      "Face matching and network availability can fail. If a record appears incorrect, notify an organizer or administrator. Organizers can use ID-assisted check-in by photographing a physical school ID after comparing it with the student and selected account. A server-timed check-in can be recorded on the organizer’s attestation, which is not biometric or independent verification. Offline device-timed captures and conflicts require independent review. Organizers can also submit documented attendance corrections. An administrator or an organizer assigned as an event reviewer must independently review these exceptions and corrections. A requester or the student concerned cannot approve their own manual request. Approved present/late requests use the verified attendance time rather than the time of approval.",
      "Face stations require organizer supervision. Face matching does not eliminate photo or video spoofing risk. Initial enrollment should be checked against the student’s school ID. A check-in records attendance at that time and does not verify continuous presence until the event ends. Replacing an enrolled face with a different identity requires an administrative identity review.",
    ],
  },
  {
    id: "excuses",
    title: "4. Excuse letters",
    paragraphs: [
      "Excuse letters are for recorded absences after an event ends. Submit within seven days after the event’s scheduled end and include the required supporting attachment. Advance excuse letters are not accepted.",
      "Provide truthful reasons and relevant supporting documents. An eligible letter may be edited and resubmitted until approved, subject to the system’s checks. Approval is a review decision, not a guaranteed result of submission. Organizers may review other students’ letters, including those from students with organizer access, but cannot approve or reject their own letters. Administrators review letters across events.",
    ],
  },
  {
    id: "responsibilities",
    title: "5. Organizer and administrator responsibilities",
    paragraphs: [
      "Use privileged access only for departmental work. Organizers may collaborate on shared events and stations, but must verify students in person and document manual attendance accurately. Do not approve requests as a favor or without checking supporting information.",
      "Protect student records and attachments. Use exported reports only for authorized departmental purposes and do not publish personal or biometric information. Report inaccurate event schedules, suspected proxy attendance, or other misuse for administrative review.",
    ],
  },
  {
    id: "data",
    title: "6. Data handling and face consent",
    paragraphs: [
      "TrackED processes account and academic details, event attendance, service-hour records, excuse letters and attachments, and review history. Face enrollment stores a face photograph, a numerical face template used for matching, and enrollment/consent information. These records support attendance verification and related reviews.",
      "ID-assisted fallback stores a school ID photo as attendance evidence. Evidence is available only to the student concerned, the submitting organizer, authorized event reviewers, and administrators. The system removes server ID photos after 30 days while retaining the attendance audit. Unsynced photos stay encrypted in the submitting browser, are removed locally after a server receipt, and can be discarded there. Clearing browser data before syncing can permanently lose an unsynced capture. A device-timed offline capture is a claim requiring confirmation, not a trusted server timestamp.",
      "Face enrollment has its own consent step. Reading or agreeing to these terms does not replace that separate consent. If you have concerns about face enrollment or need assistance, contact your department before enrolling.",
      "Access depends on role: students view their own records; authorized organizers handle attendance and reviews; administrators monitor and manage departmental records. Email verification and password recovery use the configured email service. Records are not automatically erased when an event ends.",
      "For the school’s privacy contact, retention schedule, or requests to access, correct, or delete personal data, contact your department’s TrackED administrator or the school’s privacy office. The department must confirm its institutional privacy notice and retention arrangements; this overview does not replace them.",
    ],
  },
  {
    id: "support",
    title: "7. Corrections, availability, and updates",
    paragraphs: [
      "Check your attendance and service ledger and report discrepancies promptly. Include the event name, date, and relevant evidence when requesting a correction. Keep your own copies of documents you submit.",
      "Maintenance, camera limitations, and connectivity problems can interrupt access. Seek organizer assistance if a station cannot complete your check-in. These terms do not guarantee uninterrupted service, perfect face matching, or prevention of every attempt at proxy attendance.",
      "The displayed update date identifies this version of the terms. Review updated terms when notified. For questions about these terms or a decision affecting your records, contact your department’s TrackED administrator.",
    ],
  },
];

export default function TermsPage() {
  const navigate = useNavigate();
  return (
    <main className="terms-page">
      <div className="terms-container">
        <header className="terms-header">
          <Link to="/" className="terms-brand">
            <TrackMark className="h-7 w-7" /> TrackED
          </Link>
          <div className="flex items-center gap-3">
            <TutorialGuide />
            <ThemeToggle />
            <button
              onClick={() =>
                window.history.state?.idx > 0 ? navigate(-1) : navigate("/")
              }
              className="terms-back"
            >
              <FaArrowLeft aria-hidden="true" /> Back
            </button>
          </div>
        </header>
        <div className="terms-intro">
          <p className="terms-eyebrow">Responsible use of TrackED</p>
          <h1>Terms &amp; Conditions</h1>
          <p>Clear rules for accounts, attendance, and departmental records.</p>
          <span>Last updated: November 6, 2026</span>
        </div>
        <div className="terms-layout">
          <nav aria-label="Terms sections">
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.title}
              </a>
            ))}
          </nav>
          <article>
            {sections.map((section) => (
              <section key={section.id} id={section.id}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
            <aside className="terms-reference">
              Learn about privacy notices and your right to be informed from the{" "}
              <a
                href="https://privacy.gov.ph/the-right-to-be-informed/"
                target="_blank"
                rel="noopener noreferrer"
              >
                National Privacy Commission
              </a>
              .
            </aside>
            <Link to="/auth/signup" className="terms-register">
              Return to student registration →
            </Link>
          </article>
        </div>
        <footer className="terms-footer">
          <Link to="/">TrackED home</Link>
          <Link to="/auth">Sign in</Link>
        </footer>
      </div>
    </main>
  );
}
