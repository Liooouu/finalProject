import React from "react";
import { FaIdCard } from "react-icons/fa";
import IdPhotoEvidence from "../shared/IdPhotoEvidence";
import { formatDateTime } from "../../utils/helpers";

export default function StudentIdAttendancePreview({ request }) {
  const status = request.status === 'pending' ? 'Pending review' : request.status === 'approved'
    ? request.resolution === 'id_photo' && !request.reviewedBy ? 'Recorded' : 'Approved' : 'Rejected';
  return <section className="student-id-preview" aria-label="Manual attendance ID preview">
    <p className="student-id-preview-title"><FaIdCard aria-hidden="true" /> Manual attendance · ID preview</p>
    <div className="student-id-preview-body portal-inset">
      <IdPhotoEvidence request={request} autoLoad layout="inline" />
      <div className="student-id-preview-details">
        <h4 className="font-semibold text-on">{request.action === 'time_out' ? 'Time Out' : request.proposedStatus === 'absent' ? 'Attendance cutoff' : request.mode === 'correction' ? 'Attendance correction' : 'Time In'}</h4>
        <p className="mt-1 text-sm text-on-dim">{formatDateTime(request.effectiveAt) || 'Not recorded'}</p>
        <p className={`student-id-preview-status ${request.status === 'approved' ? 'text-ok bg-ok/10' : request.status === 'rejected' ? 'text-danger bg-danger/10' : 'text-brand bg-brand/10'}`}>{status}</p>
      </div>
    </div>
  </section>;
}
