"use client";
import { useMemo } from "react";
import { allRows } from "../../lib/data";
import { evaluateBudgets } from "../../lib/insights";
import BudgetMeter from "../../components/BudgetMeter";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { useScenarioRows } from "../../components/useScenarioRows";
export default function Budgets() {
  const baseRows = useMemo(() => allRows(), []);
  const { rows } = useScenarioRows(baseRows);
  const budgets = useMemo(() => evaluateBudgets(rows), [rows]);
  return (
    <div>
      <h1>Budgets &amp; Alerts</h1>
      <div className="grid grid-3" style={{ marginBottom: 16 }}>{budgets.map((b) => <BudgetMeter key={b.id} name={b.name} scope={b.scope} amount={b.amount} actual={b.actual} forecast={b.forecast} />)}</div>
      <section className="card">
        <h2>All budgets</h2>
        <DataTable columns={[
          { key: "n", header: "Budget", render: (r) => r.name },
          { key: "s", header: "Scope", render: (r) => r.scope },
          { key: "p", header: "Period", render: (r) => r.period },
          { key: "a", header: "Amount", numeric: true, render: (r) => `$${r.amount.toLocaleString()}`, sortValue: (r) => r.amount },
          { key: "f", header: "Forecast", numeric: true, render: (r) => `$${r.forecast.toLocaleString()}`, sortValue: (r) => r.forecast },
          { key: "st", header: "State", render: (r) => <Badge tone={r.status === "OK" ? "success" : "warning"}>{r.status}</Badge> },
        ]} rows={budgets} />
      </section>
    </div>
  );
}
