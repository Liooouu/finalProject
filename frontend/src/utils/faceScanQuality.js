// Reject weak camera input before running recognition. This is image quality,
// not liveness or proof of identity.
export function faceScanIssue(detection, width, height, brightness) {
  const box = detection.box;
  if (detection.score < 0.65) return 'Look straight at the camera and hold still.';
  if (Math.min(box.width, box.height) < 96) return 'Move closer so your face fills more of the frame.';
  if (box.x < 4 || box.y < 4 || box.x + box.width > width - 4 || box.y + box.height > height - 4) return 'Keep your whole face inside the camera frame.';
  if (brightness < 45) return 'Your face is too dark. Face a light source.';
  if (brightness > 225) return 'Your face is too bright. Move away from direct light.';
  return '';
}
