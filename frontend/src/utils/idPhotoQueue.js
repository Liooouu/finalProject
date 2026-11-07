// Pending ID photos stay account-scoped in IndexedDB, never localStorage.
// Photos use a non-extractable AES key. This protects stored bytes, not a compromised origin/device.
const DB = 'tracked-id-captures-v1';
function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('captures', { keyPath: 'id' });
      request.result.createObjectStore('keys');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Device storage is unavailable. Keep this page open and try online.'));
  });
}
async function operation(store, mode, run) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode), request = run(tx.objectStore(store));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error || request.error);
      tx.onabort = () => reject(tx.error || request.error || new Error('Device storage could not save this capture.'));
    });
  } finally { db.close(); }
}
async function ownerKey(owner) {
  let key = await operation('keys', 'readonly', store => store.get(owner));
  if (key) return key;
  key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  try { await operation('keys', 'readwrite', store => store.add(key, owner)); return key; }
  catch { return operation('keys', 'readonly', store => store.get(owner)); }
}
export const listCaptures = async owner => (await operation('captures', 'readonly', store => store.getAll())).filter(row => row.owner === owner).sort((a,b) => a.savedAt - b.savedAt);
export async function saveCapture(owner, row, photo) {
  if (!owner || !photo || !crypto.subtle) throw new Error('Secure device storage requires HTTPS (or localhost).');
  const rows = await listCaptures(owner);
  if (rows.length >= 50) throw new Error('50 photos are waiting on this device. Sync them before taking more.');
  const key = await ownerKey(owner), iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await photo.arrayBuffer());
  const saved = { ...row, id: `${owner}:${row.clientId}`, owner, savedAt: Date.now(), iv, bytes };
  await operation('captures', 'readwrite', store => store.add(saved));
  return saved;
}
export async function capturePhoto(owner, row) {
  if (row.owner !== owner) throw new Error('Sign in with the organizer who captured this ID.');
  const key = await ownerKey(owner);
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: row.iv }, key, row.bytes);
  return new Blob([bytes], { type: 'image/jpeg' });
}
export async function removeCapture(owner, row) {
  if (row.owner !== owner) throw new Error('This capture belongs to another organizer.');
  await operation('captures', 'readwrite', store => store.delete(row.id));
}
