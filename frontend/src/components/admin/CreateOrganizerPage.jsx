import React, { useState } from "react";
import api from "../../api/axios";
import { usePageMeta } from "../../context/PageMetaContext";
import { FaUserPlus } from "react-icons/fa";
import Button from "../ui/Button";

const CreateOrganizerPage = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  usePageMeta("Create Organizer", "Add a new organizer account to manage events.");

  const validateForm = () => {
    const newErrors = {};
    
    if (!form.name.trim()) {
      newErrors.name = "Name is required";
    } else if (form.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    if (!form.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!form.password) {
      newErrors.password = "Password is required";
    } else if (form.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm({ ...form, password });
    setErrors({ ...errors, password: "" });
  };

  const createOrganizer = async (e) => {
    e.preventDefault();
    setSuccess(null);

    if (!validateForm()) return;

    setLoading(true);
    try {
      await api.post("/admin/create-organizer", form);
      setSuccess({
        message: "Organizer created successfully!",
        email: form.email,
      });
      setForm({ name: "", email: "", password: "" });
      setErrors({});
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to create organizer";
      if (errorMessage.includes("already exists")) {
        setErrors({ email: "An account with this email already exists" });
      } else {
        setErrors({ general: errorMessage });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-xl border border-line overflow-hidden">
        <div className="p-6 border-b border-line">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500/15 flex items-center justify-center ring-1 ring-indigo-500/25">
              <FaUserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on">Create Organizer</h2>
              <p className="text-sm text-on-dim">Add a new organizer account to manage events</p>
            </div>
          </div>
        </div>

        <form onSubmit={createOrganizer} className="p-6 space-y-5">
          {errors.general && (
            <div className="p-4 dark:bg-red-900/30 bg-red-50 dark:border-red-800 border-red-300 rounded-lg dark:text-red-400 text-red-600 text-sm">
              {errors.general}
            </div>
          )}

          {success && (
            <div className="p-4 dark:bg-green-900/30 bg-green-50 dark:border-green-800 border-green-300 rounded-lg">
              <div className="flex items-center gap-2 dark:text-green-400 text-green-600 mb-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">{success.message}</span>
              </div>
              <p className="text-sm text-on-dim">Email: {success.email}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-on-dim mb-2">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-on-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                type="text"
                value={form.name}
                placeholder="Enter full name"
                className={`w-full pl-10 pr-4 py-3 bg-card dark:bg-black rounded-lg border ${
                  errors.name ? "border-red-500" : "border-line"
                } bg-card text-on placeholder-on-muted focus:outline-none ${
                  errors.name ? "focus:ring-2 focus:ring-red-500/40" : "focus:ring-2 focus:ring-indigo-500/40"
                } focus:border-transparent transition-colors`}
                onChange={(e) => handleInputChange("name", e.target.value)}
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-sm dark:text-red-400 text-red-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-on-dim mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-on-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                type="email"
                value={form.email}
                placeholder="Enter email address"
                className={`w-full pl-10 pr-4 py-3 bg-card dark:bg-black rounded-lg border ${
                  errors.email ? "border-red-500" : "border-line"
                } bg-card text-on placeholder-on-muted focus:outline-none ${
                  errors.email ? "focus:ring-2 focus:ring-red-500/40" : "focus:ring-2 focus:ring-indigo-500/40"
                } focus:border-transparent transition-colors`}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm dark:text-red-400 text-red-600">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-on-dim mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-on-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type="text"
                value={form.password}
                placeholder="Enter password"
                className={`w-full pl-10 pr-24 py-3 bg-card dark:bg-black rounded-lg border ${
                  errors.password ? "border-red-500" : "border-line"
                } bg-card text-on placeholder-on-muted focus:outline-none ${
                  errors.password ? "focus:ring-2 focus:ring-red-500/40" : "focus:ring-2 focus:ring-indigo-500/40"
                } focus:border-transparent transition-colors`}
                onChange={(e) => handleInputChange("password", e.target.value)}
              />
              <button
                type="button"
                onClick={generatePassword}
                className="absolute inset-y-1 right-1 px-3 py-1 bg-card-alt hover:bg-card-alt rounded text-xs text-on-dim transition-colors"
              >
                Generate
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm dark:text-red-400 text-red-600">{errors.password}</p>
            )}
            <p className="mt-1 text-xs text-on-muted">
              Minimum 6 characters. Use "Generate" for a secure random password.
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full py-3"
          >
            {loading ? (
              <>
                <span className="skeleton h-4 w-4 rounded-full" />
                Creating...
              </>
            ) : (
              <>
                <FaUserPlus className="text-sm" />
                Create Organizer
              </>
            )}
          </Button>
        </form>
      </div>

      <div className="mt-6 p-4 bg-card/50 rounded-xl border border-line">
        <h3 className="text-sm font-medium text-on-dim mb-2">Organizer Capabilities</h3>
        <ul className="text-sm text-on-dim space-y-1">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 dark:text-green-400 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Create and manage events
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 dark:text-green-400 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            View and update attendee attendance
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 dark:text-green-400 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Cannot access admin dashboard or manage users
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CreateOrganizerPage;
