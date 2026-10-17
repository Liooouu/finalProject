import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../api/axios";
import {
  setAuth,
  getToken,
  setPendingVerificationEmail,
  getPendingVerificationEmail,
  clearPendingVerificationEmail,
} from "../../utils/auth";
import { getDeviceId, getDeviceLabel } from "../../utils/device";
import { isStrongPassword, PASSWORD_MESSAGE, PASSWORD_HINT } from "../../utils/password";
import {
  FaEye,
  FaEyeSlash,
  FaArrowRight,
  FaShieldAlt,
  FaKey,
  FaCamera,
  FaArrowLeft,
} from "react-icons/fa";
import TrackMark from "../../components/shared/TrackMark";
import AppBackground from "../../components/shared/AppBackground";
import BrandMark from "../../components/shared/BrandMark";
import features from "../../data/features";
import Button from "../../components/ui/Button";
import FaceCapture from "../../components/auth/FaceCapture";
import { useTheme } from "../../context/ThemeContext";
import techDark from "../../assets/images/tech-bg-dark.jpg";
import techLight from "../../assets/images/tech-bg-light.jpg";

// One card for every auth screen. On desktop it's the familiar bordered,
// raised card; below `lg` it loses its box entirely so content sits straight
// on the phone gradient backdrop (the mobile mockup look) without changing a
// single flow or field.
const panelClasses =
  "animate-fade-up lg:rounded-2xl lg:border lg:border-line lg:bg-card lg:p-8 lg:shadow-xl lg:shadow-black/5";

