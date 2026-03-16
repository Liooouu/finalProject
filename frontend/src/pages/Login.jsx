import React, { useState } from "react";
import api from "./api/axios"; // make sure this path is correct
import { useNavigate, Link } from "react-router-dom";

function Login() {
  const [role, setRole] = useState("student"); 
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Please fill both fields");
      return;
    }

    try {
      const endpoint = role === "admin" ? "/auth/admin-login" : "/auth/login";
      const res = await api.post(endpoint, { email, password });

      localStorage.setItem("token", res.data.token);

      // Navigate based on role from backend
      navigate(res.data.role === "admin" ? "/admin-dashboard" : "/student-dashboard");
    } catch (err) {
      console.error(err.response);
      alert(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT PANEL */}
      <div className="hidden md:flex w-1/2 bg-linear-to-bl from-red-950 via-red-900 to-black flex-col justify-center items-center text-white p-12">
        <h2 className="text-5xl font-extrabold mb-6">TrackEd</h2>
        <h3 className="text-2xl font-semibold mb-4">Intelligent Attendance Monitoring</h3>
        <p className="text-md text-gray-200 text-center max-w-md">
          Track attendance, reports, and scholarship status — all in one platform.
        </p>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex w-full md:w-1/2 justify-center items-center bg-linear-to-tl from-black to-red-700 p-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          
          {/* ROLE TOGGLE */}
          <div className="flex justify-center mb-6 space-x-6">
            <button
              onClick={() => setRole("student")}
              className={`pb-2 font-semibold ${role === "student" ? "border-b-2 border-red-500 text-gray-900" : "text-gray-400 hover:text-gray-700"}`}
            >
              Student
            </button>
            <button
              onClick={() => setRole("admin")}
              className={`pb-2 font-semibold ${role === "admin" ? "border-b-2 border-red-500 text-gray-900" : "text-gray-400 hover:text-gray-700"}`}
            >
              Admin
            </button>
          </div>

          <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">
            {role === "admin" ? "Admin" : "Student"} <span className="text-red-500">Login</span>
          </h2>

          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full mb-4 p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-100"/>
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full mb-2 p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-100"/>

          <button onClick={handleLogin} className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-semibold mt-4">
            Login as {role === "admin" ? "Admin" : "Student"}
          </button>

          {role === "student" && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              Don't have an account? <Link to="/register" className="text-red-500 hover:underline">Register</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;