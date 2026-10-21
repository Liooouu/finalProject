import React, { useState } from "react";
import api from "../../api/axios";
import { usePageMeta } from "../../context/PageMetaContext";
import { isStrongPassword, PASSWORD_MESSAGE, PASSWORD_HINT } from "../../utils/password";
import { FaUserPlus, FaCheck, FaShieldAlt } from "react-icons/fa";
import { Button, Card, PageHeader } from "../ui";

const CAPABILITIES = [
  "Create and manage events",
  "View and update attendance",
  "Can't access the admin dashboard or manage users",
];

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
    } else if (!isStrongPassword(form.password)) {
      newErrors.password = PASSWORD_MESSAGE;
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
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        eyebrow="People & access"
        title="Create organizer"
        subtitle="Organizer accounts are created by admins and can manage events and attendance."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <div className="mb-6 flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
              <FaUserPlus />
            </span>
            <div>
              <h2 className="panel-heading text-base">Account details</h2>
              <p className="text-sm text-on-dim">
                They will be able to sign in as soon as you create the account.
              </p>
            </div>
          </div>

          <form onSubmit={createOrganizer} className="space-y-5">
            {errors.general && (
              <div className="alert alert-danger" role="alert">
                <span aria-hidden="true">!</span>
                <p>{errors.general}</p>
              </div>
            )}

            {success && (
              <div className="alert alert-ok" role="status">
                <span aria-hidden="true">✓</span>
                <div>
                  <p className="font-medium">{success.message}</p>
                  <p className="text-sm opacity-80">Email: {success.email}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="organizer-name" className="field-label">
                Full name
              </label>
              <input
                id="organizer-name"
                type="text"
                value={form.name}
                placeholder="Enter full name"
                onChange={(e) => handleInputChange("name", e.target.value)}
                className={`field ${errors.name ? "border-danger/60" : ""}`}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "organizer-name-error" : undefined}
              />
              {errors.name && (
                <p id="organizer-name-error" className="field-error">
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="organizer-email" className="field-label">
                Email address
              </label>
              <input
                id="organizer-email"
                type="email"
                value={form.email}
                placeholder="Enter email address"
                onChange={(e) => handleInputChange("email", e.target.value)}
                className={`field ${errors.email ? "border-danger/60" : ""}`}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "organizer-email-error" : undefined}
              />
              {errors.email && (
                <p id="organizer-email-error" className="field-error">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="organizer-password" className="field-label">
                Password
              </label>
              <div className="relative">
                <input
                  id="organizer-password"
                  type="text"
                  value={form.password}
                  placeholder="Enter password"
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className={`field pr-24 ${
                    errors.password ? "border-danger/60" : ""
                  }`}
                  aria-invalid={!!errors.password}
                  aria-describedby="organizer-password-hint"
                />
                <button
                  type="button"
                  onClick={generatePassword}
                  className="absolute inset-y-1.5 right-1.5 rounded-lg border border-line bg-card-alt px-3 py-1 text-xs font-medium text-on-dim transition-colors hover:text-on"
                >
                  Generate
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password}</p>}
              <p id="organizer-password-hint" className="field-hint">
                {PASSWORD_HINT}. Use “Generate” for a secure random password.
              </p>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Creating..." : "Create organizer"}
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card variant="inset">
            <div className="flex items-center gap-2.5">
              <FaShieldAlt className="text-brand" />
              <h3 className="text-sm font-semibold text-on">Role capabilities</h3>
            </div>
            <ul className="mt-3 space-y-2.5">
              {CAPABILITIES.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-on-dim">
                  <FaCheck className="mt-0.5 shrink-0 text-[11px] text-ok" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="rounded-2xl border border-line bg-gradient-to-br from-[var(--brand)]/10 via-transparent to-transparent p-5">
            <p className="eyebrow">Security note</p>
            <p className="mt-1.5 text-sm leading-relaxed text-on-dim">
              Share the initial password through a private channel. Organizers can change it from
              their account settings after signing in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOrganizerPage;
