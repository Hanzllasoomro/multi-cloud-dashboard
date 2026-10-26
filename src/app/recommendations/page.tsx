"use client";
import { useState } from "react";
import { RECOMMENDATIONS } from "../../lib/data";
import RecommendationCard from "../../components/RecommendationCard";
import { fmtMoneyFull } from "../../lib/format";
export default function Recommendations() {
  const [status, setStatus] = useState("All");
  const list = status === "All" ? RECOMMENDATIONS : RECOMMENDATIONS.filter((r) => r.status === status);
  const total = list.filter((r) => r.status === "Open").reduce((a, r) => a + r.monthlySavings, 0);
  return (
    <div>
      <h1>Recommendations</h1>
      <p className="muted">Provider-native sources (AWS Cost Optimization Hub / Compute Optimizer, Azure Advisor Cost, GCP Recommender) plus Ledger&apos;s own inventory/utilisation rules, in one entity. Savings are the provider&apos;s estimate, labelled as such. Realised savings are verified by comparing cost before and after implementation.</p>
      <label className="small">Status <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option><option>Open</option><option>Accepted</option><option>Dismissed</option><option>Implemented</option></select></label>
      <p><strong>Open potential savings: {fmtMoneyFull(total)}/month</strong></p>
      <div className="grid grid-2">{list.map((r) => <RecommendationCard key={r.id} r={r} />)}</div>
    </div>
  );
}
