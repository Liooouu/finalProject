import React, { useState, useEffect } from "react";
import api from "../../api/axios"; // your axios instance
import { getUserFromToken } from "../../utils/auth";
import { useNavigate } from "react-router-dom";

const AccountSettings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: "", email: "", role: "" });
  const [form, setForm] = useState({ name: "", email: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState("");

  // Load current user from token
  useEffect(() => {
    const currentUser = getUserFromToken();
    if (currentUser) {
      setUser(currentUser);
      setForm({ name: currentUser.name || "", email: currentUser.email || "" });
    }
  }, []);

  // Update name/email
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch("/account", form); // PATCH /account
      setUser(res.data);
      setMessage("Account info updated successfully!");
    } catch (err) {
      setMessage(err.response?.data?.error || "Update failed");
    }
  };

  // Change password
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    try {
      await api.patch("/account/password", passwordForm); // PATCH /account/password
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setMessage("Password changed successfully!");
    } catch (err) {
      setMessage(err.response?.data?.error || "Password update failed");
    }
  };

  // Log out
  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/auth");
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Account Settings</h1>

      {message && <p className="mb-4 text-green-600">{message}</p>}

      <p className="mb-2 text-gray-600">Role: <strong>{user.role}</strong></p>

      <form onSubmit={handleUpdate} className="mb-6 flex flex-col gap-3">
        <input
          type="text"
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
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
          value={passwordForm.currentPassword}
          onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="password"
          name="newPassword"
          placeholder="New Password"
          value={passwordForm.newPassword}
          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
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