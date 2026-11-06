import { useTransientState } from "../../utils/useTransientState";
import React, { useEffect, useRef, useState } from "react";
import "../../styles/portal-neumorphism.css";
import "../../styles/auth-neumorphism.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../../api/axios";
import {
  setAuth,
  getToken,
  setPendingVerificationEmail,
  getPendingVerificationEmail,
  clearPendingVerificationEmail,
  clearAuth,
} from "../../utils/auth";
import {
  isStrongPassword,
  PASSWORD_MESSAGE,
  PASSWORD_HINT,
} from "../../utils/password";
import {
  FaEye,
  FaEyeSlash,
  FaArrowRight,
  FaShieldAlt,
  FaArrowLeft,
} from "react-icons/fa";
import TrackMark from "../../components/shared/TrackMark";
import AppBackground from "../../components/shared/AppBackground";
import BrandMark from "../../components/shared/BrandMark";
import features from "../../data/features";
import Button from "../../components/ui/Button";
import ThemeToggle from "../../components/ui/ThemeToggle";
import FaceCapture from "../../components/auth/FaceCapture";
import { useTheme } from "../../context/ThemeContext";
import techDark from "../../assets/images/tech-bg-dark.jpg";

// Original mobile form; the raised treatment is enabled only at desktop widths.
const panelClasses =
  "auth-panel animate-fade-up lg:rounded-[var(--panel-radius)] lg:border lg:border-line lg:bg-card lg:p-8 lg:shadow-[var(--panel-shadow)]";

