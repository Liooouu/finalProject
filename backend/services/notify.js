// backend/services/notify.js
// One place that writes an in-app Notification AND, when SMTP is configured,
// emails the same recipients their registered address. Keeping both actions
// together means the wording can never drift between the bell menu and the
// inbox.
const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendMail, isMailEnabled } = require("./mailer");
const { renderNotificationEmail } = require("./emailTemplate");
const { publishRecordChange } = require("./recordUpdates");

// A department-wide announcement must not place hundreds of messages in the
// SMTP pool at once. This limit is shared by overlapping notification batches;
// verification and password-reset emails can still use the mailer directly.
const EMAIL_CONCURRENCY = 3;
const emailQueue = [];
let activeEmails = 0;

function drainEmailQueue() {
  while (activeEmails < EMAIL_CONCURRENCY && emailQueue.length) {
    const { send, resolve } = emailQueue.shift();
    activeEmails += 1;
    Promise.resolve()
      .then(send)
      .then(result => resolve(result !== false), () => resolve(false))
      .finally(() => {
        activeEmails -= 1;
        drainEmailQueue();
      });
  }
}

function queueEmail(send) {
  return new Promise(resolve => {
    emailQueue.push({ send, resolve });
    drainEmailQueue();
  });
}

// Recipients may be full user documents (carrying name/email) or bare ids.
// Docs are used as-is; ids are fetched in one query.
async function resolveRecipients(recipients) {
  const docs = [];
  const ids = [];

  for (const recipient of recipients || []) {
    if (!recipient) continue;
    const id = recipient._id || recipient;
    if (recipient.email && recipient.name !== undefined) {
      docs.push({ _id: id, name: recipient.name, email: recipient.email });
    } else {
      ids.push(id);
    }
  }

  if (ids.length) {
    const fetched = await User.find({ _id: { $in: ids } }).select("_id name email");
    docs.push(...fetched);
  }

  // De-duplicate (e.g. an organizer who is also in the admin list).
  const seen = new Set();
  return docs.filter((u) => {
    const key = String(u._id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function notifyUsers(recipients, { type, title, message, relatedEvent, event, deferEmail = false }) {
  const users = await resolveRecipients(recipients);
  if (users.length === 0) return;

  await Notification.insertMany(
    users.map((u) => ({
      user: u._id,
      type,
      title,
      message,
      ...(relatedEvent ? { relatedEvent } : {}),
    }))
  );

  publishRecordChange();
  const deliverEmail = async () => {
    try {
      if (!(await isMailEnabled())) return;
      const { subject, html, text } = await renderNotificationEmail({ title, message, event });
      const results = await Promise.all(users.filter(user => user.email).map(user =>
        queueEmail(() => sendMail({ to: user.email, subject, html, text }))
      ));
      const failed = results.filter(sent => !sent).length;
      if (failed) {
        console.error(`[notifications] Email submission failed for ${failed} of ${results.length} recipients. Their in-app notifications remain available.`);
      }
    } catch (error) {
      // SMTP/configuration problems happen after the notice has been saved.
      // Do not turn a completed attendance or excuse action into an API error.
      console.error("Notification email delivery failed:", error.message);
    }
  };
  if (deferEmail) {
    // In-app notices are persisted above. Slow SMTP delivery must not delay
    // confirmation of a successfully saved event.
    setImmediate(() => { deliverEmail().catch(error => console.error("Notification email delivery failed:", error.message)); });
    return;
  }
  await deliverEmail();
}

// Everyone who should hear about a shared event: students (including promoted
// student organizers), legacy organizer accounts, admins, and its owner.
async function eventRecipients(event) {
  const organizerId = event?.organizer?._id || event?.organizer;
  const clauses = [{ role: { $in: ["organizer", "admin"] } }, require("./studentEligibility").activeStudentFilter()];
  if (organizerId) clauses.push({ _id: organizerId });

  return User.find({ $or: clauses }).select("_id name email");
}

module.exports = { notifyUsers, eventRecipients };
