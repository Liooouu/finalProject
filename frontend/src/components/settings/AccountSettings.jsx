import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { getUserFromToken } from "../../utils/auth";
import { useNavigate } from "react-router-dom";

const AccountSettings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: "", email: "", role: "" });
  const [form, setForm] = useState({ name: "", email: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const currentUser = getUserFromToken();
    if (currentUser) {
      setUser(currentUser);
      setForm({ name: currentUser.name || "", email: currentUser.email || "" });
    }
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch("/account", form);
      setUser(res.data);
      setMessage("Account info updated successfully!");
    } catch (err) {
      setMessage(err.response?.data?.error || "Update failed");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    try {
      await api.patch("/account/password", passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setMessage("Password changed successfully!");
    } catch (err) {
      setMessage(err.response?.data?.error || "Password update failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/auth");
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-linear-to-tl from-black to-red-950 rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Account Settings</h1>

      {message && <p className="mb-4 text-green-600">{message}</p>}

      <p className="mb-2 text-gray-600">
        Role: <strong>{user.role}</strong>
      </p>

      <form onSubmit={handleUpdate} className="mb-6 flex flex-col gap-3">
        <input
          type="text"
          name="name"
          placeholder="Name"
          autoComplete="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border p-2 rounded"
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
          Update Info
        </button>
      </form>

      <form onSubmit={handlePasswordChange} className="mb-6 flex flex-col gap-3">
        <input
          type="password"
          name="currentPassword"
          placeholder="Current Password"
          autoComplete="current-password"
          value={passwordForm.currentPassword}
          onChange={(e) =>
            setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
          }
          className="border p-2 rounded"
        />
        <input
          type="password"
          name="newPassword"
          placeholder="New Password"
          autoComplete="new-password"
          value={passwordForm.newPassword}
          onChange={(e) =>
            setPasswordForm({ ...passwordForm, newPassword: e.target.value })
          }
          className="border p-2 rounded"
        />
        <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded">
          Change Password
        </button>
      </form>

      <button
        onClick={handleLogout}
        className="bg-red-500 text-white px-4 py-2 rounded w-full"
      >
        Log Out
      </button>
    </div>
  );
};

export default AccountSettings;