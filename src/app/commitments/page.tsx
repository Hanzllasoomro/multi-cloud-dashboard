"use client";
import { COMMITMENTS } from "../../lib/data";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
export default function Commitments() {
  return (
    <div>
      <h1>Commitments</h1>
      <section className="card">
        <DataTable columns={[
          { key: "t", header: "Type", render: (r) => `${r.provider} · ${r.type}` },
          { key: "r", header: "Resource", render: (r) => r.resource },
          { key: "term", header: "Term / end", render: (r) => `${r.term} → ${r.end}` },
          { key: "u", header: "Utilisation %", numeric: true, render: (r) => `${r.utilization}%`, sortValue: (r) => r.utilization },
          { key: "c", header: "Coverage %", numeric: true, render: (r) => `${r.coverage}%`, sortValue: (r) => r.coverage },
          { key: "s", header: "Savings rate %", numeric: true, render: (r) => `${r.savingsRate}%`, sortValue: (r) => r.savingsRate },
          { key: "un", header: "Unused cost /mo", numeric: true, render: (r) => `$${r.unusedCost.toLocaleString()}`, sortValue: (r) => r.unusedCost },
          { key: "st", header: "Flag", render: (r) => r.utilization < 90 ? <Badge tone="warning">Under-used</Badge> : <Badge tone="success">Healthy</Badge> },
        ]} rows={COMMITMENTS} totals={["TOTAL", "", "", "", "", "", `$${COMMITMENTS.reduce((a, c) => a + c.unusedCost, 0).toLocaleString()}`, ""]} />
      </section>
    </div>
  );
}
