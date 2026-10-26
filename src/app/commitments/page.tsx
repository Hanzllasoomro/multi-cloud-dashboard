"use client";
import { COMMITMENTS } from "../../lib/data";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
export default function Commitments() {
  return (
    <div>
      <h1>Commitments</h1>
      <p className="muted">AWS Savings Plans / Reserved Instances, Azure reservations / savings plans and GCP committed use discounts normalised into one entity. Utilisation and coverage are checked against provider consoles for pilot accounts.</p>
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
        <p className="caption">Expiring-soon alerts fire before end dates. Purchase advice starts from provider recommendations before any in-house purchase modelling.</p>
      </section>
    </div>
  );
}
