import React from "react";

const Sidebar = ({ role }) => {
  // Define menu items based on role
  const menuItems = {
    admin: [
      { name: "Dashboard", action: () => {} },
      { name: "Create Organizer", action: () => {} },
      { name: "Manage Events", action: () => {} },
    ],
    organizer: [
      { name: "Dashboard", action: () => {} },
      { name: "Manage Events", action: () => {} },
      { name: "Manage Attendees", action: () => {} },
    ],
    student: [
      { name: "Dashboard", action: () => {} },
      { name: "Attend Events", action: () => {} },
      { name: "My Attendance", action: () => {} },
    ],
  };

  const items = menuItems[role] || [];

  return (
    <div className="w-64 bg-[#0f0f14] text-white p-6 min-h-screen flex flex-col">
      <h2 className="text-2xl font-bold mb-10">
        Track<span className="text-red-400">Ed</span>
      </h2>

      <nav className="flex-1 flex flex-col gap-4">
        {items.map((item, idx) => (
          <p
            key={idx}
            onClick={item.action}
            className="hover:text-red-400 cursor-pointer text-gray-300"
          >
            {item.name}
          </p>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;