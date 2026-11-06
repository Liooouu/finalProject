import React from "react";
import { Doughnut } from "react-chartjs-2";

/** Keep the chart, its total, and the numeric legend in separate layout tracks. */
export default function ReportDonut({ data, options, total, unit, rows }) {
  return <div className="report-donut-layout">
    <div className="report-donut-chart">
      <Doughnut data={data} options={options} role="img" aria-label={`${total} ${unit}. ${rows.map(row => `${row.label}: ${row.value}`).join(", ")}`} />
      <div className="report-donut-total" aria-hidden="true">
        <strong className="num">{total}</strong><span>{unit}</span>
      </div>
    </div>
    <ul className="report-donut-legend">
      {rows.map(row => <li key={row.key || row.label}>
        <span className="report-donut-dot" style={{ backgroundColor: row.color }} aria-hidden="true" />
        <span className="report-donut-label">{row.label}</span>
        <strong className="num">{row.value}</strong>
        <span className="num report-donut-percent">{row.pct}%</span>
      </li>)}
    </ul>
  </div>;
}
