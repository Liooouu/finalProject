import React from "react";

const DashboardHome = () => {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-[#0f0f14] p-6 rounded-xl shadow">
        <h3 className="text-lg text-gray-400">Attendance Percentage</h3>
        <p className="text-4xl font-bold mt-2 text-red-400">87%</p>
      </div>
      <div className="bg-[#0f0f14] p-6 rounded-xl shadow">
        <h3 className="text-lg text-gray-400">Classes Attended</h3>
        <p className="text-4xl font-bold mt-2">52</p>
      </div>
    </div>
  );
};

export default DashboardHome;