const PinPanel = ({ pin, isRotated, message, onContinue, loading }) => (
  <div className={panelClasses}>
    <div className="mb-5 flex items-start gap-3.5">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${
          isRotated
            ? "bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400"
            : "bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400"
        }`}
      >
        <FaKey />
      </span>
      <div>
        <h1 className="text-lg font-bold tracking-tight text-on">
          {isRotated ? "Your security PIN changed" : "Save your security PIN"}
        </h1>
        <p className="mt-1 text-sm text-on-dim">
          {message ||
            (isRotated
              ? "This is now your security PIN. Record it somewhere safe."
              : "The system assigned this PIN. You'll need it the first time you sign in from a new device.")}
        </p>
      </div>
    </div>

    <div className="rounded-xl border border-dashed border-indigo-400/50 bg-indigo-500/5 px-4 py-5 text-center">
      <p className="text-2xl font-bold tracking-[0.45em] text-on sm:text-3xl">{pin}</p>
    </div>

    <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-line bg-card-alt/60 px-3.5 py-3 text-sm text-on-dim">
      <FaShieldAlt className="mt-0.5 shrink-0 text-indigo-500" />
      <p>
        Do not share your PIN. Because it rotates after each new-device sign-in, someone using only
        your login credentials still can't get in.
      </p>
    </div>

    <Button onClick={onContinue} disabled={loading} className="mt-6 w-full py-2.5">
      {isRotated ? "Got it, continue" : "I've saved it, continue"}
    </Button>
  </div>
);

const AuthPage = () => {
  // Sign-in and sign-up each own a route (/auth and /auth/signup), so the
  // switch behaves like a real page change — the URL updates and the browser's
  // back button works — instead of a silent in-place toggle.
  const location = useLocation();
  const isLogin = !location.pathname.startsWith("/auth/signup");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    program: "",
    yearLevel: "",
    section: "",
  });
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Extra auth steps introduced by the rotating security PIN
  const [flow, setFlow] = useState("form"); // "form" | "verifyPin" | "verifyEmail" | "pinPanel" | "forgot" | "forgotPassword" | "enrollFace"
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyPin, setVerifyPin] = useState("");
  const [pinInfo, setPinInfo] = useState(null); // { pin, isRotated, message }
  const [pendingAuth, setPendingAuth] = useState(null); // { token, role, next }
  // Email-verification step (signup only).
  const [pendingEmail, setPendingEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [forgotStage, setForgotStage] = useState("form"); // "form" | "capture"
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotInfo, setForgotInfo] = useState(null); // response of /forgot-pin check
  const [enrolling, setEnrolling] = useState(false);
  // Unauthenticated fallback: prove identity by email+password leg, then submit
  // a proof photo so an admin can unlock you.
  const [forgotAppealOpen, setForgotAppealOpen] = useState(false);
  const [forgotAppealNote, setForgotAppealNote] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealDone, setAppealDone] = useState(false);
  // Camera-less fallback: ask an admin or event organizer to reset the security
  // PIN on-site. Available whenever face verification can't be used (no camera,
  // no enrolled photo, or locked out) — no photo required.
  const [resetOpen, setResetOpen] = useState(false);
  const [resetNote, setResetNote] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  // Password reset ("Forgot Password?") — an emailed 6-digit code, kept fully
  // separate from the security-PIN recovery above. Two stages: ask for the
  // email, then the code + a new password. Deliberately signed-out-only: no
  // token is issued here, the user returns to the sign-in form afterwards.
  const [fpStage, setFpStage] = useState("form"); // "form" (email) | "code"
  const [fpEmail, setFpEmail] = useState("");
  const [fpCode, setFpCode] = useState("");
  const [fpPassword, setFpPassword] = useState("");
  const [fpConfirm, setFpConfirm] = useState("");
  const [fpShowPassword, setFpShowPassword] = useState(false);
  const [fpShowConfirm, setFpShowConfirm] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpResendIn, setFpResendIn] = useState(0);
  const [fpNotice, setFpNotice] = useState(""); // success banner on sign-in

  const navigate = useNavigate();
  const { isDark } = useTheme();

  const showLogin = () => navigate("/auth");
  const showSignup = () => navigate("/auth/signup");

  const finishAuth = (token, role) => {
    clearPendingVerificationEmail();
    setAuth(token, role);
    navigate(`/${role}/dashboard`);
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
  }, []);

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
        deviceId: getDeviceId(),
        deviceLabel: getDeviceLabel(),
      });

      setPinInfo({
        pin: res.data.pin,
        isRotated: false,
        message: "Your email is verified. This PIN unlocks future sign-ins from new devices.",
      });
      clearPendingVerificationEmail();
      setPendingAuth({ token: res.data.token, role: res.data.role, next: "enroll" });
      setFlow("pinPanel");
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
      await api.post("/auth/resend-verification", { email: pendingEmail.trim() });
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

        if (res.data.requiresPin) {
          setVerifyEmail(res.data.email || formData.email.trim());
          setVerifyPin("");
          setFlow("verifyPin");
        } else if (res.data.token && res.data.pin) {
          setPinInfo({
            pin: res.data.pin,
            isRotated: false,
            message: res.data.message,
          });
          setPendingAuth({ token: res.data.token, role: res.data.role });
          setFlow("pinPanel");
        } else {
          finishAuth(res.data.token, res.data.role);
        }
      } else {
        const normalizedProgram = String(formData.program || "")
          .trim()
          .toUpperCase();
        const normalizedSection = String(formData.section || "")
          .trim()
          .toUpperCase();
        const yearNum = Number(formData.yearLevel);

        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match");
          return;
        }

        if (!isStrongPassword(formData.password.trim())) {
          setError(PASSWORD_MESSAGE);
          return;
        }

        const res = await api.post("/auth/register", {
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          role: "student",
          program: normalizedProgram,
          yearLevel: yearNum,
          section: normalizedSection,
        });

        // Email verification is enforced when the server can send mail.
        if (res.data.requiresEmailVerification) {
          startEmailVerification(res.data.email);
          setFormData({ ...formData, name: "", password: "", confirmPassword: "", email: "" });
          setShowConfirmPassword(false);
          return;
        }

        setPinInfo({
          pin: res.data.pin,
          isRotated: false,
          message: "Your account is ready. This PIN unlocks future sign-ins from new devices.",
        });
        setPendingAuth({ token: res.data.token, role: res.data.role, next: "enroll" });
        setFlow("pinPanel");
        setFormData({ ...formData, name: "", password: "", confirmPassword: "", email: "" });
        setShowConfirmPassword(false);
      }
    } catch (err) {
      const data = err.response?.data;
      // Logging in with an unverified account → send them to the code screen.
      if (data?.requiresEmailVerification) {
        startEmailVerification(data.email || formData.email.trim());
        return;
      }
      setError(data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/verify-device", {
        email: verifyEmail,
        pin: verifyPin.trim(),
        deviceId: getDeviceId(),
        deviceLabel: getDeviceLabel(),
      });

      // Verification succeeds silently — the PIN rotates in the background, and
      // the student can view the current PIN on the Security settings page.
      finishAuth(res.data.token, res.data.role);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handlePinPanelContinue = () => {
    if (pendingAuth) {
      if (pendingAuth.next === "enroll") {
        // Store the token now so the face enrollment call authenticates, but
        // don't navigate until enrollment is done.
        setAuth(pendingAuth.token, pendingAuth.role);
        setFlow("enrollFace");
      } else {
        finishAuth(pendingAuth.token, pendingAuth.role);
      }
    } else {
      setPinInfo(null);
      showLogin();
      setFlow("form");
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
      // the password. The security PIN is untouched.
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

  const openForgot = () => {
    setForgotStage("form");
    setForgotInfo(null);
    setVerifyEmail(formData.email.trim() || verifyEmail);
    setForgotPassword(formData.password.trim() || forgotPassword);
    setForgotAppealOpen(false);
    setForgotAppealNote("");
    setAppealDone(false);
    setResetOpen(false);
    setResetNote("");
    setResetDone(false);
    setResetMessage("");
    setError("");
    setFlow("forgot");
  };

  const handleForgotCheck = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/forgot-pin", {
        email: verifyEmail.trim(),
        password: forgotPassword,
      });
      setForgotInfo(res.data);
      if (res.data.enrolled && !res.data.locked) setForgotStage("capture");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryPhoto = async (blob) => {
    setEnrolling(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("email", verifyEmail.trim());
      fd.append("password", forgotPassword);
      fd.append("deviceId", getDeviceId());
      fd.append("deviceLabel", getDeviceLabel());
      fd.append("photo", blob, "selfie.jpg");

      const res = await api.post("/auth/forgot-pin/verify", fd);
      setPinInfo({
        pin: res.data.pin,
        isRotated: false,
        message: res.data.message,
      });
      setPendingAuth({ token: res.data.token, role: res.data.role, next: "dashboard" });
      setFlow("pinPanel");
    } catch (err) {
      if (err.response?.status === 429) {
        // Locked out mid-flow — leave the scanner and surface the appeal and
        // camera-less reset options on the form stage.
        setForgotInfo({ enrolled: true, locked: true });
        setForgotStage("form");
      }
      setError(err.response?.data?.message || "Face verification failed. Try again.");
    } finally {
      setEnrolling(false);
    }
  };

  const submitForgotAppeal = async (blob) => {
    setAppealSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("email", verifyEmail.trim());
      fd.append("password", forgotPassword);
      fd.append("note", forgotAppealNote.trim());
      fd.append("photo", blob, "proof.jpg");
      await api.post("/auth/forgot-pin/appeal", fd);
      setAppealDone(true);
      setForgotAppealOpen(false);
      setForgotAppealNote("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit appeal. Try again.");
    } finally {
      setAppealSubmitting(false);
    }
  };

  const submitResetRequest = async (e) => {
    if (e) e.preventDefault();
    setResetSubmitting(true);
    setError("");
    try {
      const res = await api.post("/auth/forgot-pin/reset-request", {
        email: verifyEmail.trim(),
        password: forgotPassword,
        note: resetNote.trim(),
        deviceId: getDeviceId(),
        deviceLabel: getDeviceLabel(),
      });
      setResetMessage(res.data.message);
      setResetDone(true);
      setResetOpen(false);
      setResetNote("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send your request. Try again.");
    } finally {
      setResetSubmitting(false);
    }
  };

  const renderAppealBox = () => (
    <div className="rounded-xl border border-line bg-card-alt/50 p-4">
      <p className="mb-3 text-sm text-on-dim">
        Take a clear photo of yourself as proof, then submit. An admin will review it and unlock
        you.
      </p>
      <FaceCapture
        title="Take proof photo"
        onCapture={submitForgotAppeal}
        onCancel={() => setForgotAppealOpen(false)}
        loading={appealSubmitting}
      />
      <textarea
        value={forgotAppealNote}
        onChange={(e) => setForgotAppealNote(e.target.value)}
        placeholder="Optional note for the admin (e.g. new phone, camera broken, changed appearance)..."
        rows={2}
        className={inputClasses}
      />
    </div>
  );

  // Camera-less path: a note-only request (no photo) that staff confirm on-site.
  const renderResetBox = () => (
    <form onSubmit={submitResetRequest} className="rounded-xl border border-line bg-card-alt/50 p-4">
      <p className="mb-3 text-sm text-on-dim">
        No camera needed. Add a note if you like, then take this request to an admin or event
        organizer — they&apos;ll verify you in person and give you your new security PIN.
      </p>
      <textarea
        value={resetNote}
        onChange={(e) => setResetNote(e.target.value)}
        placeholder="Optional note (e.g. which class you're from)..."
        rows={2}
        className={`${inputClasses} mb-3 resize-none`}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={resetSubmitting} className="flex-1 py-2">
          {resetSubmitting ? "Sending..." : "Send request"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setResetOpen(false);
            setError("");
          }}
          className="py-2"
        >
          Cancel
        </Button>
      </div>
    </form>
  );

  const handleEnrollPhoto = async (blob) => {
    setEnrolling(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("face", blob, "face.jpg");
      await api.post("/account/face", fd);
      if (pendingAuth) {
        finishAuth(pendingAuth.token, pendingAuth.role);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to save face photo.");
    } finally {
      setEnrolling(false);
    }
  };

  // Phone: white pill inputs with a soft shadow (mockup). Desktop: unchanged
  // bordered input inside the card.
  const inputClasses =
    "w-full rounded-xl border border-transparent bg-white px-3.5 py-3 text-sm text-on shadow-sm placeholder-on-muted focus:border-transparent focus:outline-none transition-colors dark:bg-card-alt/60 lg:rounded-lg lg:border lg:border-line lg:bg-card-alt/60 lg:py-2.5 lg:shadow-none";

  return (
    <AppBackground>
      <div className="relative flex w-full min-h-screen">
        {/* Left — photo + branding panel. Sign-in only: sign-up drops the
            split so the form sits alone on the backdrop at every size. */}
        {isLogin && (
        <div className="relative hidden w-1/2 overflow-hidden lg:block">
          <img
            src={isDark ? techDark : techLight}
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
              background: "#6366f1",
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

            <div key={isLogin ? "panel-login" : "panel-signup"} className="animate-fade-up">
              <h2 className="max-w-md text-3xl font-bold leading-tight text-white xl:text-4xl">
                {isLogin
                  ? "Track every event and community service hour."
                  : "New here? Create your account in about a minute."}
              </h2>
              <p className="mt-3 max-w-md text-indigo-100/80">
                {isLogin
                  ? "TrackED keeps event attendance in clear focus for students, organizers, and admins."
                  : "Register with your school email, verify it with a 6-digit code, and your next event is one scan away."}
              </p>

              <div className="mt-9 grid gap-3 sm:grid-cols-2">
                {features.map((f) => (
                  <div
                    key={f.title}
                    className="flex items-start gap-3.5 rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur-sm"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/40 text-indigo-100 ring-1 ring-inset ring-white/10">
                      {f.icon}
                    </span>
                    <div>
                      <p className="font-semibold text-white">{f.title}</p>
                      <p className="mt-0.5 text-sm text-indigo-100/75">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-indigo-100/60">
              © {new Date().getFullYear()} TrackED · Events Attendance Management System
            </p>
          </div>
        </div>
        )}

        {/* Right — authentication */}
        <div className="relative flex min-h-screen w-full flex-1 items-center justify-center p-4 sm:p-8">
          {/* Phone only: the mockup's soft blue→violet wash with a couple of
              diagonal indigo bands, over a faded copy of the same photo the
              desktop panel uses — so the phone keeps the brand's photographic
              texture without hurting legibility. Hidden at lg and above, where
              the full-strength photo panel takes over. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-gradient-to-b from-[#eef2ff] via-[#f7f5ff] to-[#e9f1ff] dark:from-[#0b1020] dark:via-[#141136] dark:to-[#0a1024] ${
              isLogin ? "lg:hidden" : ""
            }`}
          >
            <img
              src={isDark ? techDark : techLight}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-[0.28] dark:opacity-[0.4]"
            />
            {/* Indigo recolor to match brand (same blend as the desktop panel) */}
            <div
              className="absolute inset-0"
              style={{
                mixBlendMode: "color",
                background: "#6366f1",
                opacity: isDark ? 0.4 : 0.3,
              }}
            />
            {/* Legibility scrim — keeps every auth state readable over the photo */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/60 to-white/88 dark:from-[#0b1020]/80 dark:via-[#0b1020]/60 dark:to-[#0a1024]/88" />
            <div className="absolute -right-24 top-1/4 h-96 w-96 rotate-45 rounded-[4rem] bg-indigo-400/20 blur-3xl dark:bg-indigo-500/15" />
            <div className="absolute -left-20 bottom-8 h-72 w-72 -rotate-12 rounded-[3rem] bg-violet-400/25 blur-3xl dark:bg-violet-500/15" />
            <div className="absolute inset-x-0 top-1/3 h-40 -rotate-6 bg-white/40 blur-2xl dark:bg-white/5" />
          </div>

          <div className="w-full max-w-md">
          {/* Brand (mobile / tablet, since the photo panel is hidden below lg).
              The password-reset screens carry their own circular brand badge
              instead, so this one stands down there. */}
          {flow !== "forgotPassword" && (
            <div className={`mb-6 flex justify-center ${isLogin ? "lg:hidden" : ""}`}>
              <BrandMark />
            </div>
          )}

            {flow === "pinPanel" && pinInfo ? (
              <PinPanel
                pin={pinInfo.pin}
                isRotated={pinInfo.isRotated}
                message={pinInfo.message}
                onContinue={handlePinPanelContinue}
                loading={false}
              />
            ) : flow === "verifyEmail" ? (
              <div className={panelClasses}>
                <div className="mb-6 flex flex-col items-center gap-3 text-center lg:flex-row lg:items-start lg:gap-3.5 lg:text-left">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400">
                    <FaShieldAlt />
                  </span>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-on">
                      Verify your email
                    </h1>
                    <p className="mt-1.5 text-sm text-on-dim">
                      We sent a 6-digit code to{" "}
                      <span className="font-semibold text-on">{pendingEmail}</span>. Enter it below
                      to finish creating your account.
                    </p>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleVerifyEmail} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="verify-email-code" className="text-sm font-medium text-on">
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

                  <Button type="submit" disabled={verifyLoading} className="w-full py-2.5">
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
                    {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
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
            ) : flow === "forgot" ? (
              <div className={panelClasses}>
                <div className="mb-6 flex flex-col items-center gap-3 text-center lg:flex-row lg:items-start lg:gap-3.5 lg:text-left">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
                    <FaCamera />
                  </span>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-on">
                      Forgot your security PIN?
                    </h1>
                    <p className="mt-1.5 text-sm text-on-dim">
                      Scan your face to mint a brand-new security PIN — or ask an admin or event
                      organizer to reset it for you in person.
                    </p>
                  </div>
                </div>

                {error && forgotStage !== "capture" && (
                  <div
                    role="alert"
                    className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                  >
                    {error}
                  </div>
                )}

                {forgotStage === "capture" ? (
                  <>
                    {resetDone ? (
                      <div
                        role="status"
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400"
                      >
                        {resetMessage}
                      </div>
                    ) : resetOpen ? (
                      renderResetBox()
                    ) : forgotAppealOpen ? (
                      renderAppealBox()
                    ) : (
                      <>
                        <FaceCapture
                          title="Scan my face"
                          onCapture={handleRecoveryPhoto}
                          loading={enrolling}
                          loadingLabel="Verifying your face..."
                          error={error}
                          onCancel={() => {
                            setForgotStage("form");
                            setError("");
                          }}
                        />
                        <div className="mt-4 flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setForgotAppealOpen(true)}
                            className="text-sm font-medium text-on-dim hover:text-on"
                          >
                            Face not matching? Submit an appeal instead
                          </button>
                          <button
                            type="button"
                            onClick={() => setResetOpen(true)}
                            className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            No camera? Request a PIN reset instead
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {forgotInfo && (
                      <div
                        role="status"
                        className={`mb-5 rounded-lg border px-3.5 py-2.5 text-sm ${
                          forgotInfo.enrolled
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {forgotInfo.locked
                          ? "Too many face attempts recently. Wait a few minutes and try again."
                          : forgotInfo.enrolled
                            ? "Face verification is set up for this account. Take a selfie to confirm your identity."
                            : "You don't have a face photo enrolled on this account yet. Request a PIN reset below — an admin or event organizer will verify you in person."}
                      </div>
                    )}

                    <form onSubmit={handleForgotCheck} className="space-y-4">
                      <div className="space-y-1.5">
                        <label htmlFor="forgot-email" className="text-sm font-medium text-on">
                          Email Address
                        </label>
                        <input
                          id="forgot-email"
                          type="email"
                          value={verifyEmail}
                          onChange={(e) => setVerifyEmail(e.target.value)}
                          placeholder="you@university.edu"
                          autoComplete="email"
                          className={inputClasses}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="forgot-password" className="text-sm font-medium text-on">
                          Password
                        </label>
                        <input
                          id="forgot-password"
                          type="password"
                          value={forgotPassword}
                          onChange={(e) => setForgotPassword(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className={inputClasses}
                          required
                        />
                      </div>
                                        {!isLogin && (
                    <>
                      <div className="space-y-1.5">
                        <label htmlFor="program" className="text-sm font-medium text-on">Program</label>
                        <select id="program" name="program" value={formData.program} onChange={handleChange} className={inputClasses} required>
                          <option value="">Select Program</option>
                          <option value="BSIT">BSIT</option>
                          <option value="BSCS">BSCS</option>
                          <option value="BSEMC">BSEMC</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label htmlFor="yearLevel" className="text-sm font-medium text-on">Year Level</label>
                          <select id="yearLevel" name="yearLevel" value={formData.yearLevel} onChange={handleChange} className={inputClasses} required>
                            <option value="">Select Year</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="section" className="text-sm font-medium text-on">Section</label>
                          <input id="section" type="text" name="section" value={formData.section} onChange={(e)=>setFormData({...formData,section:e.target.value.toUpperCase()})} placeholder="A" maxLength={2} className={inputClasses} required />
                        </div>
                      </div>
                    </>
                  )}
<Button type="submit" disabled={loading} className="w-full py-2.5">
                        {loading ? "Checking..." : "Check my identity"}
                      </Button>
                    </form>

                    {forgotInfo && (
                      <div className="mt-5 border-t border-line pt-5">
                        {resetDone ? (
                          <div
                            role="status"
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400"
                          >
                            {resetMessage}
                          </div>
                        ) : resetOpen ? (
                          renderResetBox()
                        ) : (
                          <>
                            {appealDone ? (
                              <div
                                role="status"
                                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400"
                              >
                                Appeal submitted. An admin will review your proof photo and unlock your
                                face verification.
                              </div>
                            ) : forgotAppealOpen ? (
                              renderAppealBox()
                            ) : forgotInfo.locked ? (
                              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                  Camera not working while you wait? Submit an appeal with a proof photo
                                  and an admin will review it, then unlock you.
                                </p>
                                <Button
                                  type="button"
                                  onClick={() => setForgotAppealOpen(true)}
                                  className="mt-3 w-full py-2"
                                >
                                  Submit an appeal
                                </Button>
                              </div>
                            ) : null}

                            <div
                              className={`rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 ${
                                appealDone || forgotAppealOpen || forgotInfo.locked ? "mt-4" : ""
                              }`}
                            >
                              <p className="text-sm text-indigo-700 dark:text-indigo-400">
                                No camera, or no face photo enrolled? Ask an admin or event organizer to
                                verify you in person and reset your security PIN.
                              </p>
                              <Button
                                type="button"
                                onClick={() => setResetOpen(true)}
                                className="mt-3 w-full py-2"
                              >
                                Request a PIN reset
                              </Button>
                            </div>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            showLogin();
                            setFlow("form");
                            setForgotStage("form");
                            setForgotInfo(null);
                            setForgotAppealOpen(false);
                            setAppealDone(false);
                            setResetOpen(false);
                            setResetNote("");
                            setResetDone(false);
                            setResetMessage("");
                            setError("");
                          }}
                          className="mt-4 text-sm font-medium text-on-dim hover:text-on"
                        >
                          {appealDone || resetDone ? "Back to sign in" : "Wait and try again instead"}
                        </button>
                      </div>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setFlow("verifyPin");
                    setForgotStage("form");
                    setForgotInfo(null);
                    setForgotAppealOpen(false);
                    setAppealDone(false);
                    setResetOpen(false);
                    setResetNote("");
                    setResetDone(false);
                    setResetMessage("");
                    setError("");
                  }}
                  className="mt-4 text-sm font-medium text-on-dim hover:text-on"
                >
                  ← Back to new device verification
                </button>
              </div>
            ) : flow === "enrollFace" ? (
              <div className={panelClasses}>
                <div className="mb-6 flex flex-col items-center gap-3 text-center lg:flex-row lg:items-start lg:gap-3.5 lg:text-left">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400">
                    <FaShieldAlt />
                  </span>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-on">
                      Set up face verification
                    </h1>
                    <p className="mt-1.5 text-sm text-on-dim">
                      One quick selfie lets you recover your security PIN with a face scan if you
                      ever forget it.
                    </p>
                  </div>
                </div>

                <FaceCapture
                  title="Save my face"
                  onCapture={handleEnrollPhoto}
                  loading={enrolling}
                  loadingLabel="Saving..."
                  error={error}
                  onCancel={() => {
                    if (pendingAuth) finishAuth(pendingAuth.token, pendingAuth.role);
                  }}
                />
                <p className="mt-3 text-center text-xs text-on-muted">
                  No camera? Skip this — you can ask an admin or event organizer to reset your
                  security PIN later from the sign-in screen.
                </p>
              </div>
            ) : flow === "verifyPin" ? (
              <div className={panelClasses}>
                <div className="mb-6 flex flex-col items-center gap-3 text-center lg:flex-row lg:items-start lg:gap-3.5 lg:text-left">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400">
                    <FaShieldAlt />
                  </span>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-on">
                      New device detected
                    </h1>
                    <p className="mt-1.5 text-sm text-on-dim">
                      Signing in on <span className="font-semibold text-on">{getDeviceLabel()}</span>.
                      Enter your 6-digit security PIN to verify this device.
                    </p>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleVerifyPin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="verify-pin" className="text-sm font-medium text-on">
                      Security PIN
                    </label>
                    <input
                      id="verify-pin"
                      type="password"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      pattern="\d{6}"
                      value={verifyPin}
                      onChange={(e) => {
                        setVerifyPin(e.target.value.replace(/\D/g, ""));
                        setError("");
                      }}
                      placeholder="••••••"
                      className={`${inputClasses} text-center text-xl tracking-[0.4em]`}
                      required
                    />
                    <p className="flex items-center gap-1.5 text-xs text-on-muted">
                      <FaKey className="shrink-0" />
                      Signing in as <span className="font-semibold text-on-dim">{verifyEmail}</span>
                    </p>
                  </div>

                                    {!isLogin && (
                    <>
                      <div className="space-y-1.5">
                        <label htmlFor="program" className="text-sm font-medium text-on">Program</label>
                        <select id="program" name="program" value={formData.program} onChange={handleChange} className={inputClasses} required>
                          <option value="">Select Program</option>
                          <option value="BSIT">BSIT</option>
                          <option value="BSCS">BSCS</option>
                          <option value="BSEMC">BSEMC</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label htmlFor="yearLevel" className="text-sm font-medium text-on">Year Level</label>
                          <select id="yearLevel" name="yearLevel" value={formData.yearLevel} onChange={handleChange} className={inputClasses} required>
                            <option value="">Select Year</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="section" className="text-sm font-medium text-on">Section</label>
                          <input id="section" type="text" name="section" value={formData.section} onChange={(e)=>setFormData({...formData,section:e.target.value.toUpperCase()})} placeholder="A" maxLength={2} className={inputClasses} required />
                        </div>
                      </div>
                    </>
                  )}
<Button type="submit" disabled={loading} className="w-full py-2.5">
                    {loading ? "Verifying..." : "Verify this device"}
                  </Button>
                </form>

                <div className="mt-4 flex flex-col items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setFlow("form");
                      setVerifyPin("");
                      setError("");
                    }}
                    className="font-medium text-on-dim hover:text-on"
                  >
                    ← Use a different account
                  </button>

                  <button
                    type="button"
                    onClick={openForgot}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Forgot your security PIN?
                  </button>
                </div>
              </div>
            ) : flow === "forgotPassword" ? (
              <div className={panelClasses}>
                {/* The mockup's back chevron — steps back to the email screen
                    from the code stage, all the way out to sign-in otherwise. */}
                <button
                  type="button"
                  aria-label="Back"
                  onClick={() => (fpStage === "code" ? setFpStage("form") : backToSignIn())}
                  className="-ml-1 mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-on-dim transition-colors hover:text-on"
                >
                  <FaArrowLeft />
                </button>

                {/* The mockup's illustration spot: TrackED's mark in a soft
                    indigo circle. No stock illustration ships with the app. */}
                <div className="mb-5 flex justify-center lg:justify-start">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-indigo-200 dark:bg-card-alt dark:ring-indigo-400/30">
                    <TrackMark className="h-9 w-9" />
                  </span>
                </div>

                <div className="mb-6 text-center lg:text-left">
                  <h1 className="text-2xl font-bold tracking-tight text-on">Forgot Password?</h1>
                  <p className="mt-1.5 text-sm text-on-dim">
                    {fpStage === "form" ? (
                      "Don't worry — it happens. Please enter the email address linked with your account."
                    ) : (
                      <>
                        We sent a 6-digit code to{" "}
                        <span className="font-semibold text-on">{fpEmail}</span>. Enter it below
                        with your new password.
                      </>
                    )}
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                  >
                    {error}
                  </div>
                )}

                {fpStage === "form" ? (
                  <form onSubmit={handleForgotPasswordSend} className="space-y-4">
                    <div className="space-y-1.5">
                      <label htmlFor="fp-email" className="text-sm font-medium text-on">
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

                    <Button type="submit" disabled={fpLoading} className="w-full py-2.5">
                      {fpLoading ? "Sending..." : "Send Code"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label htmlFor="fp-code" className="text-sm font-medium text-on">
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
                      <label htmlFor="fp-password" className="text-sm font-medium text-on">
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
                          aria-label={fpShowPassword ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-muted hover:text-on"
                        >
                          {fpShowPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                      <p className="text-xs text-on-muted">{PASSWORD_HINT}</p>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="fp-confirm" className="text-sm font-medium text-on">
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
                          aria-label={fpShowConfirm ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-muted hover:text-on"
                        >
                          {fpShowConfirm ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" disabled={fpLoading} className="w-full py-2.5">
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
                      {fpResendIn > 0 ? `Resend code in ${fpResendIn}s` : "Resend code"}
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
                  <h1 className="text-2xl font-bold tracking-tight text-on">
                    {isLogin ? "Sign in to your account" : "Create your account"}
                  </h1>
                  <p className="mt-1.5 text-sm text-on-dim">
                    {isLogin
                      ? "Welcome back! Please enter your details."
                      : "Register to track your event attendance."}
                  </p>
                </div>

                {fpNotice && !error && isLogin && (
                  <div
                    role="status"
                    className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400"
                  >
                    {fpNotice}
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="space-y-1.5">
                      <label htmlFor="name" className="text-sm font-medium text-on">
                        Full Name
                      </label>
                      <input
                        id="name"
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="John Doe"
                        autoComplete="name"
                        className={inputClasses}
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-sm font-medium text-on">
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
                      <label htmlFor="password" className="text-sm font-medium text-on">
                        Password
                      </label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={openForgotPassword}
                          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        autoComplete={isLogin ? "current-password" : "new-password"}
                        className={`${inputClasses} pr-11`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
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
                      <label htmlFor="confirmPassword" className="text-sm font-medium text-on">
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
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-muted hover:text-on"
                        >
                          {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>
                  )}

                                    {!isLogin && (
                    <>
                      <div className="space-y-1.5">
                        <label htmlFor="program" className="text-sm font-medium text-on">Program</label>
                        <select id="program" name="program" value={formData.program} onChange={handleChange} className={inputClasses} required>
                          <option value="">Select Program</option>
                          <option value="BSIT">BSIT</option>
                          <option value="BSCS">BSCS</option>
                          <option value="BSEMC">BSEMC</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label htmlFor="yearLevel" className="text-sm font-medium text-on">Year Level</label>
                          <select id="yearLevel" name="yearLevel" value={formData.yearLevel} onChange={handleChange} className={inputClasses} required>
                            <option value="">Select Year</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="section" className="text-sm font-medium text-on">Section</label>
                          <input id="section" type="text" name="section" value={formData.section} onChange={(e)=>setFormData({...formData,section:e.target.value.toUpperCase()})} placeholder="A" maxLength={2} className={inputClasses} required />
                        </div>
                      </div>
                    </>
                  )}
<Button type="submit" disabled={loading} className="w-full py-2.5">
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

                {/* The PIN recovery flow still has to be reachable now that
                    the password row belongs to "Forgot Password?" */}
                {isLogin && (
                  <button
                    type="button"
                    onClick={openForgot}
                    className="mt-4 block w-full text-center text-xs font-medium text-on-dim hover:text-on"
                  >
                    Forgot your security PIN?
                  </button>
                )}

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
                        className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
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
                        className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>

                <p className="mt-5 border-t border-line pt-4 text-center text-xs text-on-muted">
                  For organizer or admin access, contact your department.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppBackground>
  );
};

export default AuthPage;