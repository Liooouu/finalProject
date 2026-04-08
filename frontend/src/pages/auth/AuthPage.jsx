// src/pages/auth/AuthPage.jsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

const AuthPage = () => {
  const [role, setRole] = useState("student");
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const navigate = useNavigate();

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (isLogin) {
        const res = await api.post("/auth/login", {
          email: formData.email,
          password: formData.password,
        });

        const token = res.data.token;
        const userRole = res.data.role;

        // ✅ Save token
        localStorage.setItem("token", token);

        // ✅ Redirect based on role
        navigate(`/${userRole}/dashboard`);
      } else {
        // 🔒 Only students can register (extra safety)
        if (role !== "student") {
          alert("Only students can register.");
          return;
        }

        await api.post("/auth/register", {
          ...formData,
          role: "student",
        });

        alert("Registration successful!");
        setIsLogin(true);
        setRole("student");
      }
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert(err.response?.data?.message || "Something went wrong.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row items-center justify-center bg-linear-to-br from-red-900 via-red-800 to-black px-4">
      
      {/* LEFT SIDE */}
      <div className="hidden md:flex flex-col justify-center md:w-1/2 max-w-md text-white px-8">
        <h1 className="text-5xl font-bold mb-4">Welcome to TrackED</h1>
        <p className="text-lg text-gray-200">
          Log in or register to stay connected with TrackED.
        </p>
      </div>

      {/* FORM */}
      <div className="w-full md:w-1/2 flex justify-center items-center">
        <div className="bg-white w-full max-w-md p-10 rounded-2xl shadow-xl">
          
          <h2 className="text-3xl font-semibold text-center mb-6 text-red-900">
            {isLogin ? "Log In" : "Register"}
          </h2>

          {/* ✅ ROLE SELECTOR (LOGIN ONLY) */}
          {isLogin && (
            <div className="flex justify-center gap-3 mb-6">
              {["student", "admin", "organizer"].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`px-4 py-2 rounded ${
                    role === r
                      ? "bg-red-700 text-white"
                      : "bg-gray-200"
                  }`}
                  onClick={() => setRole(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* ✅ TOGGLE LOGIN / REGISTER */}
          <div className="text-center mb-4">
            <button
              type="button"
              className="text-red-700 font-medium"
              onClick={() => {
                setIsLogin(!isLogin);
                setRole("student"); // 🔥 force student on register
              }}
            >
              {isLogin
                ? "Create a student account"
                : "Already have an account?"}
            </button>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* NAME (REGISTER ONLY) */}
            {!isLogin && (
              <input
                type="text"
                name="name"
                placeholder="Full Name"
                onChange={handleChange}
                className="w-full border px-4 py-3 rounded-lg"
                required
              />
            )}

            {/* EMAIL */}
            <input
              type="email"
              name="email"
              placeholder="Email"
              onChange={handleChange}
              className="w-full border px-4 py-3 rounded-lg"
              required
            />

            {/* PASSWORD */}
            <input
              type="password"
              name="password"
              placeholder="Password"
              onChange={handleChange}
              className="w-full border px-4 py-3 rounded-lg"
              required
            />

            {/* SUBMIT */}
            <button className="w-full bg-red-700 hover:bg-red-600 text-white py-3 rounded-lg transition">
              {isLogin ? "Log In" : "Register"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default AuthPage;