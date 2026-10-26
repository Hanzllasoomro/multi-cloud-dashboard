"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { ROLE_MATRIX, ROLES as ALL_ROLES } from "../../lib/permissions";

const ROLES = ROLE_MATRIX.map((r) => ({
  role: r.role, plan: r.plan, members: r.members, connections: r.connections, data: r.data,
  budgets: r.budgets, allocation: r.allocation, exports: r.exports, api: r.api, audit: r.audit,
}));
const LEGACY_AUDIT = [
  { when: "2026-10-26 09:12", who: "finops@acme.example", what: "Budget created: Total cloud spend" },
  { when: "2026-10-25 17:40", who: "admin@acme.example", what: "Connection health check: Azure → Degraded" },
  { when: "2026-10-24 11:03", who: "analyst@acme.example", what: "Explorer export (CSV, 11 groups)" },
];
type Account = {
  id: string; provider: string; displayName: string; accountId: string; billingAccount: string;
  scope: { providers: string[]; accounts: string[]; tags: string[]; teams: string[] };
  status: string; lastSync: string; nextSync: string; mode: string; createdBy: string; createdAt: string;
};
type Checklist = { permission: string; reason: string; status: string; fix?: string };
const toneFor = (s: string): "success" | "warning" | "danger" | "info" | "neutral" =>
  s === "Healthy" ? "success" : s === "Degraded" ? "warning" : s === "Broken" ? "danger" : s === "Paused" ? "neutral" : "info";
const EMPTY_FORM = { provider: "AWS", displayName: "", accountId: "", billingAccount: "", scopeAccounts: "", scopeTags: "", scopeTeams: "" };

