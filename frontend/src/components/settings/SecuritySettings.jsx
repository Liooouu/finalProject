import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import {
  FaExclamationTriangle,
  FaCameraRetro,
  FaHeadset,
} from "react-icons/fa";
import { usePageMeta } from "../../context/PageMetaContext";
import { Button, FlightPanel, PageHeader, StatusChip } from "../ui";
import Loading from "../shared/Loading";
import FaceCapture from "../auth/FaceCapture";
import PrivateImage from "../shared/PrivateImage";
import { formatDateTime } from "../../utils/helpers";

const SecuritySettings = ({ embedded = false }) => {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [facePhoto, setFacePhoto] = useState(null);
  const [faceEnrolledAt, setFaceEnrolledAt] = useState(null);
  const [enrollingFace, setEnrollingFace] = useState(false);
  const [faceAgreed, setFaceAgreed] = useState(false);
  const [faceUploading, setFaceUploading] = useState(false);
  const [appeals, setAppeals] = useState([]);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealNote, setAppealNote] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  usePageMeta("Security", "Manage your attendance face enrollment.");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [devRes, appealsRes] = await Promise.all([
          api.get("/account"),
          api.get("/student/security/face-appeals"),
        ]);
        if (active) {
          setFacePhoto(devRes.data.facePhoto || null);
          setFaceEnrolledAt(devRes.data.faceEnrolledAt || null);
          setAppeals(appealsRes.data || []);
        }
      } catch (err) {
        if (active) {
          setMessage(err.response?.data?.message || "Failed to load security settings");
          setMessageType("error");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const submitAppeal = async (blob) => {
    setAppealSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("photo", blob, "proof.jpg");
      fd.append("note", appealNote.trim());
      const res = await api.post("/student/security/face-appeals", fd);
      setAppeals([res.data, ...appeals]);
      setShowAppealForm(false);
      setAppealNote("");
      showMessage("Appeal submitted. An admin will review your proof photo.");
    } catch (err) {
      console.error(err);
      showMessage(
        err.response?.data?.error || err.response?.data?.message || "Failed to submit appeal",
        "error"
      );
    } finally {
      setAppealSubmitting(false);
    }
  };

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  const handleFaceUpload = async (blob) => {
    if (!faceAgreed) return;
    setFaceUploading(true);
    try {
      const fd = new FormData();
      fd.append("face", blob, "face.jpg");
      fd.append("consent", "true");
      const res = await api.post("/account/face", fd);
      setFacePhoto(res.data.facePhoto);
      setFaceEnrolledAt(res.data.faceEnrolledAt);
      setFaceAgreed(false);
      setEnrollingFace(false);
      showMessage(facePhoto ? "Enrolled face updated. Your next check-in will use the new face photo." : "Face enrolled. You can now check in at an organizer-operated attendance station.");
    } catch (err) {
      console.error(err);
      showMessage(
        err.response?.data?.error || err.response?.data?.message || "Failed to save face photo",
        "error"
      );
    } finally {
      setFaceUploading(false);
    }
  };

  return (
    <div className={embedded ? "space-y-5" : "mx-auto max-w-4xl space-y-5"}>
      {!embedded && <PageHeader
        eyebrow="Account"
        title="Security"
        subtitle="Your face enrollment and attendance verification support."
      />}

      {message && (
        <div
          role="status"
          className={`alert ${messageType === "error" ? "alert-danger" : "alert-ok"}`}
        >
          <span aria-hidden="true">{messageType === "error" ? "!" : "✓"}</span>
          <p>{message}</p>
        </div>
      )}

      {loading && <Loading />}
      <FlightPanel
        level="instrument"
        glass
        eyebrow="Biometrics"
        title="Face verification"
        subtitle={
          faceEnrolledAt
            ? "Your face is enrolled for event attendance. You can replace it with a new camera capture."
            : facePhoto
              ? "Update your face photo to enable it for event attendance."
              : "Enroll your face to check in at event stations."
        }
        icon={<FaCameraRetro />}
        actions={
          <Button
            onClick={() => { setFaceAgreed(false); setEnrollingFace(true); }}
            disabled={faceUploading || loading}
            size="sm"
            className="shrink-0"
          >
            {facePhoto ? "Change enrolled face" : "Enroll face"}
          </Button>
        }
      >
        {facePhoto && (
          <div className="mb-4 flex items-center gap-3">
            <PrivateImage
              src={facePhoto}
              alt="Enrolled face"
              className="h-16 w-16 rounded-xl border border-line object-cover"
            />
            <p className="text-sm text-on-dim">Enrolled face photo</p>
          </div>
        )}

        {enrollingFace && (
          <div className="student-card mt-4 rounded-xl border border-line bg-card-alt/40 p-4">
            <label className="mb-4 flex items-start gap-3 text-sm text-on-dim">
              <input type="checkbox" checked={faceAgreed}
                onChange={(e) => setFaceAgreed(e.target.checked)} disabled={faceUploading}
                className="mt-1 h-4 w-4 shrink-0" />
              <span>I agree to TrackED storing my face photo and face signature for attendance
                identification. A new capture will replace my current enrolled face.
                I can ask the organizer for manual attendance instead.</span>
            </label>
            {faceAgreed && <FaceCapture
              title={facePhoto ? "Replace my enrolled face" : "Enroll my face"}
              onCapture={handleFaceUpload}
              onCancel={() => setEnrollingFace(false)}
              loading={faceUploading}
            />}
          </div>
        )}
      </FlightPanel>

      <FlightPanel
        level="ledger"
        glass
        tone="warn"
        eyebrow="Support"
        title="Face verification not working?"
        subtitle="Submit a proof photo and an admin will compare it to your enrolled face photo."
        icon={<FaHeadset />}
      >
        {appeals.length > 0 && (
          <div className="mt-4 space-y-2">
            {appeals.map((appeal) => (
              <div
                key={appeal._id}
                className="student-card flex flex-col gap-2 rounded-xl border border-line bg-card-alt/40 p-3.5 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-on">Appeal</p>
                    <StatusChip status={appeal.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-on-muted">
                    Submitted {formatDateTime(appeal.createdAt)}
                  </p>
                  {appeal.responseNote && (
                    <p className="mt-1 text-xs text-on-dim">
                      Admin note: {appeal.responseNote}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {showAppealForm ? (
          <div className="student-card mt-4 rounded-xl border border-line bg-card-alt/40 p-4">
            <FaceCapture
              title="Take proof photo"
              onCapture={submitAppeal}
              onCancel={() => setShowAppealForm(false)}
              loading={appealSubmitting}
            />
            <textarea
              value={appealNote}
              onChange={(e) => setAppealNote(e.target.value)}
              placeholder="Optional note for the admin (e.g. camera kept failing, lighting too dark)..."
              rows={2}
              className="field mt-3"
            />
          </div>
        ) : (
          <Button
            onClick={() => setShowAppealForm(true)}
            disabled={appealSubmitting}
            variant="secondary"
            size="sm"
            className="mt-4"
          >
            Submit an appeal
          </Button>
        )}
      </FlightPanel>

    </div>
  );
};

export default SecuritySettings;
