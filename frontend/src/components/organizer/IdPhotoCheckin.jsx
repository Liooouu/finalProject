import { sessionMode } from "../../utils/attendanceSessions";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../api/axios';
import { getUserFromToken } from '../../utils/auth';
import { capturePhoto, listCaptures, removeCapture, saveCapture } from '../../utils/idPhotoQueue';
import { formatDateTime } from '../../utils/helpers';
import { Button, Card } from '../ui';
import Pagination from '../ui/Pagination';
import StablePage from '../ui/StablePage';
import ConfirmDialog from '../ui/ConfirmDialog';

const connectionFailure = e => !e.response || [502, 503, 504].includes(e.response.status);
const errorText = e => e.response?.data?.error || e.message || 'Please try again.';
export default function IdPhotoCheckin({ event, canCapture = false, attendees = [], onRecorded, onViewRecords }) {
  const owner = String(getUserFromToken()?.id || '');
  const eventId = event?._id;
  const [sessionId, setSessionId] = useState(event?.attendanceSessions?.[0]?._id || "");
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const selectedSession = event?.attendanceSessions?.find(row => row._id === sessionId);
  const actionClock = useRef(null);
  const sessionNow = actionClock.current ? actionClock.current.server + performance.now() - actionClock.current.monotonic : clock;
  const action = selectedSession ? sessionMode(selectedSession, sessionNow, event.status) : "time_in";
  const [prepared, setPrepared] = useState(null), [query, setQuery] = useState(''), [student, setStudent] = useState(null);
  const [page, setPage] = useState(1), [queuePage, setQueuePage] = useState(1), [queue, setQueue] = useState([]);
  const [photo, setPhoto] = useState(null), [capture, setCapture] = useState(null), [checked, setChecked] = useState(false);
  const [opening, setOpening] = useState(false);
  const [camera, setCamera] = useState(false), [busy, setBusy] = useState(false), [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [discard, setDiscard] = useState(null);
  const [online, setOnline] = useState(navigator.onLine), [serverUnavailable, setServerUnavailable] = useState(false), [lastReceipt, setLastReceipt] = useState(null);
  const video = useRef(null), stream = useRef(null), anchor = useRef(null), syncingRef = useRef(false), active = useRef(true);
  const preview = useMemo(() => photo ? URL.createObjectURL(photo) : '', [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (camera && video.current && stream.current) {
      video.current.srcObject = stream.current;
      video.current.play().catch(() => {});
    }
  }, [camera, opening]);
  const stopCamera = useCallback(() => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setCamera(false); }, []);
  const refreshQueue = useCallback(async () => {
    try { const rows = await listCaptures(owner); if (active.current) setQueue(rows); }
    catch (e) { if (active.current) setError(errorText(e)); }
  }, [owner]);
  const prepare = useCallback(async signal => {
    if (!canCapture || !navigator.onLine || !/^[a-f0-9]{24}$/i.test(eventId || "")) return;
    try {
      const started = performance.now();
      const { data } = await api.post('/id-photo-attendance/prepare', { eventId, sessionId: sessionId || undefined }, { timeout: 15000, signal });
      if (!active.current) return;
      anchor.current = { server: +new Date(data.serverTime), monotonic: (started + performance.now()) / 2 };
      setServerUnavailable(false);
      actionClock.current = anchor.current;
      setPrepared(data); setError('');
    } catch (e) {
      if (signal?.aborted || e.code === 'ERR_CANCELED' || !active.current) return;
      setServerUnavailable(connectionFailure(e));
      if (e.response?.status === 403) setPrepared(null);
      setError(connectionFailure(e) ? 'Could not connect. Connect once to prepare this event, then keep this page open.' : errorText(e));
    }
  }, [canCapture, eventId, sessionId]);
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    refreshQueue();
    // Defer past the development StrictMode rehearsal so it does not send duplicate POSTs.
    const timer = setTimeout(() => prepare(controller.signal), 0);
    return () => { clearTimeout(timer); controller.abort(); active.current = false; stream.current?.getTracks().forEach(track => track.stop()); };
  }, [prepare, refreshQueue]);
  useEffect(() => { const warn = e => { if (queue.length) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [queue.length]);

  const sync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true; setSyncing(true);
    let synced = 0;
    try {
      const rows = await listCaptures(owner);
      for (const row of rows) {
        try {
          const form = new FormData();
          for (const key of ['clientId', 'studentId', 'ticket', 'capturedAt']) form.append(key, row[key]);
          form.append('identityChecked', 'true');
          form.append('photo', await capturePhoto(owner, row), 'school-id.jpg');
          const { data } = await api.post('/id-photo-attendance/captures', form, { timeout: 30000 });
          // Only a server receipt releases the local evidence. A timeout retains the same clientId.
          await removeCapture(owner, row); synced++;
          if (active.current) setServerUnavailable(false);
          if (active.current) { setLastReceipt({ ...data, name: row.studentName }); setMessage(`${row.studentName}: ${data.message}`); }
        } catch (e) {
          if (active.current) setError(`${row.studentName}: ${errorText(e)} The photo remains on this device; retry or discard it after checking the existing record.`);
          if (connectionFailure(e)) { if (active.current) setServerUnavailable(true); break; }
          if (e.response?.status === 401) break;
        }
      }
      if (synced && active.current) await onRecorded?.();
    } catch (e) {
      if (active.current) setError(errorText(e));
    } finally { syncingRef.current = false; if (active.current) { setSyncing(false); await refreshQueue(); } }
  }, [onRecorded, owner, refreshQueue]);
  useEffect(() => {
    const connected = () => { setOnline(true); if (!anchor.current) prepare(); sync(); };
    const disconnected = () => setOnline(false);
    window.addEventListener('online', connected); window.addEventListener('offline', disconnected);
    const initial = setTimeout(() => { if (navigator.onLine) sync(); }, 0);
    const timer = setInterval(() => { if (navigator.onLine) sync(); }, 30000);
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); clearInterval(timer); clearTimeout(initial); };
  }, [prepare, sync]);

  const startCamera = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) { setError('The camera needs HTTPS and browser camera permission.'); return; }
    setOpening(true);
    try {
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1000 } } });
      if (!active.current) { stream.current.getTracks().forEach(track => track.stop()); return; }
      setCamera(true);
    } catch { setError('Camera unavailable. Allow camera access and try again, or use another organizer station.'); }
    finally { if (active.current) setOpening(false); }
  };
  const takePhoto = async () => {
    if (!canCapture || !video.current?.videoWidth || !prepared || !student) return;
    setBusy(true); setError('');
    try {
      if (action === "closed") throw new Error("Neither Time In nor Time Out is open for this session.");
      let signed;
      // Bind the online check-in to server time for this specific student.
      if (navigator.onLine) {
        try { signed = (await api.post('/id-photo-attendance/capture-time', { eventId, sessionId: sessionId || undefined, action, studentId: student._id }, { timeout: 4000 })).data; setServerUnavailable(false); }
        catch (e) {
          if (!connectionFailure(e)) throw e;
          setServerUnavailable(true);
        }
      }
      const capturedAt = signed?.serverTime || new Date(anchor.current.server + performance.now() - anchor.current.monotonic).toISOString();
      const canvas = document.createElement('canvas'), source = video.current;
      const scale = Math.min(1, 1600 / Math.max(source.videoWidth, source.videoHeight));
      canvas.width = Math.round(source.videoWidth * scale); canvas.height = Math.round(source.videoHeight * scale);
      canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (!blob) throw new Error('The camera could not capture this image. Try again.');
      setPhoto(blob); setCapture({ ticket: signed?.ticket || prepared.tickets?.[action] || prepared.ticket, capturedAt, basis: signed ? 'server' : 'device', action });
      setChecked(false); stopCamera();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const save = async e => {
    e.preventDefault(); if (!canCapture || !photo || !capture || !student || !checked || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const existing = await listCaptures(owner);
      if (existing.some(row => row.eventId === eventId && (row.sessionId || "") === sessionId && (row.action || "time_in") === capture.action && row.studentId === student._id)) throw new Error('A photo for this student and event is already waiting on this device. Sync that capture first.');
      await saveCapture(owner, { clientId: crypto.randomUUID(), eventId, sessionId, sessionName: selectedSession?.name || "", action: capture.action, eventTitle: event.title, studentId: student._id, studentName: student.name, ticket: capture.ticket, capturedAt: capture.capturedAt, basis: capture.basis }, photo);
      setPhoto(null); setCapture(null); setChecked(false); setStudent(null); setQuery(''); setPage(1);
      setMessage(navigator.onLine ? 'Sending photo. Keep this page open until TrackED confirms it.' : 'Saved on this device. It will be sent for admin review when the connection returns.');
      await refreshQueue(); if (navigator.onLine) await sync();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const matches = (prepared?.students || []).filter(row => [row.name,row.email].some(value => String(value || '').toLowerCase().includes(query.toLowerCase().trim())));
  const studentStatus = new Map();
  for (const row of attendees) {
    if (String(row.session?._id || row.session || '') !== sessionId) continue;
    const studentId = String(row.student?._id || row.student);
    const pendingActions = row.pendingManualActions || [row.manualAttendanceRequest?.action];
    const recorded = sessionId
      ? !!row[action === 'time_out' ? 'timeOutAt' : 'timeInAt']
      : ['present', 'late'].includes(row.status);
    if (row.status === 'excused') studentStatus.set(studentId, 'Excused');
    else if (recorded) studentStatus.set(studentId, 'Recorded');
    else if (pendingActions.includes(action)) studentStatus.set(studentId, 'Awaiting review');
  }
  for (const row of queue) {
    if (row.eventId === eventId && (row.sessionId || '') === sessionId && (row.action || 'time_in') === action && !studentStatus.has(row.studentId)) {
      studentStatus.set(row.studentId, 'Pending sync');
    }
  }
  const currentPage = Math.min(page, Math.max(1, Math.ceil(matches.length / 5)));
  const currentQueuePage = Math.min(queuePage, Math.max(1, Math.ceil(queue.length / 5)));
  return <div className="min-w-0 space-y-4">
    {event && <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="panel-heading">ID attendance</h2><p className="mt-1 text-sm text-on-muted">Select a student, photograph their ID, then send it for admin review.</p></div><span className={`text-xs font-medium ${online && !serverUnavailable ? 'text-ok' : 'text-warn'}`}>{!online ? 'Offline' : serverUnavailable ? 'Server unreachable' : 'Online'}</span></div>
      <details className="mt-3 text-xs text-on-muted"><summary className="cursor-pointer">How it works &amp; privacy</summary><p className="mt-2">Compare the student with their physical ID. The system does not authenticate the ID or match its face automatically. ID photos are private and removed from the server after 30 days.</p><p className="mt-2">Load this page online before an outage. Keep it open and do not clear browser data until all photos have synced.</p></details>{(!online || serverUnavailable) && <p role="status" className="mt-3 text-sm text-warn">Keep this page open. Photos saved here will sync when TrackED can reconnect.</p>}
      {error && <p role="alert" className="alert alert-danger mt-4 [overflow-wrap:anywhere]">{error}</p>}
      {message && <p role="status" className="alert alert-ok mt-4 [overflow-wrap:anywhere]">{message}</p>}
      {lastReceipt && <p className="mt-2 text-sm text-on-dim">{lastReceipt.name}: {lastReceipt.status === 'approved' ? `Recorded · ${lastReceipt.attendanceStatus}` : lastReceipt.status === 'rejected' ? 'Rejected' : 'Awaiting admin review'} · {formatDateTime(lastReceipt.effectiveAt)}</p>}
      {event?.attendanceSessions?.length > 0 && <div className="mt-4">{event.attendanceSessions.length > 1 && <label className="field-label">Day / activity<select className="field-select w-full" value={sessionId} disabled={!!student || busy || !online || serverUnavailable} onChange={e => { anchor.current = null; setPrepared(null); setSessionId(e.target.value); setPage(1); }}>{event.attendanceSessions.map(row => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>}<p className="mt-2 font-semibold">{action === 'time_in' ? 'Time In' : action === 'time_out' ? 'Time Out' : 'Attendance window closed'}</p></div>}
      {!canCapture ? <p role="status" className="mt-4 text-sm text-on-dim">Ask an administrator to assign you to this event to submit manual attendance.</p> : !prepared ? <div className="mt-4"><Button type="button" disabled={!eventId || !online} onClick={() => prepare()}>Prepare event</Button><p className="mt-2 text-xs text-on-muted">Connect to load students. Keep this page open if the connection drops.</p></div> : prepared.available === false ? <div role="status" className="mt-4 rounded-xl bg-card-alt/40 p-4"><h3 className="font-semibold text-on">{prepared.state === 'closed' ? 'Attendance closed' : 'Event schedule needs attention'}</h3><p className="mt-2 text-sm text-on-dim">{prepared.message}</p>{onViewRecords && <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={onViewRecords}>View attendance records</Button>}</div> : !student ? <>
        <label htmlFor="id-photo-student-search" className="field-label mt-4">Find student</label><input id="id-photo-student-search" type="search" className="field w-full" placeholder="Student name or email" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />
        <StablePage pageKey={`id-students:${eventId}:${query}`} footer={<Pagination page={currentPage} pageSize={5} total={matches.length} onChange={setPage} label="ID check-in student pages" />}><ul className="mt-4 space-y-2">{matches.slice((currentPage-1)*5,currentPage*5).map(row => <li key={row._id} className="flex items-center justify-between gap-3 rounded-xl bg-card-alt/40 p-3"><div className="min-w-0"><p className="text-sm font-medium text-on [overflow-wrap:anywhere]">{row.name}</p><p className="text-xs text-on-muted [overflow-wrap:anywhere]">{row.email}</p><p className="mt-1 text-xs text-on-dim">{row.program} · Year {row.yearLevel} · {row.section}</p></div><Button size="sm" variant="secondary" disabled={opening || action === "closed" || studentStatus.has(row._id)} onClick={() => { setStudent(row); setError(''); setMessage(''); setLastReceipt(null); startCamera(); }}>{studentStatus.get(row._id) || "Take ID photo"}</Button></li>)}</ul>{!matches.length && <p className="py-6 text-sm text-on-muted">No matching eligible students.</p>}</StablePage>
      </> : <form onSubmit={save} className="mt-4 space-y-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold text-on [overflow-wrap:anywhere]">{student.name}</h3><p className="text-sm text-on-muted [overflow-wrap:anywhere]">{student.email}</p></div><Button type="button" size="sm" variant="secondary" disabled={busy || opening} onClick={() => { stopCamera(); setStudent(null); setPhoto(null); setCapture(null); setChecked(false); }}>Change student</Button></div>
        {opening ? <p role="status" className="py-4 text-sm text-on-muted">Opening camera… Please allow camera access.</p> : camera ? <div className="rounded-xl bg-black p-2"><video ref={video} autoPlay playsInline muted className="block max-h-80 w-full rounded-lg object-contain" style={{ transform: 'none' }} /><p className="px-2 py-3 text-center text-sm text-white">Keep the ID name and photo clear.</p><div className="flex justify-center gap-2 pb-2"><Button type="button" disabled={busy} onClick={takePhoto}>{busy ? 'Capturing…' : 'Take ID photo'}</Button><Button type="button" variant="secondary" disabled={busy} onClick={stopCamera}>Cancel camera</Button></div></div> : photo ? <div><img src={preview} alt="Captured school ID — check readability before submitting" className="max-h-80 w-full rounded-xl bg-black object-contain" /><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-on-muted">Captured: {formatDateTime(capture?.capturedAt)} · {capture?.basis === 'server' ? 'Server time' : 'Device estimate — needs review'}</p><Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => { setPhoto(null); setCapture(null); setChecked(false); startCamera(); }}>Retake</Button></div></div> : <Button type="button" onClick={startCamera}>Open ID camera</Button>}
        {photo && <><label className="flex items-start gap-3 text-sm text-on-dim"><input type="checkbox" className="mt-1 shrink-0 accent-brand" checked={checked} onChange={e => setChecked(e.target.checked)} disabled={busy}/><span>I checked the student in person. Their ID and selected account match.</span></label><p className="text-xs text-on-muted">{capture?.basis === 'server' ? 'Admin review uses the original capture time.' : 'Saved offline and sent for admin review when connected.'}</p><Button type="submit" disabled={busy || !checked}>{busy ? 'Saving…' : capture?.action === 'time_out' ? 'Submit Time Out' : 'Submit Time In'}</Button></>}
      </form>}
    </Card>}
    <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="panel-heading">Offline sync ({queue.length})</h2><p className="mt-1 text-xs text-on-muted">Photos stay on this device until TrackED receives them for admin review. Keep the prepared event open during an outage.</p></div><Button type="button" variant="secondary" size="sm" disabled={syncing || !online || !queue.length} onClick={() => { setError(''); sync(); }}>{syncing ? 'Syncing…' : 'Sync now'}</Button></div>
      <StablePage pageKey={`id-queue:${owner}`} footer={<Pagination page={currentQueuePage} pageSize={5} total={queue.length} onChange={setQueuePage} label="Pending photo pages" />}><ul className="mt-3 space-y-2">{queue.slice((currentQueuePage-1)*5,currentQueuePage*5).map(row => <li key={row.id} className="flex items-start justify-between gap-3 rounded-xl bg-card-alt/40 p-3"><div className="min-w-0"><p className="text-sm font-medium text-on [overflow-wrap:anywhere]">{row.studentName}</p><p className="text-xs text-on-muted [overflow-wrap:anywhere]">{row.eventTitle} · {row.sessionName || "Time In only"} · {row.action === "time_out" ? "Time Out" : "Time In"}</p><p className="mt-1 text-xs text-on-dim">{formatDateTime(row.capturedAt)} · Pending sync</p></div><Button type="button" size="sm" variant="ghost" disabled={syncing} onClick={() => setDiscard(row)}>Discard</Button></li>)}</ul>{!queue.length && <p className="py-4 text-sm text-on-muted">No photos waiting on this device.</p>}</StablePage>
    </Card>
    {!event && error && <p role="alert" className="alert alert-danger">{error}</p>}
    {!event && message && <p role="status" className="alert alert-ok">{message}</p>}
    <ConfirmDialog open={!!discard} title="Discard this unsynced ID photo?" message="This removes the only local copy. It will not record attendance. Check existing attendance before discarding a failed upload." confirmLabel="Discard photo" onCancel={() => setDiscard(null)} onConfirm={async () => { try { await removeCapture(owner, discard); setDiscard(null); await refreshQueue(); } catch (e) { setError(errorText(e)); } }} />
  </div>;
}