export default function Settings() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [audit, setAudit] = useState<{ when: string; who: string; what: string }[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [testResult, setTestResult] = useState<{ name: string; passed: number; total: number; mode: string; checklist: Checklist[] } | null>(null);
  const [removing, setRemoving] = useState<Account | null>(null);
  const [me, setMe] = useState<{ id: string; email: string; name: string; role: string } | null>(null);
  const [users, setUsers] = useState<{ id: string; email: string; name: string; role: string; createdAt: string }[]>([]);
  const [usersNote, setUsersNote] = useState("");
  const canManageAccounts = !!me && ["Owner", "Admin", "FinOps Manager"].includes(me.role);
  const canManageMembers = !!me && ["Owner", "Admin"].includes(me.role);
  const [confirmText, setConfirmText] = useState("");
  const [dataChoice, setDataChoice] = useState<"keep" | "purge">("keep");

  const refresh = useCallback(async () => {
    try {
      const [a, u, m] = await Promise.all([
        fetch("/api/accounts").then((r) => r.json()),
        fetch("/api/accounts/audit").then((r) => r.json()).catch(() => ({})),
        fetch("/api/auth/me").then((r) => r.json()).catch(() => ({})),
      ]);
      setAccounts(a.data || []);
      setAudit([...(u.data || []), ...LEGACY_AUDIT]);
      if (m.data) setMe(m.data);
    } catch { /* keep previous state; table shows empty-state note below */ }
    try {
      const r = await fetch("/api/users");
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setUsers(j.data || []); setUsersNote(""); }
      else setUsersNote("Team members are visible to Owner and Admin only.");
    } catch { setUsersNote("Team members are visible to Owner and Admin only."); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function call(path: string, init: RequestInit, okMsg: string) {
    setErr(""); setMsg("");
    const r = await fetch(path, init);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || "Request failed"); return null; }
    setMsg(okMsg);
    await refresh();
    return j;
  }
  function scopeBody() {
    return { scope: { accounts: form.scopeAccounts, tags: form.scopeTags, teams: form.scopeTeams } };
  }
  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const j = await call("/api/accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: form.provider, displayName: form.displayName, accountId: form.accountId, billingAccount: form.billingAccount, ...scopeBody() }),
    }, "Account added (Pending — run Test connection to validate it).");
    if (j) setForm(EMPTY_FORM);
  }
  function startEdit(a: Account) {
    setEditing(a.id);
    setForm({ provider: a.provider, displayName: a.displayName, accountId: a.accountId, billingAccount: a.billingAccount,
      scopeAccounts: a.scope.accounts.join(", "), scopeTags: a.scope.tags.join(", "), scopeTeams: a.scope.teams.join(", ") });
  }
  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const j = await call(`/api/accounts/${editing}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: form.displayName, ...scopeBody() }),
    }, "Account updated.");
    if (j) { setEditing(null); setForm(EMPTY_FORM); }
  }
  async function togglePause(a: Account) {
    await call(`/api/accounts/${a.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: a.status === "Paused" ? "Healthy" : "Paused" }),
    }, a.status === "Paused" ? "Account resumed (pre-pause status restored)." : "Account paused — its rows are now excluded from /api/query totals.");
  }
  async function test(a: Account) {
    const j = await call(`/api/accounts/${a.id}/test`, { method: "POST" }, "Test connection complete — checklist below.");
    if (j) setTestResult({ name: a.displayName, passed: j.data.passed, total: j.data.total, mode: j.data.mode, checklist: j.data.checklist });
  }
  async function doRemove() {
    if (!removing) return;
    const j = await call(`/api/accounts/${removing.id}?confirm=${encodeURIComponent(confirmText)}&data=${dataChoice}`, { method: "DELETE" },
      `Account removed (data: ${dataChoice}).`);
    if (j) { setRemoving(null); setConfirmText(""); }
  }
  async function changeRole(id: string, role: string) {
    setErr(""); setMsg("");
    const r = await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || "Role change failed"); return; }
    setMsg("Role updated.");
    await refresh();
  }
  const pausedBroken = accounts.filter((a) => a.status === "Paused" || a.status === "Broken");

  return (
    <div>
      <h1>Settings</h1>
      <p className="muted">Organisation, members and roles, API keys, webhooks, integrations, plan and billing, audit log. Scopes are injected as mandatory filters in the query layer, never only hidden in the UI.</p>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Connected accounts</h2>
        <p className="small">
          Add, edit, pause, test and remove cloud accounts here. <Link href="/connections">Connections</Link> is the onboarding wizard (IaC + permission reasons);
          this section is where accounts are managed day to day. Paused accounts are excluded from <code>/api/query</code> totals.
          {pausedBroken.length > 0 && <> ⚠ Paused / broken: {pausedBroken.map((a) => a.displayName).join(", ")}.</>}
        </p>
        <p className="caption">
          <strong>Store note:</strong> accounts are kept in an in-memory server store in this version — it resets on server restart.
          A database replaces this one module later. <strong>No credentials are ever stored here:</strong> live-mode credentials stay in
          server environment variables only (see docs/REAL_ACCOUNTS.md), so this form has no secret fields at all.
        </p>
        {err && <p role="alert" style={{ color: "var(--status-danger-text)" }}>{err}</p>}
        {msg && <p role="status" style={{ color: "var(--status-success-text)" }}>{msg}</p>}
        {accounts.length === 0 ? <p className="small">No accounts loaded yet — the API may still be starting. Reload the page if this persists.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-default)" }}>
              <th>Provider</th><th>Name</th><th>Identifier</th><th>Scope</th><th>Status</th><th>Last sync</th><th>Mode</th><th>Actions</th>
            </tr></thead>
            <tbody>{accounts.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid var(--border-default)", verticalAlign: "top" }}>
                <td>{a.provider}</td>
                <td><strong>{a.displayName}</strong></td>
                <td><code>{a.accountId}</code><br /><span className="caption">billing: {a.billingAccount}</span></td>
                <td><span className="caption">accounts: {a.scope.accounts.join(", ") || "—"}<br />tags: {a.scope.tags.join(", ") || "—"}<br />teams: {a.scope.teams.join(", ") || "—"}</span></td>
                <td><Badge tone={toneFor(a.status)}>{a.status}</Badge></td>
                <td>{a.lastSync}</td>
                <td>{a.mode}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {canManageAccounts ? (<>
                    <button className="btn-ghost" onClick={() => startEdit(a)}>Edit</button>{" "}
                    <button className="btn-ghost" onClick={() => togglePause(a)}>{a.status === "Paused" ? "Resume" : "Pause"}</button>{" "}
                    <button className="btn-ghost" onClick={() => test(a)}>Test</button>{" "}
                    <button className="btn-ghost" onClick={() => { setRemoving(a); setConfirmText(""); }}>Remove</button>
                  </>) : (<span className="caption">Read-only for your role</span>)}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {testResult && (
          <section aria-label="Test connection result" style={{ marginTop: 16, border: "1px solid var(--border-default)", borderRadius: "var(--radius-8)", padding: 12 }}>
            <h3>Test connection — {testResult.name} ({testResult.passed}/{testResult.total} passed, {testResult.mode} mode{testResult.mode === "demo" ? ", simulated checklist" : ", env-presence check"})</h3>
            <ul>{testResult.checklist.map((c) => (
              <li key={c.permission}>{c.status === "pass" ? "✓" : "✗"} <strong>{c.permission}</strong> — {c.reason}{c.fix && <> — <em>Fix: {c.fix}</em></>}</li>
            ))}</ul>
          </section>
        )}
        {removing && (
          <section aria-label="Remove account confirmation" style={{ marginTop: 16, border: "1px solid var(--status-danger-text)", borderRadius: "var(--radius-8)", padding: 12 }}>
            <h3>Remove {removing.displayName}?</h3>
            <p className="small">Type the account display name exactly to confirm. This cannot be undone from this screen (the account can be re-added).</p>
            <label className="small">Type “{removing.displayName}” <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} /></label>
            <div style={{ margin: "8px 0" }}>
              <label className="small"><input type="radio" checked={dataChoice === "keep"} onChange={() => setDataChoice("keep")} /> Keep historical data</label>{" "}
              <label className="small"><input type="radio" checked={dataChoice === "purge"} onChange={() => setDataChoice("purge")} /> Purge data</label>
            </div>
            <p className="caption">Purge note: demo rows are a shared synthetic dataset, so a purge is recorded in the audit log but does not delete other accounts’ demo rows; in production a purge job deletes this account’s rows.</p>
            <button className="btn" disabled={confirmText !== removing.displayName} onClick={doRemove}>Remove account</button>{" "}
            <button className="btn-ghost" onClick={() => setRemoving(null)}>Cancel</button>
          </section>
        )}
        {canManageAccounts ? (<>
        <h3 style={{ marginTop: 24 }}>{editing ? "Edit account (name + scope; provider and identifier cannot change)" : "Add account"}</h3>
        <form onSubmit={editing ? submitEdit : submitAdd} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <label className="small">Provider <select className="select" value={form.provider} disabled={!!editing} onChange={(e) => setForm({ ...form, provider: e.target.value })}><option>AWS</option><option>Azure</option><option>GCP</option></select></label>
          <label className="small">Display name * <input className="input" required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="e.g. AWS production" /></label>
          <label className="small">Account identifier * <input className="input" required disabled={!!editing} value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} placeholder="AWS account / Azure subscription / GCP project" /></label>
          <label className="small">Billing account * <input className="input" required disabled={!!editing} value={form.billingAccount} onChange={(e) => setForm({ ...form, billingAccount: e.target.value })} /></label>
          <label className="small">Scope: sub-accounts (comma-separated) <input className="input" value={form.scopeAccounts} onChange={(e) => setForm({ ...form, scopeAccounts: e.target.value })} placeholder="prod-aws, staging-aws" /></label>
          <label className="small">Scope: tags <input className="input" value={form.scopeTags} onChange={(e) => setForm({ ...form, scopeTags: e.target.value })} placeholder="team:platform" /></label>
          <label className="small">Scope: teams <input className="input" value={form.scopeTeams} onChange={(e) => setForm({ ...form, scopeTeams: e.target.value })} placeholder="platform" /></label>
          <button className="btn" type="submit">{editing ? "Save changes" : "Add account"}</button>
          {editing && <button className="btn-ghost" type="button" onClick={() => { setEditing(null); setForm(EMPTY_FORM); }}>Cancel edit</button>}
        </form>
        <p className="caption">No secret fields: for live mode, credentials are set as server environment variables only (docs/REAL_ACCOUNTS.md). New accounts start Pending — run Test connection to validate them. Scope sub-accounts are the names that appear in cost rows (demo: prod-aws, staging-aws, prod-azure-sub, prod-gcp-project); pausing an account excludes exactly those rows from query totals.</p>
        </>) : (<p className="caption">Account management (add, edit, pause, test, remove) requires Owner, Admin, or FinOps Manager. Your role ({me?.role || "unknown"}) can view accounts read-only.</p>)}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Team members</h2>
        <p className="small">
          Registered users. The first registered user is the Owner; later registrations start as Viewers.
          {canManageMembers ? " Change a role below — demoting the last Owner is blocked by the API." : " Role changes are for Owner and Admin only."}
        </p>
        {usersNote && <p className="caption">{usersNote}</p>}
        {users.length === 0 ? <p className="small">No team members listed.</p> : (
          <DataTable columns={[
            { key: "n", header: "Name", render: (r) => r.name },
            { key: "e", header: "Email", render: (r) => r.email },
            { key: "r", header: "Role", render: (r) => canManageMembers ? (
              <select className="select" value={r.role} onChange={(e) => changeRole(r.id, e.target.value)} aria-label={`Role for ${r.email}`}>
                {ALL_ROLES.map((role) => <option key={role}>{role}</option>)}
              </select>
            ) : r.role },
            { key: "c", header: "Created", render: (r) => r.createdAt },
          ]} rows={users} />
        )}
        <p className="caption">Password reset is via an admin until email reset exists (see docs/SECURITY.md). Demo accounts (LEDGER_DEMO_AUTH) are always Viewers.</p>
      </section>

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
        <p className="caption">Account actions (add, edit, pause, resume, test, remove) appear here first, newest first, followed by earlier demo entries.</p>
        <DataTable columns={[
          { key: "w", header: "When", render: (r) => r.when },
          { key: "who", header: "Who", render: (r) => r.who },
          { key: "what", header: "What", render: (r) => r.what },
        ]} rows={audit} />
      </section>
    </div>
  );
}
