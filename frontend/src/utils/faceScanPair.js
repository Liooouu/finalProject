// Allow slower devices to finish two inferences without accepting an old frame.
// Identity, drift and lookalike checks still run on BOTH probes on the server.
export const MAX_SCAN_PAIR_AGE_MS = 15000;

export function faceScanSize(width, height) {
  const scale = Math.min(1, 640 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function canPairFaceScans(previous, current) {
  if (!previous || previous.token !== current.token || previous.state !== current.state || previous.mode !== current.mode) return false;
  const age = current.at - previous.at;
  return age > 0 && age <= MAX_SCAN_PAIR_AGE_MS;
}
