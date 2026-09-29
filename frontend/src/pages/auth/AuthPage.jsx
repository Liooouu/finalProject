import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { setAuth } from "../../utils/auth";
import { getDeviceId, getDeviceLabel } from "../../utils/device";
import {
  FaEye,
  FaEyeSlash,
  FaArrowRight,
  FaQrcode,
  FaClock,
  FaBell,
  FaChartBar,
  FaShieldAlt,
  FaKey,
  FaCamera,
} from "react-icons/fa";
import TrackMark from "../../components/shared/TrackMark";
import AppBackground from "../../components/shared/AppBackground";
import Button from "../../components/ui/Button";
import FaceCapture from "../../components/auth/FaceCapture";
import { useTheme } from "../../context/ThemeContext";
import techDark from "../../assets/images/tech-bg-dark.jpg";
import techLight from "../../assets/images/tech-bg-light.jpg";

const features = [
  {
    icon: <FaQrcode />,
    title: "QR & map check-in",
    desc: "Scan your code or mark attendance in one tap.",
  },
  {
    icon: <FaClock />,
    title: "Community service hours",
    desc: "Earn and track every required hour.",
  },
  {
    icon: <FaBell />,
    title: "Real-time notifications",
    desc: "Instant updates on events, excuses, and statuses.",
  },
  {
    icon: <FaChartBar />,
    title: "Live attendance reports",
    desc: "Organizers and admins see everything at a glance.",
  },
];

