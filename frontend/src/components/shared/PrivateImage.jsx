import React, { useEffect, useState } from "react";
import api from "../../api/axios";

const API_BASE = api.defaults.baseURL.replace(/\/api$/, "");
const PRIVATE_PREFIX = "/uploads/private-faces/";
const EMPTY = { src: null, url: null, failed: false };

// Renders an image from /uploads. Face photos live in a private directory that
// the server refuses to serve statically, so those are fetched with the auth
// token and shown from a blob URL instead of being exposed as a plain <img src>.
export default function PrivateImage({ src, alt, ...imgProps }) {
  const isPrivate = typeof src === "string" && src.startsWith(PRIVATE_PREFIX);
  const [loaded, setLoaded] = useState(EMPTY);

  useEffect(() => {
    if (!isPrivate) return undefined;

    let active = true;
    let url = null;

    api
      .get(`/account/face/${src.slice(PRIVATE_PREFIX.length)}`, { responseType: "blob" })
      .then((res) => {
        if (!active) return;
        url = URL.createObjectURL(res.data);
        setLoaded({ src, url, failed: false });
      })
      .catch(() => {
        if (active) setLoaded({ src, url: null, failed: true });
      });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src, isPrivate]);

  if (isPrivate) {
    const current = loaded.src === src ? loaded : EMPTY;
    if (current.failed || !current.url) return null;
    return <img src={current.url} alt={alt} {...imgProps} />;
  }

  return <img src={`${API_BASE}${src}`} alt={alt} {...imgProps} />;
}
