const { eventEndAt } = require('./eventLifecycle');
const EXCUSE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
function excuseWindow(event, now = new Date()) {
  const endedAt = eventEndAt(event);
  if (!endedAt) return { allowed: false, reason: 'Event schedule is unavailable', deadline: null };
  const deadline = new Date(endedAt.getTime() + EXCUSE_WINDOW_MS);
  return { endedAt, deadline, allowed: now >= endedAt && now <= deadline,
    reason: now < endedAt ? 'Excuse letters can only be submitted after the event ends' : now > deadline ? 'The 7-day excuse submission deadline has passed' : '' };
}
module.exports = { excuseWindow, EXCUSE_WINDOW_MS };
