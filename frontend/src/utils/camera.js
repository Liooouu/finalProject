export const cameraUnavailable = () =>
  typeof navigator === "undefined" ||
  !navigator.mediaDevices ||
  typeof navigator.mediaDevices.getUserMedia !== "function";

export const describeCameraError = (err) => {
  if (cameraUnavailable()) {
    // Browsers only expose getUserMedia on a secure context: HTTPS, or
    // localhost. Say so without hardcoding a host that is wrong in production.
    return "This browser can't reach a camera on an insecure origin. Open the app over HTTPS (or on localhost during development) and reload.";
  }

  const name = (err && err.name) || "";
  const details = String((err && err.message) || err || "").trim();
  const haystack = `${name} ${details}`;

  if (/NotAllowed|PermissionDenied|SecurityError/i.test(haystack)) {
    return "Camera permission was denied. Click the camera icon in the address bar, set it to Allow, then reload this page.";
  }
  if (/NotFound|DevicesNotFound|Overconstrained|RequestedDeviceNotFound/i.test(haystack)) {
    return "No camera was found on this device. Check that your camera is enabled and not covered by a privacy shutter.";
  }
  if (/NotReadable|TrackStart|Abort|Permission\s?Dismissed|busy/i.test(haystack)) {
    return "Your camera is already in use by another app or tab (Teams, Zoom, or a second TrackED tab). Close it, then try again.";
  }

  return details
    ? `Camera couldn't start: ${details}`
    : "Camera couldn't start. Close other apps that may be using it, then try again.";
};