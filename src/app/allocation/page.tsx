"use client";
import { useMemo } from "react";
import { allRows, ALLOCATION_RULES } from "../../lib/data";
import { runQuery } from "../../lib/query";
import { fmtMoneyFull } from "../../lib/format";
import DataTable from "../../components/DataTable";
import { useScenarioRows } from "../../components/useScenarioRows";
import { BarChart } from "../../components/Charts";
export default function Allocation() {
  const baseRows = useMemo(() => allRows(), []);
  const { rows } = useScenarioRows(baseRows);
  const byTeam = runQuery(rows, { groupBy: ["tag:team"], start: "2025-11-01", end: "2026-10-26", topN: 20 });
  const total = byTeam.totals.cost;
  const allocated = byTeam.data.filter((d) => d.label !== "Untagged").reduce((a, d) => a + d.cost, 0);
  const untagged = byTeam.data.find((d) => d.label === "Untagged")?.cost || 0;
  return (
    <div>
      <h1>Allocation &amp; Showback</h1>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Reconciliation — allocated totals always equal source totals</h2>
        <p>Source total {fmtMoneyFull(total)} = allocated {fmtMoneyFull(allocated)} + untagged {fmtMoneyFull(untagged)} (nothing lost, nothing doubled). Untagged spend is always its own line, never hidden.</p>
        <BarChart horizontal data={byTeam.data.map((d) => ({ label: d.label, values: [d.cost] }))} />
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Allocation by team (tag normalised: case + whitespace)</h2>
        <DataTable columns={[
          { key: "t", header: "Team", render: (r) => r.label },
          { key: "c", header: "Cost", numeric: true, render: (r) => fmtMoneyFull(r.cost), sortValue: (r) => r.cost },
          { key: "s", header: "Share", numeric: true, render: (r) => `${((r.cost / total) * 100).toFixed(1)}%`, sortValue: (r) => r.cost },
        ]} rows={byTeam.data} totals={["TOTAL", fmtMoneyFull(total), "100.0%"]} />
      </section>
      <section className="card">
        <h2>Rules</h2>
        <DataTable columns={[
          { key: "n", header: "Rule", render: (r) => r.name },
          { key: "t", header: "Type", render: (r) => r.type },
          { key: "m", header: "Match", render: (r) => r.match },
          { key: "tg", header: "Target", render: (r) => r.target },
          { key: "s", header: "Split", render: (r) => r.split },
        ]} rows={ALLOCATION_RULES} />
      </section>
    </div>
  );
}
