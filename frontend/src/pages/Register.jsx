import React from "react";
import { Link } from "react-router-dom";

const Register = () => {
  return (
    <div className="min-h-screen flex items-center justify-center 
                    bg-linear-to-br from-red-950 via-red-900 to-black">

      <form className="bg-[#ffffff] p-8 rounded-xl shadow-2xl 
                       w-full max-w-md text-gray">

        <h1 className="text-3xl font-bold mb-6 text-center">
          Create <span className="text-red-500">Account</span>
        </h1>

        <input
          type="text"
          placeholder="Username"
          className="w-full mb-4 p-3 rounded bg-gray/40 border border-red-800
                     focus:outline-none focus:ring-2 focus:ring-red-500"
        />

        <input
          type="email"
          placeholder="@firstasia.edu.ph"
          className="w-full mb-4 p-3 rounded bg-gray/40 border border-red-800
                     focus:outline-none focus:ring-2 focus:ring-red-500"
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-6 p-3 rounded bg-gray/40 border border-red-800
                     focus:outline-none focus:ring-2 focus:ring-red-500"
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