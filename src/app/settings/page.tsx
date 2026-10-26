"use client";
import DataTable from "../../components/DataTable";
const ROLES = [
  { role: "Owner", plan: "✓", members: "✓", connections: "✓", data: "✓", budgets: "✓", allocation: "✓", exports: "✓", api: "✓", audit: "✓" },
  { role: "Admin", plan: "—", members: "✓", connections: "✓", data: "✓", budgets: "✓", allocation: "✓", exports: "✓", api: "✓", audit: "✓" },
  { role: "FinOps Manager", plan: "—", members: "—", connections: "✓", data: "✓", budgets: "✓", allocation: "✓", exports: "✓", api: "✓", audit: "—" },
  { role: "Analyst", plan: "—", members: "—", connections: "—", data: "✓", budgets: "✓", allocation: "—", exports: "✓", api: "—", audit: "—" },
  { role: "Viewer", plan: "—", members: "—", connections: "—", data: "Scoped", budgets: "Own", allocation: "—", exports: "Scoped", api: "—", audit: "—" },
  { role: "Auditor", plan: "—", members: "—", connections: "—", data: "✓", budgets: "—", allocation: "—", exports: "✓", api: "—", audit: "✓" },
];
const AUDIT = [
  { when: "2026-10-26 09:12", who: "finops@acme.example", what: "Budget created: Total cloud spend", from: "—" },
  { when: "2026-10-25 17:40", who: "admin@acme.example", what: "Connection health check: Azure → Degraded", from: "—" },
  { when: "2026-10-24 11:03", who: "analyst@acme.example", what: "Explorer export (CSV, 11 groups)", from: "—" },
];
export default function Settings() {
  return (
    <div>
      <h1>Settings</h1>
      <p className="muted">Organisation, members and roles, API keys, webhooks, integrations, plan and billing, audit log. Scopes are injected as mandatory filters in the query layer, never only hidden in the UI.</p>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Roles matrix</h2>
        <DataTable columns={[
          { key: "r", header: "Role", render: (r) => r.role },
          { key: "pl", header: "Plan & payment", render: (r) => r.plan },
          { key: "me", header: "Members / SSO", render: (r) => r.members },
          { key: "co", header: "Connections", render: (r) => r.connections },
          { key: "da", header: "All cost data", render: (r) => r.data },
          { key: "bu", header: "Budgets", render: (r) => r.budgets },
          { key: "al", header: "Allocation", render: (r) => r.allocation },
          { key: "ex", header: "Exports", render: (r) => r.exports },
          { key: "api", header: "API keys", render: (r) => r.api },
          { key: "au", header: "Audit log", render: (r) => r.audit },
        ]} rows={ROLES} />
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>API keys</h2>
        <p className="small">Keys are stored <strong>hashed</strong> (never returned after creation), with scopes, last-used tracking, expiry and rotation. Example (demo, not a real key): <code>lk_live_••••••••4f2a</code> — FinOps scope, last used Oct 25, 2026, expires Jan 2027.</p>
        <p className="caption">SSO/SCIM: buy via WorkOS/Auth0/Clerk/Keycloak; the authorisation model itself is owned by Ledger. MFA: TOTP + WebAuthn. Sessions: httpOnly cookies, rotating refresh, CSRF protection.</p>
      </section>
      <section className="card">
        <h2>Audit log (append-only, exportable)</h2>
        <DataTable columns={[
          { key: "w", header: "When", render: (r) => r.when },
          { key: "who", header: "Who", render: (r) => r.who },
          { key: "what", header: "What", render: (r) => r.what },
        ]} rows={AUDIT} />
      </section>
    </div>
  );
}
