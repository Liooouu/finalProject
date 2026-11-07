import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Button } from '../ui';
export default function IdPhotoEvidence({ request }) {
  const [url, setUrl] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const show = async () => {
    setBusy(true); setError('');
    try { const { data } = await api.get(`/id-photo-attendance/requests/${request._id}/photo`, { responseType: 'blob', timeout: 15000 }); setUrl(URL.createObjectURL(data)); }
    catch { setError('ID evidence is unavailable, expired, or you do not have access.'); }
    finally { setBusy(false); }
  };
  return <div className="mt-3 min-w-0"><p className="text-xs text-on-muted">{request.captureBasis === 'device' ? 'Offline capture: the recorded time needs independent confirmation.' : 'Server-timed, organizer-attested ID check. Not biometric verification.'}</p>
    {request.hasIdPhoto ? <Button type="button" variant="secondary" size="sm" className="mt-2" disabled={busy} onClick={() => url ? setUrl('') : show()}>{busy ? 'Loading evidence…' : url ? 'Hide ID photo' : 'View ID evidence'}</Button> : <p className="mt-1 text-xs text-on-muted">The ID photo retention period has ended. Attendance audit details remain.</p>}
    {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}{url && <img src={url} alt="Private school ID evidence for this attendance submission" className="mt-3 max-h-72 w-full rounded-xl bg-black object-contain" />}
  </div>;
}
