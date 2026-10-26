"use client";
import { useMemo } from "react";
import Link from "next/link";
import { allRows, RECOMMENDATIONS } from "../../lib/data";
import { monthCost } from "../../lib/data";
import { currentMonthForecast, detectAnomalies } from "../../lib/insights";
import { fmtMoneyFull } from "../../lib/format";

export default function Demo() {
  const rows = useMemo(() => allRows(), []);
  const mtd = monthCost(rows, "2026-10");
  const anomaly = detectAnomalies(rows)[0];
  const savings = RECOMMENDATIONS.filter((r) => r.status === "Open").reduce((a, r) => a + r.monthlySavings, 0);
  const fc = currentMonthForecast(rows);
  const steps = [
    { n: 1, title: "Connect — read-only, least privilege", body: "One connection per cloud, read-only roles only, federation over static keys. No write access, no secrets in code.", href: "/connections" },
    { n: 2, title: "See all clouds in one number", body: `Month-to-date spend across AWS, Azure and GCP: ${fmtMoneyFull(mtd)} (Oct 2026, estimated). One number, one currency, one cost basis — Billed, so it ties to invoices.`, href: "/" },
    { n: 3, title: "Find the March EC2 spike", body: anomaly ? `${anomaly.service}: actual ${fmtMoneyFull(anomaly.actual)} vs expected ${fmtMoneyFull(anomaly.expected)} (${anomaly.deltaPct}% over baseline), top contributor ${anomaly.contributors[0]?.label}. Median/MAD baseline, Purchase charges excluded so savings-plan buys never look like spikes.` : "See Anomalies.", href: "/anomalies" },
    { n: 4, title: "Budget breach, before it happens", body: `Total-cloud budget forecast ${fmtMoneyFull(fc.forecast)} against a $22,000 monthly budget — the forecast breach fires on forecast, not after the money is spent.`, href: "/budgets" },
    { n: 5, title: "Savings you can act on", body: `Open recommendations total ${fmtMoneyFull(savings)}/month (provider estimates, labelled as such). Every recommendation links to its resource and evidence, with realised savings verified afterwards.`, href: "/recommendations" },
    { n: 6, title: "Export and reconcile", body: "Export the exact filtered view as CSV or JSON from the Explorer. Totals in the export equal totals on screen, and every figure carries data-as-of, freshness and reconciliation state.", href: "/explorer" },
  ];
  return (
    <div>
      <h1>Demo walkthrough — 3 minutes</h1>
      <p className="muted"><strong>Problem in one sentence:</strong> a company&apos;s cloud bill is split across AWS, Azure and GCP consoles that never agree, so nobody can answer &ldquo;why did our bill go up?&rdquo; in one place.</p>
      <p className="muted"><strong>Is this real data?</strong> Honest answer: by default this build shows deterministic demo data (labelled on every page). Switch to live provider data with LEDGER_DATA_SOURCE=live plus the env vars in docs/REAL_ACCOUNTS.md — an unconfigured provider shows &ldquo;Not connected&rdquo;, never fake numbers. Full script: DEMO.md.</p>
      <ol style={{ display: "grid", gap: 12, padding: 0, listStyle: "none" }}>
        {steps.map((s) => (
          <li key={s.n} className="card" style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Step {s.n} — {s.title}</h2>
            <p>{s.body}</p>
            <Link href={s.href}>Open this view →</Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
