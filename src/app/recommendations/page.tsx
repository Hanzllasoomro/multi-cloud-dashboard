"use client";
import { useState } from "react";
import { RECOMMENDATIONS } from "../../lib/data";
import RecommendationCard from "../../components/RecommendationCard";
import { fmtMoneyFull } from "../../lib/format";
export default function Recommendations() {
  const [status, setStatus] = useState("All");
  const list = status === "All" ? RECOMMENDATIONS : RECOMMENDATIONS.filter((r) => r.status === status);
  const total = list.filter((r) => r.status === "Open").reduce((a, r) => a + r.monthlySavings, 0);
  const totalAll = RECOMMENDATIONS.reduce((a, r) => a + r.monthlySavings, 0);
  return (
    <div>
      <h1>Recommendations</h1>
      <label className="small">Status <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option><option>Open</option><option>Accepted</option><option>Dismissed</option><option>Implemented</option></select></label>
      <p><strong>Open potential savings: {fmtMoneyFull(total)}/month</strong></p>
      <p><strong>Total estimated monthly savings (all recommendations, estimate): {fmtMoneyFull(totalAll)}/month</strong></p>
      <div className="grid grid-2">{list.map((r) => <RecommendationCard key={r.id} r={r} />)}</div>
    </div>
  );
}
