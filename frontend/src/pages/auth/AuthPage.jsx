import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { setAuth } from "../../utils/auth";
import {
  FaUser,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaArrowRight,
} from "react-icons/fa";
import FoxMark from "../../components/shared/FoxMark";

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

  const navigate = useNavigate();

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

        setError("");
        alert("Registration successful! Please log in.");
        setIsLogin(true);
        setFormData({ ...formData, name: "", password: "" });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Left - Branding panel */}
      <div
        className="relative overflow-hidden lg:w-[50%] flex flex-col justify-center p-8 sm:p-12 lg:p-16
                   text-white bg-[linear-gradient(135deg,#B91C2C_0%,#7a1422_48%,#3A0A12_100%)]"
      >
        {/* Concentric arcs motif */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {/* Animated starfield + meteors */}
          <div className="absolute inset-0 opacity-80">
            {Array.from({ length: 70 }, (_, i) => (
              <span
                key={i}
                className="star-dot"
                style={{
                  position: "absolute",
                  left: `${(i * 37) % 100}%`,
                  top: `${(i * 61) % 100}%`,
                  width: 1 + ((i * 7) % 3),
                  height: 1 + ((i * 7) % 3),
                  borderRadius: 9999,
                  background: i % 11 === 0 ? "#fff6ee" : "#ffffff",
                  boxShadow: i % 11 === 0 ? "0 0 6px 1px rgba(255,240,230,0.8)" : "none",
                  animationDelay: `${((i * 13) % 10) / 10}s`,
                  animationDuration: `${2.4 + ((i * 17) % 50) / 10}s`,
                }}
              />
            ))}
            {[0.6, 2.4, 4.1, 7.0].map((delay, idx) => (
              <span
                key={idx}
                className="meteor"
                style={{
                  top: `${8 + idx * 9}%`,
                  color: "#ffd9c9",
                  boxShadow: "0 0 10px 0 #ffd9c9",
                  animationDelay: `${delay}s`,
                  animationDuration: `${7 + idx * 1.5}s`,
                }}
              />
            ))}
          </div>
          <svg
            className="absolute -right-40 -top-40 w-[42rem] h-[42rem] opacity-[0.14]"
            viewBox="0 0 600 600"
            fill="none"
          >
            {[260, 218, 176, 134, 92, 50].map((r) => (
              <circle key={r} cx="300" cy="300" r={r} stroke="white" strokeWidth="1.5" />
            ))}
            <path d="M300 40 L300 140" stroke="white" strokeWidth="1.5" />
            <path d="M300 460 L300 560" stroke="white" strokeWidth="1.5" />
            <path d="M40 300 L140 300" stroke="white" strokeWidth="1.5" />
            <path d="M460 300 L560 300" stroke="white" strokeWidth="1.5" />
          </svg>
          <svg
            className="absolute -left-32 bottom-40 w-[28rem] h-[28rem] opacity-10"
            viewBox="0 0 400 400"
            fill="none"
          >
            {[150, 110, 70].map((r) => (
              <circle key={r} cx="200" cy="200" r={r} stroke="white" strokeWidth="1" />
            ))}
          </svg>
          {/* Faint fox silhouette accents (Bit Defenders-inspired, subtle) */}
          <svg
            className="absolute left-6 bottom-6 w-28 h-28 opacity-[0.06]"
            viewBox="0 0 48 48"
            fill="white"
          >
            <path d="M24 6 L38 15 L43 30 L33 41 L15 41 L5 30 L10 15 Z" />
            <path d="M10 15 L5 3 L19 11 Z" />
            <path d="M38 15 L43 3 L29 11 Z" />
          </svg>
          <span className="absolute right-8 top-8 flex gap-3 opacity-20">
            {[0, 1, 2].map((i) => (
              <span key={i} className="text-white text-xl leading-none">▴</span>
            ))}
          </span>
        </div>

        {/* Soft glow behind icon */}
        <div
          className="absolute top-1/2 left-12 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 70%)" }}
        />

        <div className="relative z-10 flex flex-col">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur-sm">
              <FoxMark className="w-9 h-9" />
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4 tracking-tight">
            {isLogin ? "Hello Again" : "Join TrackED"}
            <span className="align-middle inline-block ml-3">👋</span>
          </h1>
          <p className="text-base sm:text-lg text-white/75 max-w-md font-light leading-relaxed">
            Track your attendance, manage community service hours, and stay connected with your events — all in one place.
          </p>
        </div>
      </div>

      {/* Right - Form panel */}
      <div className="relative flex-1 flex items-center justify-center bg-[#FAFAFA] p-6 sm:p-10 overflow-hidden">
        {/* Fading light starfield */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          {Array.from({ length: 50 }, (_, i) => (
            <span
              key={i}
              className="star-dot"
              style={{
                position: "absolute",
                left: `${(i * 29) % 100}%`,
                top: `${(i * 53) % 100}%`,
                width: 1,
                height: 1,
                borderRadius: 9999,
                background: "#c05a5a",
                animationDelay: `${((i * 11) % 10) / 10}s`,
                animationDuration: `${2.4 + ((i * 13) % 40) / 10}s`,
              }}
            />
          ))}
          {[1.0, 3.5, 6.0].map((delay, idx) => (
            <span
              key={idx}
              className="meteor"
              style={{
                top: `${10 + idx * 12}%`,
                color: "#c05a5a",
                boxShadow: "0 0 10px 0 #c05a5a",
                animationDelay: `${delay}s`,
                animationDuration: `${8 + idx}s`,
                opacity: 0.5,
              }}
            />
          ))}
        </div>
        {/* Brand watermark */}
        <FoxMark className="absolute bottom-6 right-8 w-24 h-24 opacity-10" />

        <div className="w-full max-w-md">
          {/* Branding top-left */}
          <div className="flex items-center gap-2.5 mb-12">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E63946] to-[#8B1E2F] flex items-center justify-center text-white shadow-md shadow-[#E63946]/30">
              <FoxMark className="w-8 h-8" />
            </span>
            <span className="text-lg font-bold text-[#1A1A1A] tracking-tight">
              Track<span className="text-[#B91C2C]">ED</span>
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#1A1A1A] mb-1.5">
              {isLogin ? "Sign in to your account" : "Create your account"}
            </h2>
            <p className="text-[15px] text-[#6b7280]">
              {isLogin ? "Welcome back! Please enter your details." : "Enter your details to get started."}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-[#B91C2C]/10 border border-[#B91C2C]/25 rounded-lg text-[#B91C2C] text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#374151]">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  autoComplete="name"
                  className="w-full bg-[#F3F3F5] rounded-[12px] px-4 py-3.5 text-[#111827] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#E63946]/60 focus:bg-white transition-all"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#374151]">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-[#F3F3F5] rounded-[12px] px-4 py-3.5 text-[#111827] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#E63946]/60 focus:bg-white transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#374151]">Password</label>
                {isLogin && (
                  <button type="button" className="text-xs text-[#B91C2C] hover:underline font-medium">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="w-full bg-[#F3F3F5] rounded-[12px] px-4 py-3.5 pr-12 text-[#111827] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#E63946]/60 focus:bg-white transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151] transition-colors"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#E63946] to-[#8B1E2F] hover:from-[#F04A55] hover:to-[#9c2238] text-white font-semibold py-3.5 px-6 rounded-[12px] shadow-lg shadow-[#E63946]/30 hover:shadow-xl hover:shadow-[#E63946]/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Please wait...</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? "Sign In" : "Create Account"}</span>
                  <FaArrowRight className="text-sm" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-[#6b7280]">
              {isLogin ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(false);
                      setError("");
                    }}
                    className="text-[#B91C2C] font-semibold hover:underline"
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
                    className="text-[#B91C2C] font-semibold hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-[#9ca3af]">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
