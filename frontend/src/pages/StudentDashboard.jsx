import React from "react";
import Sidebar from "../components/Sidebar"; // make sure this path is correct

const StudentDashboard = () => {
  return (
    <div className="flex min-h-screen bg-linear-to-br from-red-950 to-black">
      {/* Sidebar */}
      <Sidebar role="student" />

      {/* Main content */}
      <main className="flex-1 p-8 text-white">
        <h1 className="text-4xl font-bold mb-6">
          Student <span className="text-red-400">Dashboard</span>
        </h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Attendance */}
          <div className="bg-[#0f0f14] p-6 rounded-xl shadow">
            <h3 className="text-lg text-gray-400">Attendance Percentage</h3>
            <p className="text-4xl font-bold mt-2 text-red-400">87%</p>
          </div>

          {/* Classes Attended */}
          <div className="bg-[#0f0f14] p-6 rounded-xl shadow">
            <h3 className="text-lg text-gray-400">Classes Attended</h3>
            <p className="text-4xl font-bold mt-2">52</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;