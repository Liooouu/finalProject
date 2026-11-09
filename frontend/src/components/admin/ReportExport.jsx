import Button from '../ui/Button';
import { useId, useState } from 'react';

export default function ReportExport({ busy, onExport }) {
  const id = useId();
  const [format, setFormat] = useState('xlsx');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={id}>Download format</label>
      <select id={id} className="field-select !w-auto" value={format} onChange={event => setFormat(event.target.value)} disabled={busy}>
        <option value="xlsx">Excel (.xlsx)</option>
        <option value="csv">CSV (.csv)</option>
      </select>
      <Button variant="primary" size="sm" loading={busy}
        title="Download all records matching the report filters"
        onClick={() => onExport(format)}>
        Export
      </Button>
    </div>
  );
}
