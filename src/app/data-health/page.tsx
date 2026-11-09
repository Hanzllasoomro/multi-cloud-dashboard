"use client";
import { CONNECTIONS } from "../../lib/data";
import DataTable from "../../components/DataTable";
import FreshnessIndicator from "../../components/FreshnessIndicator";
import Badge from "../../components/Badge";
export default function DataHealth() {
  return (
    <div>
      <h1>Data Health</h1>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Per-connection health</h2>
        <DataTable columns={[
          { key: "p", header: "Connection", render: (r) => `${r.provider} — ${r.name}` },
          { key: "f", header: "Freshness", render: (r) => <FreshnessIndicator freshness={r.freshness} monthState={r.monthState} reconciliation={r.reconciliation} dataAsOf={r.dataAsOf} /> },
          { key: "v", header: "Variance %", numeric: true, render: (r) => `${r.variancePct.toFixed(2)}%`, sortValue: (r) => r.variancePct },
          { key: "t", header: "Tolerance", render: (r) => r.monthState === "Final" ? "0.01%" : "0.5% (open month)" },
          { key: "s", header: "Gate", render: (r) => r.reconciliation === "Reconciled" ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Flagged — investigate</Badge> },
        ]} rows={CONNECTIONS} />
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Reconciliation variance breakdown (Azure, 0.68%)</h2>
        <ul><li>Tax timing: +0.41% — invoice tax posts after the export cut.</li><li>Marketplace purchases: +0.18% — marketplace lines arrive on a different cadence.</li><li>Credits applied late: +0.09%.</li></ul>
      </section>
      <section className="card">
        <h2>Month lifecycle</h2>
        <p><Badge tone="warning">Estimated</Badge> Open month, still changing → <Badge tone="info">Provisional</Badge> Invoice issued, near-final → <Badge tone="success">Final</Badge> Closed and reconciled within 0.01%.</p>
      </section>
    </div>
  );
}
