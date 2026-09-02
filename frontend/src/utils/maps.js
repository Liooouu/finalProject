export const eventMapEmbedUrl = (event) => {
  const q = event?.mapQuery?.trim() || event?.location?.trim();
  return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : null;
};