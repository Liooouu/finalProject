import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import api from "../../api/axios";
import { FaCamera, FaTimes, FaCheck, FaExclamationTriangle } from "react-icons/fa";

const QRScanner = ({ eventId, onScanSuccess }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanner = async () => {
    setError("");
    setSuccess("");

    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          try {
            const qrData = JSON.parse(decodedText);
            
            if (!qrData.eventId || !qrData.studentId) {
              setError("Invalid QR code format");
              return;
            }

            if (qrData.eventId !== eventId) {
              setError("QR code is not for this event");
              return;
            }

            await handleScan(qrData.studentId);

            html5QrCode.pause(true);
          } catch (parseError) {
            setError("Invalid QR code format");
          }
        },
        () => {}
      );

      setIsScanning(true);
    } catch (err) {
      setError("Failed to start camera. Please allow camera access.");
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setIsScanning(false);
  };

  const handleScan = async (studentId) => {
    setError("");
    setSuccess("");

    try {
      const res = await api.post(`/events/${eventId}/attendance/scan`, {
        studentId,
      });

      const studentName = res.data.attendance.student.name;
      const status = res.data.attendance.status;

      setSuccess("Attendance marked!");
      setLastScan({
        name: studentName,
        status: status,
        time: new Date().toLocaleTimeString(),
      });

      if (onScanSuccess) {
        onScanSuccess(res.data.attendance);
      }

      setTimeout(() => {
        if (html5QrCodeRef.current) {
          html5QrCodeRef.current.resume();
        }
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to mark attendance");
      setTimeout(() => {
        if (html5QrCodeRef.current) {
          html5QrCodeRef.current.resume();
        }
      }, 2000);
    }
  };

  return (
    <div className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FaCamera className="text-red-400" />
          Scan Student QR
        </h3>
        {isScanning && (
          <button
            onClick={stopScanner}
            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {!isScanning ? (
        <button
          onClick={startScanner}
          className="w-full bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all duration-200 flex items-center justify-center gap-2"
        >
          <FaCamera />
          Start Scanner
        </button>
      ) : (
        <div className="space-y-4">
          <div id="qr-reader" className="rounded-xl overflow-hidden bg-black" ref={scannerRef} />
          <p className="text-sm text-gray-400 text-center">
            Point camera at student's QR code
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400">
          <FaExclamationTriangle />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-xl flex items-center gap-2 text-green-400">
          <FaCheck />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {lastScan && !error && (
        <div className="mt-4 p-4 bg-green-500/20 border border-green-500/30 rounded-xl text-center">
          <p className="text-lg font-bold text-white">{lastScan.name}</p>
          <p className={`text-sm font-medium ${lastScan.status === "present" ? "text-green-400" : "text-yellow-400"}`}>
            {lastScan.status.charAt(0).toUpperCase() + lastScan.status.slice(1)}
          </p>
        </div>
      )}
    </div>
  );
};

export default QRScanner;
