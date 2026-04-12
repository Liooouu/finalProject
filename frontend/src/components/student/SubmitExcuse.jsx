import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { FaBook, FaCheck, FaFileAlt } from "react-icons/fa";

const SubmitExcuse = () => {
  const navigate = useNavigate();
  const [absentEvents, setAbsentEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [excuseText, setExcuseText] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchAbsentEvents = async () => {
      try {
        const res = await api.get("/student/absent-events");
        setAbsentEvents(res.data);
      } catch (err) {
        console.error(err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAbsentEvents();
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setMessage("File size must be less than 5MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEvent) {
      setMessage("Please select an event");
      return;
    }
    if (!excuseText.trim()) {
      setMessage("Please provide an excuse description");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("eventId", selectedEvent);
      formData.append("excuseText", excuseText);
      if (file) {
        formData.append("attachment", file);
      }

      await api.post("/student/excuses", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage("Excuse submitted successfully!");
      setTimeout(() => navigate("/student/dashboard"), 2000);
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to submit excuse");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Submit Excuse Letter</h1>
        <p className="text-gray-400 mt-1">Provide a valid reason for your absence</p>
      </div>

      {/* Guidelines */}
      <div className="bg-linear-to-br from-blue-500/10 to-blue-500/5 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span><FaBook /></span> Important Guidelines
        </h3>
        <ul className="text-sm text-gray-300 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            Submit your excuse within 24 hours after the event
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            Attach supporting documents (medical certificate, etc.) if available
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            Provide a clear and detailed explanation
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            Your excuse will be reviewed by the event organizer
          </li>
        </ul>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl ${message.includes("success") ? "bg-green-500/20 border border-green-500/30 text-green-400" : "bg-red-500/20 border border-red-500/30 text-red-400"}`}>
          {message}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-6">
        {/* Event Selection */}
        <div>
          <label className="block text-sm font-semibold text-white mb-2">Select Event (Absences Only)</label>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
            required
          >
            <option value="">-- Select an event --</option>
            {absentEvents.length === 0 ? (
              <option value="" disabled>No absent events found</option>
            ) : (
              absentEvents.map((record) => (
                <option key={record._id} value={record.event._id}>
                  {record.event.title} - {new Date(record.event.date).toLocaleDateString()}
                </option>
              ))
            )}
          </select>
          {absentEvents.length === 0 && (
            <p className="text-sm text-gray-400 mt-2">
              You don't have any absent events to excuse.
            </p>
          )}
        </div>

        {/* Excuse Text */}
        <div>
          <label className="block text-sm font-semibold text-white mb-2">Excuse Description</label>
          <textarea
            value={excuseText}
            onChange={(e) => setExcuseText(e.target.value)}
            rows={5}
            placeholder="Please provide a detailed explanation for your absence..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
            required
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-semibold text-white mb-2">Attach Document (Optional)</label>
          <div className="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center hover:border-red-500/30 transition-colors">
            <input
              type="file"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {file ? (
                <div className="space-y-2">
                  <span className="text-4xl"><FaCheck /></span>
                  <p className="text-green-400 font-medium">{file.name}</p>
                  <p className="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-4xl"><FaFileAlt /></span>
                  <p className="text-gray-400">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500">PDF, DOC, JPG, PNG (max 5MB)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={submitting || absentEvents.length === 0}
            className="flex-1 bg-linear-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-green-600/30 transition-all duration-200 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Submitting...
              </>
            ) : (
              "Submit Excuse"
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-xl transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Warning */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl">
        <p className="text-yellow-400 text-sm">
          <strong>Note:</strong> Submitting false or misleading information may result in disciplinary action.
        </p>
      </div>
    </div>
  );
};

export default SubmitExcuse;
