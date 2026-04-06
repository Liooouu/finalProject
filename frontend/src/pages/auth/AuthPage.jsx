import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import AuthRedirect from "../../components/AuthRedirect";

const AuthPage = () => {
  const [role, setRole] = useState("student");
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (isLogin) {
        const res = await api.post("/auth/login", {
          email: formData.email,
          password: formData.password,
          role,
        });
        localStorage.setItem("token", res.data.token);

        if (role === "student") navigate("/student-dashboard");
        else if (role === "admin") navigate("/admin-dashboard");
        else navigate("/organizer-dashboard");
      } else {
        if (role !== "student") {
          alert("Only students can register. Please select Student.");
          return;
        }
        await api.post("/auth/register", { ...formData, role });
        alert("Registration successful! Please log in.");
        setIsLogin(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Something went wrong.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row items-center justify-center bg-linear-to-br from-red-900 via-red-800 to-black px-4">

      {/* ================= DESCRIPTION SIDE ================= */}
      <div className="hidden md:flex flex-col justify-center md:w-1/2 max-w-md text-white px-8">
        <h1 className="text-5xl font-bold mb-4">
          Welcome to TrackED
        </h1>
        <p className="text-lg text-gray-200">
          Log in or register to stay connected with TrackED — your intelligent
          attendance monitoring and reporting system for students, organizers, and administrators.
        </p>
      </div>

      {/* ================= FORM PANEL ================= */}
      <div className="w-full md:w-1/2 flex justify-center items-center">
        <div className="bg-white w-full max-w-md p-10 rounded-2xl shadow-xl">
          <h2 className="text-3xl font-semibold text-center mb-6 text-red-900">
            {isLogin ? "Log In" : "Register"}
          </h2>

          {/* Role Selector */}
          <div className="flex justify-center gap-3 mb-6">
            {["student", "admin", "organizer"].map((r) => (
              <button
                key={r}
                className={`px-4 py-2 rounded ${
                  role === r ? "bg-red-700 text-white" : "bg-gray-200 text-gray-700"
                }`}
                onClick={() => setRole(r)}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {/* Toggle Login/Register */}
          {role === "student" && (
            <div className="text-center mb-4">
              <span className="text-gray-600 mr-2">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
              </span>
              <button
                className="text-red-700 font-semibold"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? "Sign up" : "Log in"}
              </button>
            </div>
          )}

          {/* FORM FIELDS */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && role === "student" && (
              <input
                type="text"
                name="name"
                placeholder="Full Name"
                value={formData.name}
                onChange={handleChange}
                className="w-full border px-4 py-3 rounded-lg"
                required
              />
            )}

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              className="w-full border px-4 py-3 rounded-lg"
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="w-full border px-4 py-3 rounded-lg"
              required
            />

            <button
              type="submit"
              className="w-full bg-red-700 hover:bg-red-600 text-white py-3 rounded-lg font-semibold"
            >
              {isLogin ? "Log In" : "Register"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;