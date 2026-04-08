import React, { useState } from "react";
import api from "../../api/axios";

const CreateOrganizerPage = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const createOrganizer = async () => {
    try {
      await api.post("/admin/create-organizer", form);
      alert("Organizer created!");
      setForm({ name: "", email: "", password: "" });
    } catch (err) {
      console.error(err.response?.data || err);
      alert(err.response?.data?.message || "Failed to create organizer");
    }
  };

  return (
    <div className="bg-[#0f0f14] p-6 rounded-xl shadow max-w-lg">
      <h2 className="text-xl mb-4 text-red-400">Create Organizer</h2>
      <input
        value={form.name}
        placeholder="Name"
        className="w-full mb-3 p-2 bg-black rounded"
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        value={form.email}
        placeholder="Email"
        className="w-full mb-3 p-2 bg-black rounded"
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        value={form.password}
        type="password"
        placeholder="Password"
        className="w-full mb-3 p-2 bg-black rounded"
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <button
        onClick={createOrganizer}
        className="bg-red-500 px-4 py-2 rounded hover:bg-red-600"
      >
        Create Organizer
      </button>
    </div>
  );
};

export default CreateOrganizerPage;