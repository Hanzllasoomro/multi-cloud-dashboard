"use client";
import { useState } from "react";
const TYPES = [
  { name: "Monthly executive summary", desc: "KPIs, trend, provider split, top movers — one page for leadership." },
  { name: "Team showback", desc: "Allocated cost per team/project, with untagged spend as its own line." },
  { name: "Saved explorer view", desc: "Any explorer filter set, re-run on the latest data version." },
  { name: "Budget status", desc: "All budgets vs actual and forecast, with triggered items first." },
  { name: "Commitment report", desc: "Utilisation, coverage, expiring commitments, unused cost." },
  { name: "Anomaly digest", desc: "Open anomalies with root-cause contributors, weekly or monthly." },
];
export default function Reports() {
  const [format, setFormat] = useState("PDF");
  const [schedule, setSchedule] = useState("Monthly");
  const [sent, setSent] = useState(false);
  return (
    <div>
      <h1>Reports &amp; Exports</h1>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>{TYPES.map((t) => (
        <article key={t.name} className="card"><h3>{t.name}</h3><p className="muted">{t.desc}</p>
          <label className="small">Format <select className="select" value={format} onChange={(e) => setFormat(e.target.value)}><option>PDF</option><option>CSV</option><option>XLSX</option></select></label>{" "}
          <label className="small">Schedule <select className="select" value={schedule} onChange={(e) => setSchedule(e.target.value)}><option>Monthly</option><option>Weekly</option><option>Once</option></select></label>{" "}
          <button className="btn" onClick={() => setSent(true)}>Schedule delivery</button></article>))}
      </div>
      {sent && <p role="status"><strong>Scheduled:</strong> {format} report, {schedule.toLowerCase()} delivery by email/Slack or expiring link (permissions enforced).</p>}
    </div>
  );
}
