import { useEffect, useState } from "react";

const STORAGE_KEY = "tracked:camera-preview-mirrored";

export default function useCameraPreview() {
  const [mirrored, setMirrored] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const syncPreference = event => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setMirrored(event.newValue === "true");
      }
    };
    window.addEventListener("storage", syncPreference);
    return () => window.removeEventListener("storage", syncPreference);
  }, []);

  const flipPreview = () => {
    const next = !mirrored;
    setMirrored(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // The preview still works when device storage is unavailable.
    }
  };

  return {
    flipPreview,
    previewStyle: { transform: mirrored ? "scaleX(-1)" : "none" },
  };
}
