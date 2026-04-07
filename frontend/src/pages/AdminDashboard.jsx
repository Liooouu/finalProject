import React from "react";
import Sidebar from "../components/Sidebar";

const AdminDashboard = () => {
  return (
    <div className="flex min-h-screen bg-linear-to-br from-red-950 to-black">
      <Sidebar role="admin" />

      <main className="flex-1 p-8 text-white">
        <h1 className="text-4xl font-bold mb-6">
          Admin <span className="text-red-400">Dashboard</span>
        </h1>

        {/* Admin stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-[#0f0f14] p-6 rounded-xl shadow">
            <h3 className="text-lg text-gray-400">Total Students</h3>
            <p className="text-3xl font-bold mt-2">120</p>
          </div>

          <div className="bg-[#0f0f14] p-6 rounded-xl shadow">
            <h3 className="text-lg text-gray-400">Today's Attendance</h3>
            <p className="text-3xl font-bold mt-2">94%</p>
          </div>

          <div className="bg-[#0f0f14] p-6 rounded-xl shadow">
            <h3 className="text-lg text-gray-400">Reports Generated</h3>
            <p className="text-3xl font-bold mt-2">32</p>
          </div>
        </div>

        {/* Admin actions */}
        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <div className="bg-[#0f0f14] p-6 rounded-xl shadow cursor-pointer hover:bg-red-950">
            <h3 className="text-lg text-gray-400">Create Organizer</h3>
          </div>

          <div className="bg-[#0f0f14] p-6 rounded-xl shadow cursor-pointer hover:bg-red-950">
            <h3 className="text-lg text-gray-400">Manage Events</h3>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;