import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { setAuth } from "../../utils/auth";
import {
  FaEye,
  FaEyeSlash,
  FaArrowRight,
  FaCheckCircle,
  FaQrcode,
  FaClock,
  FaBell,
  FaChartBar,
} from "react-icons/fa";
import TrackMark from "../../components/shared/TrackMark";
import AppBackground from "../../components/shared/AppBackground";
import Button from "../../components/ui/Button";
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

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const navigate = useNavigate();
  const { isDark } = useTheme();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (isLogin) {
        const res = await api.post("/auth/login", {
          email: formData.email.trim(),
          password: formData.password.trim(),
        });

        const token = res.data.token;
        const userRole = res.data.role;

        setAuth(token, userRole);
        navigate(`/${userRole}/dashboard`);
      } else {
        await api.post("/auth/register", {
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          role: "student",
        });

        setSuccess("Account created! Please sign in.");
        setFormData({ ...formData, name: "", password: "" });
        setTimeout(() => {
          setIsLogin(true);
          setSuccess("");
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
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
                TrackED keeps university attendance in clear focus — for students,
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
              © {new Date().getFullYear()} TrackED · University Event Attendance System
            </p>
          </div>
        </div>

        {/* Right — authentication form */}
        <div className="flex min-h-screen w-full flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">
            {/* Brand (mobile / tablet, since the photo panel is hidden below lg) */}
            <div className="mb-6 flex justify-center lg:hidden">
              <BrandMark />
            </div>

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

              {success && (
                <div
                  role="status"
                  className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <FaCheckCircle className="animate-pop" />
                  {success}
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
                      <button type="button" className="text-xs font-medium text-on-dim hover:text-on">
                        Forgot password?
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
          </div>
        </div>
      </div>
    </AppBackground>
  );
};

export default AuthPage;