const BrandMark = ({ onLight = false }) => (
  <div className={`flex flex-col items-center gap-2 lg:items-start ${onLight ? "" : ""}`}>
    <span
      className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${
        onLight ? "bg-white/10 ring-white/20" : "bg-indigo-500/10 ring-indigo-500/20"
      }`}
    >
      <TrackMark className="h-9 w-9" />
    </span>
    <p className={`text-xl font-bold tracking-tight ${onLight ? "text-white" : "text-on"}`}>
      Track<span className="text-indigo-400">ED</span>
    </p>
  </div>
);

const PinPanel = ({ pin, isRotated, message, onContinue, loading }) => (
  <div className="animate-fade-up rounded-2xl border border-line bg-card p-7 shadow-xl shadow-black/5 sm:p-8">
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
              : "The system assigned this PIN. You'll need it the first time you sign in from a new device in the computer lab.")}
        </p>
      </div>
    </div>

    <div className="rounded-xl border border-dashed border-indigo-400/50 bg-indigo-500/5 px-4 py-5 text-center">
      <p className="text-2xl font-bold tracking-[0.45em] text-on sm:text-3xl">{pin}</p>
    </div>

    <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-line bg-card-alt/60 px-3.5 py-3 text-sm text-on-dim">
      <FaShieldAlt className="mt-0.5 shrink-0 text-indigo-500" />
      <p>
        Do not share your PIN. A friend with your login credentials will be locked out the moment
        your PIN rotates.
      </p>
    </div>

    <Button onClick={onContinue} disabled={loading} className="mt-6 w-full py-2.5">
      {isRotated ? "Got it, continue" : "I've saved it, continue"}
    </Button>
  </div>
);

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  // Extra auth steps introduced by the rotating security PIN
  const [flow, setFlow] = useState("form"); // "form" | "verifyPin" | "pinPanel" | "forgot" | "enrollFace"
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyPin, setVerifyPin] = useState("");
  const [pinInfo, setPinInfo] = useState(null); // { pin, isRotated, message }
  const [pendingAuth, setPendingAuth] = useState(null); // { token, role, next }
  const [forgotStage, setForgotStage] = useState("form"); // "form" | "capture"
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotInfo, setForgotInfo] = useState(null); // response of /forgot-pin check
  const [enrolling, setEnrolling] = useState(false);

  const navigate = useNavigate();
  const { isDark } = useTheme();

  const finishAuth = (token, role) => {
    setAuth(token, role);
    navigate(`/${role}/dashboard`);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
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
        const res = await api.post("/auth/register", {
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          role: "student",
        });

        setPinInfo({
          pin: res.data.pin,
          isRotated: false,
          message: "Your account is ready. This PIN unlocks future sign-ins from new devices.",
        });
        setPendingAuth({ token: res.data.token, role: res.data.role, next: "enroll" });
        setFlow("pinPanel");
        setFormData({ ...formData, name: "", password: "", email: "" });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
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
      setIsLogin(true);
      setFlow("form");
    }
  };

  const openForgot = () => {
    setForgotStage("form");
    setForgotInfo(null);
    setVerifyEmail(formData.email.trim() || verifyEmail);
    setForgotPassword(formData.password.trim() || forgotPassword);
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
      setError(err.response?.data?.message || "Face verification failed. Try again.");
    } finally {
      setEnrolling(false);
    }
  };

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

  const inputClasses =
    "w-full rounded-lg border border-line bg-card-alt/60 px-3.5 py-2.5 text-sm text-on placeholder-on-muted focus:border-transparent focus:outline-none transition-colors";

  return (
    <AppBackground>
      <div className="relative flex w-full min-h-screen">
        {/* Left — photo + branding panel */}
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

            <div>
              <h2 className="max-w-md text-3xl font-bold leading-tight text-white xl:text-4xl">
                Lock onto every lecture, event, and community hour.
              </h2>
              <p className="mt-3 max-w-md text-indigo-100/80">
                TrackED keeps Events attendance in clear focus — for students,
                organizers, and admins.
              </p>

              <div className="mt-9 grid gap-3 sm:grid-cols-2">
                {features.map((f) => (
                  <div
                    key={f.title}
                    className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
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

        {/* Right — authentication */}
        <div className="flex min-h-screen w-full flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">
            {/* Brand (mobile / tablet, since the photo panel is hidden below lg) */}
            <div className="mb-6 flex justify-center lg:hidden">
              <BrandMark />
            </div>

            {flow === "pinPanel" && pinInfo ? (
              <PinPanel
                pin={pinInfo.pin}
                isRotated={pinInfo.isRotated}
                message={pinInfo.message}
                onContinue={handlePinPanelContinue}
                loading={false}
              />
            ) : flow === "forgot" ? (
              <div className="animate-fade-up rounded-2xl border border-line bg-card p-7 shadow-xl shadow-black/5 sm:p-8">
                <div className="mb-6 flex items-start gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
                    <FaCamera />
                  </span>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-on">
                      Forgot your security PIN?
                    </h1>
                    <p className="mt-1.5 text-sm text-on-dim">
                      Prove it&apos;s really you with a live face scan and we&apos;ll mint a brand-new
                      security PIN.
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

                {forgotStage === "capture" ? (
                  <FaceCapture
                    title="Scan my face"
                    onCapture={handleRecoveryPhoto}
                    onCancel={() => {
                      setForgotStage("form");
                      setError("");
                    }}
                  />
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
                            : "You don't have a face photo enrolled on this account yet. Ask an admin to reset your security PIN."}
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
                      <Button type="submit" disabled={loading} className="w-full py-2.5">
                        {loading ? "Checking..." : "Check my identity"}
                      </Button>
                    </form>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setFlow("verifyPin");
                    setForgotStage("form");
                    setForgotInfo(null);
                    setError("");
                  }}
                  className="mt-4 text-sm font-medium text-on-dim hover:text-on"
                >
                  ← Back to new device verification
                </button>
              </div>
            ) : flow === "enrollFace" ? (
              <div className="animate-fade-up rounded-2xl border border-line bg-card p-7 shadow-xl shadow-black/5 sm:p-8">
                <div className="mb-6 flex items-start gap-3.5">
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

                {error && (
                  <div
                    role="alert"
                    className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                  >
                    {error}
                  </div>
                )}

                <FaceCapture
                  title="Save my face"
                  onCapture={handleEnrollPhoto}
                  loading={enrolling}
                  onCancel={() => {
                    if (pendingAuth) finishAuth(pendingAuth.token, pendingAuth.role);
                  }}
                />
              </div>
            ) : flow === "verifyPin" ? (
              <div className="animate-fade-up rounded-2xl border border-line bg-card p-7 shadow-xl shadow-black/5 sm:p-8">
                <div className="mb-6 flex items-start gap-3.5">
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
            ) : (
              <div className="animate-fade-up rounded-2xl border border-line bg-card p-7 shadow-xl shadow-black/5 sm:p-8">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold tracking-tight text-on">
                    {isLogin ? "Sign in to your account" : "Create your account"}
                  </h1>
                  <p className="mt-1.5 text-sm text-on-dim">
                    {isLogin
                      ? "Welcome back! Please enter your details."
                      : "Register to track your event attendance."}
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
                          onClick={openForgot}
                          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Forgot your security PIN?
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
                  </div>

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

                <p className="mt-6 text-center text-sm text-on-dim">
                  {isLogin ? (
                    <>
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setIsLogin(false);
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
                          setIsLogin(true);
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