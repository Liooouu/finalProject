import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/auth/admin-login", {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      navigate("/admin-dashboard");
    } catch (err) {
      alert("Admin login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center 
                    bg-linear-to-br from-red-950 via-red-900 to-black">

      <div className="bg-[#0f0f14] p-8 rounded-xl shadow-2xl 
                      w-full max-w-md text-white">

        <h2 className="text-3xl font-bold mb-6 text-center">
          Admin <span className="text-red-400">Login</span>
        </h2>

        <input
          type="email"
          placeholder="Admin Email"
          className="w-full mb-4 p-3 rounded bg-black/40 border border-red-800
                     focus:ring-2 focus:ring-red-500 outline-none"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-6 p-3 rounded bg-black/40 border border-red-800
                     focus:ring-2 focus:ring-red-500 outline-none"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="w-full bg-red-700 hover:bg-red-600 
                     transition py-3 rounded font-semibold shadow-lg"
        >
          Sign In as Admin
        </button>
      </div>
    </div>
  );
};

export default AdminLogin;