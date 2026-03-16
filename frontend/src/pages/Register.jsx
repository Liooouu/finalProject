import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "./api/axios"; // make sure this path is correct

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/register", {
        name: username,
        email,
        password,
        role: "student", // default role for registration
      });
      alert("Account created successfully!");
      navigate("/"); // redirect to login
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center 
                    bg-linear-to-br from-red-950 via-red-900 to-black">

      <form
        onSubmit={handleRegister}
        className="bg-[#ffffff] p-8 rounded-xl shadow-2xl 
                       w-full max-w-md text-gray"
      >
        <h1 className="text-3xl font-bold mb-6 text-center">
          Create <span className="text-red-500">Account</span>
        </h1>

        {error && <p className="text-red-500 mb-3 text-center">{error}</p>}

        <input
          type="text"
          placeholder="Username"
          className="w-full mb-4 p-3 rounded bg-gray/40 border border-red-800
                     focus:outline-none focus:ring-2 focus:ring-red-500"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="email"
          placeholder="@firstasia.edu.ph"
          className="w-full mb-4 p-3 rounded bg-gray/40 border border-red-800
                     focus:outline-none focus:ring-2 focus:ring-red-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-6 p-3 rounded bg-gray/40 border border-red-800
                     focus:outline-none focus:ring-2 focus:ring-red-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="w-full bg-red-700 hover:bg-red-600 
                     text-white transition py-3 rounded font-semibold shadow-lg"
        >
          Register
        </button>

        <p className="text-sm text-gray-400 mt-4 text-center">
          Already have an account?{" "}
          <Link to="/" className="text-red-400 hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Register;