const AuthPage = () => {
  const [desktopAuth, setDesktopAuth] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktopAuth(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Sign-in and sign-up each own a route (/auth and /auth/signup), so the
  // switch behaves like a real page change — the URL updates and the browser's
  // back button works — instead of a silent in-place toggle.
  const location = useLocation();
  const isLogin = !location.pathname.startsWith("/auth/signup");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useTransientState("");
  const [formData, setFormData] = useState({
    // Names are collected in three parts so records stay searchable, then joined
    // into the single `name` the account already stores (no schema change).
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    program: "",
    yearLevel: "",
    section: "",
  });
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // A rejected signup keeps the user on the same screen, so the masked fields
  // have to be cleared explicitly — otherwise the password that just failed
  // stays in place and gets resubmitted on the next attempt.
  const passwordRef = useRef(null);
  const resetPasswordFields = () => {
    setFormData(current => ({
      ...current,
      password: "",
      confirmPassword: "",
    }));
    setShowPassword(false);
    setShowConfirmPassword(false);
    passwordRef.current?.focus();
  };

  const [flow, setFlow] = useState("form");
  const [pendingAuth, setPendingAuth] = useState(null);
  // Email-verification step (signup only).
  const [pendingEmail, setPendingEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollConsent, setEnrollConsent] = useState(false);
  const [enrollAgreed, setEnrollAgreed] = useState(false);
  const [fpStage, setFpStage] = useState("form"); // "form" (email) | "code"
  const [fpEmail, setFpEmail] = useState("");
  const [fpCode, setFpCode] = useState("");
  const [fpPassword, setFpPassword] = useState("");
  const [fpConfirm, setFpConfirm] = useState("");
  const [fpShowPassword, setFpShowPassword] = useState(false);
  const [fpShowConfirm, setFpShowConfirm] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpResendIn, setFpResendIn] = useState(0);
  const [fpNotice, setFpNotice] = useTransientState(""); // success banner on sign-in

  const navigate = useNavigate();
  const { isDark } = useTheme();

  const showLogin = () => navigate("/auth");
  const showSignup = () => navigate("/auth/signup");

  const finishAuth = (token, role) => {
    clearPendingVerificationEmail();
    setAuth(token, role);
    navigate(`/${role}/dashboard`);
  };

  const continueAuth = (data) => {
    if (data.role === "student" && data.requiresFaceEnrollment) {
      setAuth(data.token, data.role);
      setPendingAuth({ token: data.token, role: data.role });
      setEnrollConsent(false);
      setEnrollAgreed(false);
      setFlow("enrollFace");
      clearPendingVerificationEmail();
    } else {
      finishAuth(data.token, data.role);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    setFpNotice("");
  };

  // Tick the "resend code" cooldown down once a second.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // A student who signed up and left to read the emailed code comes back to a
  // reloaded tab. Resume the code screen instead of dumping them on sign-in, so
  // a refresh never strands a half-created account. `resendIn` starts at 0 so
  // they can immediately request a fresh code if the first one expired.
  useEffect(() => {
    const pending = getPendingVerificationEmail();
    if (pending && !getToken()) {
      setPendingEmail(pending);
      setEmailCode("");
      setError("");
      setResendIn(0);
      setFlow("verifyEmail");
    }
    // Mount-only: this restores state lost to a refresh, not a live navigation.
  }, [setError]);

  // Separate tick for the password-reset resend cooldown, so leaving one flow
  // mid-countdown never leaves the other one stuck.
  useEffect(() => {
    if (fpResendIn <= 0) return;
    const t = setTimeout(() => setFpResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [fpResendIn]);

  const startEmailVerification = (email) => {
    const value = email || formData.email.trim();
    setPendingEmail(value);
    if (value) setPendingVerificationEmail(value);
    setEmailCode("");
    setResendIn(60);
    setError("");
    setFlow("verifyEmail");
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setVerifyLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/verify-email", {
        email: pendingEmail.trim(),
        code: emailCode.trim(),
      });

      continueAuth(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendIn > 0 || verifyLoading) return;
    setVerifyLoading(true);
    setError("");
    try {
      await api.post("/auth/resend-verification", {
        email: pendingEmail.trim(),
      });
      setResendIn(60);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        const res = await api.post("/auth/login", {
          email: formData.email.trim(),
          password: formData.password.trim(),
        });

        continueAuth(res.data);
      } else {
        // The account keeps one display name; the three inputs exist so a
        // student record isn't entered as an unsearchable blob.
        const displayName = [
          formData.firstName,
          formData.middleName,
          formData.lastName,
        ]
          .map((part) => String(part || "").trim())
          .filter(Boolean)
          .join(" ");

        if (!formData.firstName.trim() || !formData.lastName.trim()) {
          setError("Enter your first and last name.");
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match");
          resetPasswordFields();
          return;
        }

        if (!isStrongPassword(formData.password.trim())) {
          setError(PASSWORD_MESSAGE);
          resetPasswordFields();
          return;
        }

        const res = await api.post("/auth/register", {
          name: displayName,
          firstName: formData.firstName.trim(),
          middleName: formData.middleName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          role: "student",
          program: formData.program,
          yearLevel: Number(formData.yearLevel),
          section: formData.section,
        });

        // Email verification is enforced when the server can send mail.
        if (res.data.requiresEmailVerification) {
          startEmailVerification(res.data.email);
          if (res.data.codeSent === false) setError(res.data.message);
          setFormData({
            ...formData,
            firstName: "",
            middleName: "",
            lastName: "",
            password: "",
            confirmPassword: "",
            email: "",
          });
          setShowConfirmPassword(false);
          return;
        }

        continueAuth(res.data);
        setFormData({
          ...formData,
          firstName: "",
          middleName: "",
          lastName: "",
          password: "",
          confirmPassword: "",
          email: "",
        });
        setShowConfirmPassword(false);
      }
    } catch (err) {
      const data = err.response?.data;
      // Logging in with an unverified account → send them to the code screen.
      if (data?.requiresEmailVerification) {
        startEmailVerification(data.email || formData.email.trim());
        return;
      }
      // Signup failed on the server (duplicate email, weak password, SMTP
      // trouble). The form stays visible, so clear the rejected password
      // instead of leaving the user to retype over a masked value. Sign-in is
      // left alone: there the field holds a password they may simply mistype.
      if (!isLogin) resetPasswordFields();
      setError(data?.message || (err.response ? "Account service is temporarily unavailable. Please try again shortly. If you already submitted, try signing in to resume verification." : "Cannot connect to TrackED. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  };

  // ------------------- PASSWORD RESET (EMAIL CODE) -------------------
  const openForgotPassword = () => {
    setFpStage("form");
    setFpEmail(formData.email.trim());
    setFpCode("");
    setFpPassword("");
    setFpConfirm("");
    setFpShowPassword(false);
    setFpShowConfirm(false);
    setFpResendIn(0);
    setFpNotice("");
    setError("");
    setFlow("forgotPassword");
  };

  const backToSignIn = () => {
    setFlow("form");
    showLogin();
    setError("");
  };

  // Shared by the first "Send Code" and by "Resend code". The server answers
  // identically for known and unknown addresses, so we always move on to the
  // code stage — an account that doesn't exist simply never receives a valid
  // code, and no email list can be harvested from this screen.
  const sendResetCode = async () => {
    setFpLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email: fpEmail.trim() });
      setFpStage("code");
      setFpCode("");
      setFpResendIn(60);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setFpLoading(false);
    }
  };

  const handleForgotPasswordSend = (e) => {
    e.preventDefault();
    sendResetCode();
  };

  const handleForgotPasswordResend = () => {
    if (fpResendIn > 0 || fpLoading) return;
    sendResetCode();
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (fpPassword.trim() !== fpConfirm.trim()) {
      setError("Passwords do not match");
      return;
    }
    if (!isStrongPassword(fpPassword.trim())) {
      setError(PASSWORD_MESSAGE);
      return;
    }

    setFpLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password/verify", {
        email: fpEmail.trim(),
        code: fpCode.trim(),
        password: fpPassword.trim(),
      });

      // Back to sign-in — this flow never signs anyone in, it only rewrites
      // the password. The user signs in again afterwards.
      setFlow("form");
      showLogin();
      setFpNotice("Password updated. Sign in with your new password.");
      setFormData({ ...formData, email: fpEmail.trim(), password: "" });
      setFpCode("");
      setFpPassword("");
      setFpConfirm("");
      setFpResendIn(0);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setFpLoading(false);
    }
  };

  const handleEnrollPhoto = async (blob) => {
    setEnrolling(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("face", blob, "face.jpg");
      fd.append("consent", "true");
      await api.post("/account/face", fd);
      if (pendingAuth) {
        finishAuth(pendingAuth.token, pendingAuth.role);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to save face photo.",
      );
    } finally {
      setEnrolling(false);
    }
  };

  // One field language for every auth screen, matching the rest of the app.
  const inputClasses = "field auth-field";

  return (
    <AppBackground
      className={`auth-responsive ${!isLogin && flow === "form" ? "auth-signup" : ""} ${desktopAuth ? `portal-refined portal-neumorphic auth-neumorphic auth-reference ${flow === "forgotPassword" ? "auth-is-recovery" : ""}` : ""}`}
    >
      <div
        className="auth-city-backdrop"
        aria-hidden="true"
        style={{ backgroundImage: `url(${techDark})` }}
      />
      <div className="auth-shell relative flex w-full min-h-screen">
        <ThemeToggle className="auth-theme-toggle" />
        {/* Desktop branding panel; password recovery uses a centered form. */}
        {flow !== "forgotPassword" && (
          <div className="auth-brand-panel relative hidden w-1/2 overflow-hidden lg:block">
            <img
              src={techDark}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Indigo recolor to match brand */}
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                mixBlendMode: "color",
                background: "var(--brand)",
                opacity: isDark ? 0.55 : 0.45,
              }}
            />
            {/* Legibility scrim */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 via-indigo-950/60 to-slate-900/40"
            />

            <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
              <BrandMark onLight />

              <div
                key={isLogin ? "panel-login" : "panel-signup"}
                className="animate-fade-up"
              >
                <h2 className="max-w-md font-display text-3xl font-bold leading-tight text-white xl:text-4xl">
                  {isLogin
                    ? "Track every event and community service hour."
                    : "Your student account starts here."}
                </h2>
                <p className="mt-3 max-w-md text-white/80">
                  {isLogin
                    ? "TrackED keeps event attendance in clear focus for students, organizers, and admins."
                    : "Register with your school email, verify it with a 6-digit code, and your next event is one glance away."}
                </p>

                {isLogin && (
                  <div className="mt-9 grid gap-3 sm:grid-cols-2">
                    {features.map((f) => (
                      <div
                        key={f.title}
                        className="flex items-start gap-3.5 rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur-sm"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white ring-1 ring-inset ring-white/10">
                          {f.icon}
                        </span>
                        <div>
                          <p className="font-semibold text-white">{f.title}</p>
                          <p className="mt-0.5 text-sm text-white/75">
                            {f.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-white/60">
                © {new Date().getFullYear()} TrackED · Events Attendance
                Management System
              </p>
            </div>
          </div>
        )}

        {/* Right — authentication */}
        <div className="auth-form-column relative flex min-h-screen w-full flex-1 items-center justify-center p-4 sm:p-8">
          {/* City backdrop for mobile auth and the centered recovery flow. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-gradient-to-b from-[#eef2ff] via-[#f7f5ff] to-[#e9f1ff] dark:from-[#0b1020] dark:via-[#141136] dark:to-[#0a1024] ${
              flow !== "forgotPassword" ? "lg:hidden" : ""
            }`}
          >
            <img
              src={techDark}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-[0.28] dark:opacity-[0.4]"
            />
            {/* Indigo recolor to match brand (same blend as the desktop panel) */}
            <div
              className="absolute inset-0"
              style={{
                mixBlendMode: "color",
                background: "var(--brand)",
                opacity: isDark ? 0.4 : 0.3,
              }}
            />
            {/* Legibility scrim — keeps every auth state readable over the photo */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/60 to-white/88 dark:from-[#0b1020]/80 dark:via-[#0b1020]/60 dark:to-[#0a1024]/88" />
            <div className="absolute -right-24 top-1/4 h-96 w-96 rotate-45 rounded-[4rem] bg-[var(--brand)]/20 blur-3xl dark:bg-[var(--brand)]/15" />
            <div className="absolute -left-20 bottom-8 h-72 w-72 -rotate-12 rounded-[3rem] bg-[var(--brand-2)]/25 blur-3xl dark:bg-[var(--brand-2)]/15" />
            <div className="absolute inset-x-0 top-1/3 h-40 -rotate-6 bg-white/40 blur-2xl dark:bg-white/5" />
          </div>

          <div className="w-full max-w-md">
            {/* Brand (mobile / tablet, since the photo panel is hidden below lg).
              The password-reset screens carry their own circular brand badge
              instead, so this one stands down there. */}
            {flow !== "forgotPassword" && (
              <div className="mb-6 flex justify-center lg:hidden">
                <BrandMark />
              </div>
            )}

            {flow === "verifyEmail" ? (
              <div className={panelClasses}>
                <div className="mb-6 flex flex-col items-center gap-4 text-center">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                    <FaShieldAlt />
                  </span>
                  <div>
                    <h1 className="font-display text-xl font-bold tracking-tight text-on">
                      Verify your email
                    </h1>
                    <p className="mt-1.5 text-sm text-on-dim">
                      We sent a 6-digit code to{" "}
                      <span className="font-semibold text-on">
                        {pendingEmail}
                      </span>
                      . Enter it below to finish creating your account.
                    </p>
                  </div>
                </div>

                {error && (
                  <div role="alert" className="alert alert-danger mb-5">
                    {error}
                  </div>
                )}

                <form onSubmit={handleVerifyEmail} className="space-y-4">
                  <p className="text-sm leading-relaxed text-on-dim">
                    Can&apos;t find the code? Check Spam or Junk for the TrackED
                    verification email. If it&apos;s there, mark it as &quot;Not
                    spam&quot;, then enter the latest code here.
                  </p>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="verify-email-code"
                      className="text-sm font-medium text-on"
                    >
                      Verification code
                    </label>
                    <input
                      id="verify-email-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      pattern="\d{6}"
                      value={emailCode}
                      onChange={(e) => {
                        setEmailCode(e.target.value.replace(/\D/g, ""));
                        setError("");
                      }}
                      placeholder="••••••"
                      className={`${inputClasses} text-center text-xl tracking-[0.4em]`}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={verifyLoading}
                    className="w-full py-2.5"
                  >
                    {verifyLoading ? "Verifying..." : "Verify email"}
                  </Button>
                </form>

                <div className="mt-4 flex flex-col items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    disabled={resendIn > 0 || verifyLoading}
                    className="font-medium text-on-dim hover:text-on disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resendIn > 0
                      ? `Resend code in ${resendIn}s`
                      : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFlow("form");
                      setEmailCode("");
                      setError("");
                      clearPendingVerificationEmail();
                      showLogin();
                    }}
                    className="font-medium text-on-dim hover:text-on"
                  >
                    ← Back to sign in
                  </button>
                </div>
              </div>
            ) : flow === "enrollFace" ? (
              <div className={panelClasses}>
                <div className="mb-6 flex flex-col items-center gap-4 text-center">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                    <FaShieldAlt />
                  </span>
                  <div>
                    <h1 className="font-display text-xl font-bold tracking-tight text-on">
                      Enroll your face
                    </h1>
                    <p className="mt-1.5 text-sm text-on-dim">
                      Attendance is recorded by face at the organizer&apos;s
                      check-in station, so your face needs to be on file before
                      your first event. One quick photo is enough — you never
                      scan a QR code or show your phone.
                    </p>
                  </div>
                </div>

                {error && (
                  <div role="alert" className="alert alert-danger mb-4">
                    <span aria-hidden="true">!</span>
                    <p>{error}</p>
                  </div>
                )}

                {!enrollConsent ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-line bg-card-alt/40 p-4 text-sm text-on-dim">
                      <p className="font-medium text-on">
                        How your face is used
                      </p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-5">
                        <li>
                          Your photo is stored privately and converted into a
                          mathematical signature used only to mark your
                          attendance.
                        </li>
                        <li>
                          Organizers see your name and attendance status — never
                          your photo or signature.
                        </li>
                        <li>
                          You can update your enrolled face later from Profile →
                          Security.
                        </li>
                      </ul>
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-card-alt/30 p-4 text-sm">
                      <input
                        type="checkbox"
                        checked={enrollAgreed}
                        onChange={(e) => {
                          setEnrollAgreed(e.target.checked);
                          setError("");
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
                      />
                      <span className="text-on-dim">
                        I agree to TrackED processing my face image to record my
                        event attendance.
                      </span>
                    </label>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEnrollAgreed(false);
                          setEnrollConsent(false);
                          clearAuth(pendingAuth?.role);
                          setPendingAuth(null);
                          setFlow("form");
                          showLogin();
                        }}
                        className="text-sm font-medium text-on-dim hover:text-on"
                      >
                        Sign out
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setEnrollConsent(true)}
                        disabled={!enrollAgreed}
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <FaceCapture
                      title="Save my face"
                      onCapture={handleEnrollPhoto}
                      onRetake={() => setError("")}
                      loading={enrolling}
                      loadingLabel="Saving..."
                      error={error}
                      onCancel={() => {
                        setEnrollConsent(false);
                        setError("");
                      }}
                    />
                    <p className="mt-3 text-center text-xs text-on-muted">
                      Face enrollment is required for student accounts. If your
                      camera is unavailable, contact an administrator for
                      enrollment assistance.
                    </p>
                  </>
                )}
              </div>
            ) : flow === "forgotPassword" ? (
              <div className={`${panelClasses} auth-recovery`}>
                {/* Return to the email step, or leave recovery for sign-in. */}
                <button
                  type="button"
                  aria-label="Back"
                  onClick={() =>
                    fpStage === "code" ? setFpStage("form") : backToSignIn()
                  }
                  className="-ml-1 mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-on-dim transition-colors hover:text-on"
                >
                  <FaArrowLeft />
                </button>

                {/* Centered recovery branding. */}
                <div className="mb-5 flex justify-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 text-brand shadow-[var(--elev-1)] ring-1 ring-brand/20 dark:bg-card-alt dark:ring-brand/30">
                    <TrackMark className="h-9 w-9" />
                  </span>
                </div>

                <div className="mb-6 text-center">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-on">
                    Forgot Password?
                  </h1>
                  <p className="mt-1.5 text-sm text-on-dim">
                    {fpStage === "form" ? (
                      "Enter your account email to request a six-digit recovery code. Then use the code to choose a new password."
                    ) : (
                      <>
                        We sent a 6-digit code to{" "}
                        <span className="font-semibold text-on">{fpEmail}</span>
                        . Enter it below with your new password.
                      </>
                    )}
                  </p>
                </div>

                {error && (
                  <div role="alert" className="alert alert-danger mb-5">
                    {error}
                  </div>
                )}


                {fpStage === "form" ? (
                  <form
                    onSubmit={handleForgotPasswordSend}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label
                        htmlFor="fp-email"
                        className="text-sm font-medium text-on"
                      >
                        Email
                      </label>
                      <input
                        id="fp-email"
                        type="email"
                        value={fpEmail}
                        onChange={(e) => {
                          setFpEmail(e.target.value);
                          setError("");
                        }}
                        placeholder="Enter your email"
                        autoComplete="email"
                        className={inputClasses}
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={fpLoading}
                      className="w-full py-2.5"
                    >
                      {fpLoading ? "Sending..." : "Send Code"}
                    </Button>
                  </form>
                ) : (
                  <form
                    onSubmit={handleForgotPasswordSubmit}
                    className="space-y-4"
                  >
                    <p className="text-sm leading-relaxed text-on-dim">
                      Check Spam or Junk if the TrackED recovery email is missing.
                      Mark the legitimate message as &quot;Not spam&quot; and use
                      the latest code you requested.
                    </p>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="fp-code"
                        className="text-sm font-medium text-on"
                      >
                        Verification code
                      </label>
                      <input
                        id="fp-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        pattern="\d{6}"
                        value={fpCode}
                        onChange={(e) => {
                          setFpCode(e.target.value.replace(/\D/g, ""));
                          setError("");
                        }}
                        placeholder="••••••"
                        className={`${inputClasses} text-center text-xl tracking-[0.4em]`}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="fp-password"
                        className="text-sm font-medium text-on"
                      >
                        New password
                      </label>
                      <div className="relative">
                        <input
                          id="fp-password"
                          type={fpShowPassword ? "text" : "password"}
                          value={fpPassword}
                          onChange={(e) => {
                            setFpPassword(e.target.value);
                            setError("");
                          }}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className={`${inputClasses} pr-11`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setFpShowPassword((v) => !v)}
                          aria-label={
                            fpShowPassword ? "Hide password" : "Show password"
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-muted hover:text-on"
                        >
                          {fpShowPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                      <p className="text-xs text-on-muted">{PASSWORD_HINT}</p>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="fp-confirm"
                        className="text-sm font-medium text-on"
                      >
                        Confirm new password
                      </label>
                      <div className="relative">
                        <input
                          id="fp-confirm"
                          type={fpShowConfirm ? "text" : "password"}
                          value={fpConfirm}
                          onChange={(e) => {
                            setFpConfirm(e.target.value);
                            setError("");
                          }}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className={`${inputClasses} pr-11`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setFpShowConfirm((v) => !v)}
                          aria-label={
                            fpShowConfirm ? "Hide password" : "Show password"
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-muted hover:text-on"
                        >
                          {fpShowConfirm ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={fpLoading}
                      className="w-full py-2.5"
                    >
                      {fpLoading ? "Saving..." : "Reset password"}
                    </Button>
                  </form>
                )}

                <div className="mt-4 flex flex-col items-center gap-2 text-sm">
                  {fpStage === "code" && (
                    <button
                      type="button"
                      onClick={handleForgotPasswordResend}
                      disabled={fpResendIn > 0 || fpLoading}
                      className="font-medium text-on-dim hover:text-on disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {fpResendIn > 0
                        ? `Resend code in ${fpResendIn}s`
                        : "Resend code"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={backToSignIn}
                    className="font-medium text-on-dim hover:text-on"
                  >
                    ← Back to sign in
                  </button>
                </div>
              </div>
            ) : (
              <div key={isLogin ? "signin" : "signup"} className={panelClasses}>
                <div className="mb-6 text-center lg:text-left">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-on">
                    {isLogin
                      ? "Sign in to your account"
                      : "Create your account"}
                  </h1>
                  <p className="mt-1.5 text-sm text-on-dim">
                    {isLogin
                      ? "Welcome back! Please enter your details."
                      : "Register to track your event attendance."}
                  </p>
                </div>

                {fpNotice && !error && isLogin && (
                  <div role="status" className="alert alert-ok mb-5">
                    {fpNotice}
                  </div>
                )}

                {error && (
                  <div role="alert" className="alert alert-danger mb-5">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="auth-name-fields">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="firstName"
                          className="text-sm font-medium text-on"
                        >
                          First Name
                        </label>
                        <input
                          id="firstName"
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          placeholder="First name"
                          autoComplete="given-name"
                          className={inputClasses}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="middleName"
                          className="text-sm font-medium text-on"
                        >
                          Middle Name{" "}
                          <span className="font-normal text-on-muted">
                            (optional)
                          </span>
                        </label>
                        <input
                          id="middleName"
                          type="text"
                          name="middleName"
                          value={formData.middleName}
                          onChange={handleChange}
                          placeholder="Middle name"
                          autoComplete="additional-name"
                          className={inputClasses}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="lastName"
                          className="text-sm font-medium text-on"
                        >
                          Last Name
                        </label>
                        <input
                          id="lastName"
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          placeholder="Last name"
                          autoComplete="family-name"
                          className={inputClasses}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="auth-email-field space-y-1.5">
                    <label
                      htmlFor="email"
                      className="text-sm font-medium text-on"
                    >
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@university.edu"
                      autoComplete="email"
                      className={inputClasses}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="password"
                        className="text-sm font-medium text-on"
                      >
                        Password
                      </label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={openForgotPassword}
                          className="text-xs font-medium text-brand hover:underline"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        ref={passwordRef}
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        autoComplete={
                          isLogin ? "current-password" : "new-password"
                        }
                        className={`${inputClasses} pr-11`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-muted hover:text-on"
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    {!isLogin && (
                      <p className="text-xs text-on-muted">{PASSWORD_HINT}</p>
                    )}
                  </div>

                  {!isLogin && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="confirmPassword"
                        className="text-sm font-medium text-on"
                      >
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className={`${inputClasses} pr-11`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          aria-label={
                            showConfirmPassword
                              ? "Hide password"
                              : "Show password"
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-muted hover:text-on"
                        >
                          {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>
                  )}

                  {!isLogin && (
                    <div className="auth-academic-fields">
                      <div className="min-w-0 space-y-1.5">
                        <label htmlFor="program" className="text-sm font-medium text-on">Program</label>
                        <select id="program" name="program" value={formData.program} onChange={handleChange} className={inputClasses} required>
                          <option value="" disabled>Select</option>
                          {["BSIT", "BSCS", "BSEMC"].map(value => <option key={value}>{value}</option>)}
                        </select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <label htmlFor="yearLevel" className="text-sm font-medium text-on">Year</label>
                        <select id="yearLevel" name="yearLevel" value={formData.yearLevel} onChange={handleChange} className={inputClasses} required>
                          <option value="" disabled>Select</option>
                          {[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}</option>)}
                        </select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <label htmlFor="section" className="text-sm font-medium text-on">Section</label>
                        <select id="section" name="section" value={formData.section} onChange={handleChange} className={inputClasses} required>
                          <option value="" disabled>Select</option>
                          {["A", "B", "C"].map(value => <option key={value}>{value}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  {!isLogin && <p className="text-xs leading-relaxed text-on-dim">Enter your current academic details and verify your email to continue.</p>}
                  {!isLogin && (
                    <p className="text-xs leading-relaxed text-on-dim">
                      Before registering, read the{" "}
                      <Link
                        to="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand underline underline-offset-2"
                      >
                        Terms &amp; Conditions
                      </Link>
                      . Face enrollment has a separate consent step.
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="skeleton h-4 w-4 rounded-full" />
                        Please wait...
                      </span>
                    ) : (
                      <>
                        {isLogin ? "Sign In" : "Create Account"}
                        <FaArrowRight className="text-xs" />
                      </>
                    )}
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-on-dim">
                  {isLogin ? (
                    <>
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          showSignup();
                          setError("");
                        }}
                        className="font-semibold text-brand hover:underline"
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          showLogin();
                          setError("");
                        }}
                        className="font-semibold text-brand hover:underline"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>

                {isLogin && (
                  <p className="mt-5 border-t border-line pt-4 text-center text-xs text-on-muted">
                    For organizer or admin access, contact your department.
                  </p>
                )}
              </div>
            )}
            {isLogin && flow === "form" && (
              <p className="mt-5 text-center text-xs text-on-muted">
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-brand"
                >
                  Terms &amp; Conditions
                </Link>
              </p>
            )}
            {flow === "form" && <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-on-dim hover:text-brand"
              >
                <FaArrowLeft aria-hidden="true" /> Back to TrackED home
              </button>
            </div>}
          </div>
        </div>
      </div>
    </AppBackground>
  );
};

export default AuthPage;
