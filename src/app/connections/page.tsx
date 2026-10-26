"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CONNECTIONS } from "../../lib/data";
import ConnectionCard from "../../components/ConnectionCard";

const SNIPPETS: Record<string, { title: string; code: string; perms: [string, string][] }> = {
  AWS: { title: "CloudFormation — least-privilege, read-only", code: `AWSTemplateFormatVersion: "2010-09-09"\nResources:\n  LedgerRole:\n    Type: AWS::IAM::Role\n    Properties:\n      AssumeRolePolicyDocument:\n        Statement:\n          - Effect: Allow\n            Principal: { AWS: "arn:aws:iam::LEDGER-ACCOUNT:root" }\n            Action: sts:AssumeRole\n            Condition: { StringEquals: { "sts:ExternalId": "ledger-conn-aws-UNIQUE" } }\n      # Billing export to YOUR S3 bucket (FOCUS) + Cost Explorer read\n      # Managed policies attached by the stack: none — inline least-privilege only.`,
    perms: [["s3:GetObject on the export prefix", "Read the FOCUS billing export files"], ["ce:GetCostAndUsage", "Independent reconciliation total (Cost Explorer)"], ["organizations:ListAccounts", "Discover member accounts under the payer"], ["cloudwatch:GetMetricData (optional)", "Utilisation only — cost views never depend on it"], ["cost-optimization-hub:ListRecommendations (optional)", "Provider-native recommendations"]] },
  Azure: { title: "Bicep — Entra app + role assignments", code: `// az ad app create --display-name ledger-reader\n// Role assignments at billing-account scope:\n//   Cost Management Reader  — read FOCUS exports + cost data\n//   Reader                  — resource inventory (read-only)\n//   Monitoring Reader       — utilisation metrics only (optional)\n//   Storage Blob Data Reader — read the export container only\n// Exports: FOCUS dataset, monthly, to your storage account.`,
    perms: [["Cost Management Reader", "Read cost + FOCUS exports"], ["Reader", "Resource inventory (read-only)"], ["Monitoring Reader (optional)", "Utilisation only"], ["Storage Blob Data Reader on export container", "Read export blobs"]] },
  GCP: { title: "gcloud — BigQuery billing export (no long-lived keys)", code: `# Billing export to BigQuery (detailed + pricing) in YOUR project, then:\ngcloud projects add-iam-policy-binding YOUR-PROJECT \\\n  --member="serviceAccount:ledger-reader@ledger.iam.gserviceaccount.com" \\\n  --role="roles/bigquery.dataViewer"   # on the billing dataset only\ngcloud projects add-iam-policy-binding YOUR-PROJECT \\\n  --member="serviceAccount:ledger-reader@ledger.iam.gserviceaccount.com" \\\n  --role="roles/bigquery.jobUser"\n# Prefer Workload Identity Federation over keys. History starts when the export is enabled — GCP exports are not retroactive.`,
    perms: [["BigQuery Data Viewer (dataset)", "Read detailed + pricing billing export"], ["BigQuery Job User (or extract to Cloud Storage)", "Run export queries without charging the customer"], ["Monitoring Viewer (optional)", "Utilisation only"], ["Billing Viewer + Recommender Viewer", "Invoice context + provider recommendations"]] },
};
const STEPS = ["Choose provider", "Generate IaC", "Apply in your cloud", "Test connection", "First export / backfill"];
export default function Connections() {
  const [live, setLive] = useState<{ source: string; providers: { provider: string; configured: boolean; missing: string[] }[] } | null>(null);
  useEffect(() => { fetch("/api/source").then((r) => r.json()).then((j) => setLive(j.data)).catch(() => undefined); }, []);
  const [provider, setProvider] = useState<keyof typeof SNIPPETS>("AWS");
  const [step, setStep] = useState(0);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const s = SNIPPETS[provider];
  const toggle = (p: string) => setChecks({ ...checks, [`${provider}:${p}`]: !checks[`${provider}:${p}`] });
  const done = s.perms.filter(([p]) => checks[`${provider}:${p}`]).length;
  return (
    <div>
      <h1>Connections</h1>
      <p className="muted">Read-only connections. Every permission is shown with its reason; Test connection checks each permission individually and names the exact fix for any missing one. To add, edit, pause, test or remove accounts day to day, go to <Link href="/settings">Settings › Connected accounts</Link> — this page is the onboarding wizard (IaC + permission reasons).</p>
      {live?.source === "live" && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2>Live configuration (from env presence only — values are never shown)</h2>
          <ul>{live.providers.map((p) => (
            <li key={p.provider}><strong>{p.provider}</strong>: {p.configured ? "Configured ✓" : <>Not connected — missing env: {p.missing.join(", ")} (no fake numbers are shown for this provider in live mode)</>}</li>
          ))}</ul>
          <p className="caption">Full setup: docs/REAL_ACCOUNTS.md. The demo connection cards below are the demo dataset, not live connections.</p>
        </section>
      )}
      <div className="grid grid-3" style={{ marginBottom: 16 }}>{CONNECTIONS.map((c) => <ConnectionCard key={c.id} c={c} />)}</div>
      <section className="card">
        <h2>Onboarding wizard</h2>
        <ol style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 0, listStyle: "none" }}>{STEPS.map((st, i) => <li key={st} style={{ fontWeight: i === step ? 700 : 400 }}>{i + 1}. {st}{i < STEPS.length - 1 ? " →" : ""}</li>)}</ol>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
          {(Object.keys(SNIPPETS) as (keyof typeof SNIPPETS)[]).map((p) => <button key={p} className={provider === p ? "btn" : "btn-ghost"} onClick={() => { setProvider(p); setStep(1); }}>{p}</button>)}
        </div>
        <h3>{s.title}</h3>
        <pre style={{ background: "var(--bg-sunken)", padding: 16, borderRadius: "var(--radius-8)", overflowX: "auto", fontSize: 12 }}>{s.code}</pre>
        <p className="caption">AWS: activate user-defined cost-allocation tags before they appear in cost data. A unique ExternalId is generated per connection and never reused (confused-deputy defence). GCP: exports are not retroactive — history starts on enablement.</p>
        <h3>Test connection — permission checklist ({done}/{s.perms.length} passing)</h3>
        <ul>{s.perms.map(([p, reason]) => (
          <li key={p}><label><input type="checkbox" checked={!!checks[`${provider}:${p}`]} onChange={() => toggle(p)} /> <strong>{p}</strong> — {reason} {!checks[`${provider}:${p}`] && <span className="muted">(if missing: re-apply the snippet above for this permission only)</span>}</label></li>))}
        </ul>
        <div style={{ display: "flex", gap: 8 }}><button className="btn-ghost" onClick={() => setStep(Math.max(0, step - 1))}>Back</button><button className="btn" onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}>{done === s.perms.length ? "All checks pass — Continue" : "Continue (checks pending)"}</button></div>
        <p className="small muted" style={{ marginTop: 12 }}>States: Pending → Validating → Awaiting first export → Backfilling → Healthy; Degraded / Broken / Revoked on failure. Revoking a role flips the connection to Broken within one health-check interval and raises an alert.</p>
      </section>
    </div>
  );
}
