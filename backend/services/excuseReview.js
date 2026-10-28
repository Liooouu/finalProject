const { excuseWindow } = require('./excuseWindow');

// Review uses the submission time, so an on-time request can be reviewed later.
function excuseReviewIssue(excuse, attendance) {
  if (!excuse.event) return 'The event record is unavailable.';
  if (excuse.type !== 'absence') return 'Advance excuse letters are no longer accepted. This request can be rejected only.';
  if (!(excuse.attachments?.length || excuse.attachmentUrl)) return 'A supporting attachment is required before an excuse can be approved.';
  const submitted = new Date(excuse.createdAt);
  if (!Number.isFinite(submitted.getTime())) return 'The submission date is unavailable.';
  const window = excuseWindow(excuse.event, submitted);
  if (!window.allowed) return window.reason;
  if (attendance !== undefined && attendance?.status !== 'absent') return 'Only a recorded absence can be excused.';
  return '';
}
module.exports = { excuseReviewIssue };
