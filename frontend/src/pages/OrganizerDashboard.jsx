export default function OrganizerDashboard() {
  return (
    <div className="flex h-screen">
      <div className="w-64 bg-[#0f0f14] text-white p-6">
        <h2 className="text-2xl font-bold mb-10">
          Track<span className="text-red-400">Ed</span>
        </h2>
        <nav className="space-y-4 text-gray-300">
          <p className="hover:text-red-400 cursor-pointer">Dashboard</p>
          <p className="hover:text-red-400 cursor-pointer">Events</p>
          <p className="hover:text-red-400 cursor-pointer">Manage Students</p>
        </nav>
      </div>

        <main className="flex-1 p-8 text-white">


            <h1 className="text-4xl font-bold mb-6">

                Organizer <span className="text-red-400">Dashboard</span>
            </h1>   
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-[#0f0f14] p-6 rounded-xl shadow">
                    <h3 className="text-lg text-gray-400">Upcoming Events</h3>
                    <p className="text-4xl font-bold mt-2 text-red-400">3</p>
                </div>
                <div className="bg-[#0f0f14] p-6 rounded-xl shadow">
                    <h3 className="text-lg text-gray-400">Total Attendees</h3>
                    <p className="text-4xl font-bold mt-2">150</p>

                </div>
            </div>
        </main>
    </div>
  );
}