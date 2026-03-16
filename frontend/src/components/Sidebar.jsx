import React from "react";

const Sidebar = ({ role }) => {
  return (
    <div className="w-64 bg-[#0f0f14] text-white p-6">
      <h2 className="text-2xl font-bold mb-10">
        Track<span className="text-red-400">Ed</span>
      </h2>

      <nav className="space-y-4 text-gray-300">
        <p className="hover:text-red-400 cursor-pointer">Dashboard</p>

        {role === "admin" && (
          <>
            <p className="hover:text-red-400 cursor-pointer">Students</p>
            <p className="hover:text-red-400 cursor-pointer">Attendance</p>
            <p className="hover:text-red-400 cursor-pointer">Reports</p>
          </>
        )}

        {role === "student" && (
          <>
            <p className="hover:text-red-400 cursor-pointer">My Attendance</p>
            <p className="hover:text-red-400 cursor-pointer">Profile</p>
          </>
        )}
      </nav>
    </div>
  );
};

export default Sidebar;