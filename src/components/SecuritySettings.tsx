"use client";
import { useCallback, useEffect, useState } from "react";
import DataTable from "./DataTable";

// Settings → Security: MFA, sessions, API keys and the auth audit log.
// All data comes from the v1.6 auth backend; nothing here is descriptive
// placeholder copy. Secrets and full keys are shown once, at creation,
// and never fetched again.
export default function SecuritySettings() {
  const [mfa, setMfa] = useState<{ enabled: boolean; backupCodesRemaining: number; pendingSetup: boolean } | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [sessions, setSessions] = useState<{ tokenPrefix: string; createdAt: number; expiresAt: number; lastSeen: number; userAgent?: string; ip?: string; current: boolean }[]>([]);
  const [keys, setKeys] = useState<{ id: string; name: string; prefix: string; createdAt: string; lastUsedAt?: string; revokedAt?: string }[]>([]);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [audit, setAudit] = useState<{ id: string; at: string; email?: string; event: string; detail?: string }[]>([]);
  const [auditNote, setAuditNote] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [m, s, k, a] = await Promise.all([
        fetch("/api/auth/mfa/status").then((r) => r.json()).catch(() => ({})),
        fetch("/api/auth/sessions").then((r) => r.json()).catch(() => ({})),
        fetch("/api/auth/api-keys").then((r) => r.json()).catch(() => ({})),
        fetch("/api/auth/audit").then((r) => r.json()).catch(() => ({})),
      ]);
      if (m.data) setMfa(m.data);
      if (s.data) setSessions(s.data);
      if (k.data) setKeys(k.data);
      if (Array.isArray(a.data)) { setAudit(a.data); setAuditNote(""); }
      else setAuditNote("Auth audit is visible to Owner, Admin and Auditor only.");
    } catch { /* sections show empty state */ }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function post(path: string, body: unknown) {
    setErr(""); setMsg("");
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || "Request failed"); return null; }
    return j;
  }
  async function startSetup() {
    const j = await post("/api/auth/mfa/setup", {});
    if (j) setSetup(j.data);
  }
  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    const j = await post("/api/auth/mfa/verify", { code });
    if (j) { setBackupCodes(j.data.backupCodes || []); setSetup(null); setCode(""); setMsg("MFA enabled — save your backup codes somewhere safe. They will never be shown again."); await refresh(); }
  }
  async function disableMfa(e: React.FormEvent) {
    e.preventDefault();
    const j = await post("/api/auth/mfa/disable", { password });
    if (j) { setPassword(""); setMsg("MFA disabled."); await refresh(); }
  }
  async function revokeOthers() {
    const j = await post("/api/auth/sessions/revoke-others", {});
    if (j) { setMsg(`Signed out ${j.data.revoked} other session(s).`); await refresh(); }
  }
  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    const j = await post("/api/auth/api-keys", { name: keyName });
    if (j) { setNewKey(j.data.key); setKeyName(""); setMsg("API key created — copy it now. It will never be shown again."); await refresh(); }
  }
  async function revokeKey(id: string) {
    setErr(""); setMsg("");
    const r = await fetch(`/api/auth/api-keys/${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || "Revoke failed"); return; }
    setMsg("API key revoked — it stops working immediately.");
    await refresh();
  }
  const fmt = (ms: number) => new Date(ms).toLocaleString();

  return (
    <div>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Two-factor authentication (TOTP)</h2>
        <p className="small">Status: <strong>{mfa ? (mfa.enabled ? `Enabled — ${mfa.backupCodesRemaining} backup code(s) remaining` : mfa.pendingSetup ? "Setup started — enter a code to finish" : "Off") : "Loading…"}</strong></p>
        {backupCodes.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p className="small"><strong>Backup codes — save these now:</strong></p>
            <p className="small">{backupCodes.join("  ·  ")}</p>
          </div>
        )}
        {!mfa?.enabled && !setup && <button className="btn" type="button" onClick={startSetup}>Set up authenticator app</button>}
        {setup && (
          <form onSubmit={confirmSetup} style={{ marginTop: 12 }}>
            <p className="small">Add this secret to your authenticator app (Google/Microsoft Authenticator, 1Password, …):</p>
            <p className="small"><code style={{ wordBreak: "break-all" }}>{setup.secret}</code></p>
            <p className="caption">Or open this URL: <code style={{ wordBreak: "break-all" }}>{setup.otpauthUrl}</code></p>
            <label className="small">6-digit code from the app <input className="input" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" /></label>{" "}
            <button className="btn" type="submit">Verify and enable</button>
          </form>
        )}
        {mfa?.enabled && (
          <form onSubmit={disableMfa} style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <label className="small">Password (to disable MFA) <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="btn-ghost" type="submit">Disable MFA</button>
          </form>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Sessions</h2>
        {sessions.length === 0 ? <p className="small">No sessions listed.</p> : (
          <DataTable columns={[
            { key: "c", header: "Created", render: (r) => fmt(r.createdAt) },
            { key: "l", header: "Last seen", render: (r) => fmt(r.lastSeen) },
            { key: "a", header: "Device / IP", render: (r) => `${(r.userAgent || "").slice(0, 48) || "—"} · ${r.ip || "—"}` },
            { key: "s", header: "Status", render: (r) => r.current ? "This session" : `Token ${r.tokenPrefix}…` },
          ]} rows={sessions} />
        )}
        <button className="btn-ghost" type="button" onClick={revokeOthers}>Sign out everywhere else</button>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>API keys</h2>
        {newKey && <p className="small"><strong>Your new key (shown once):</strong> <code style={{ wordBreak: "break-all" }}>{newKey}</code></p>}
        <form onSubmit={createKey} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <label className="small">Key name <input className="input" required value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. reporting script" /></label>
          <button className="btn" type="submit">Create API key</button>
        </form>
        {keys.length === 0 ? <p className="small" style={{ marginTop: 12 }}>No API keys yet.</p> : (
          <div style={{ marginTop: 12 }}>
            <DataTable columns={[
              { key: "n", header: "Name", render: (r) => r.name },
              { key: "p", header: "Prefix", render: (r) => `${r.prefix}…` },
              { key: "u", header: "Last used", render: (r) => r.lastUsedAt || "Never" },
              { key: "r", header: "Status", render: (r) => r.revokedAt ? "Revoked" : "Active" },
              { key: "x", header: "", render: (r) => !r.revokedAt ? <button className="btn-ghost" style={{ padding: "2px 8px" }} onClick={() => revokeKey(r.id)}>Revoke</button> : "" },
            ]} rows={keys} />
          </div>
        )}
        <p className="caption">Use a key with <code>Authorization: Bearer lk_…</code> or <code>X-Ledger-Api-Key</code>. Keys inherit your role at use time; revoking stops them immediately. Only hashes are stored.</p>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Auth audit log</h2>
        {auditNote && <p className="caption">{auditNote}</p>}
        {audit.length === 0 && !auditNote ? <p className="small">No auth events yet.</p> : audit.length > 0 && (
          <DataTable columns={[
            { key: "a", header: "When", render: (r) => new Date(r.at).toLocaleString() },
            { key: "e", header: "Event", render: (r) => r.event },
            { key: "w", header: "Who", render: (r) => r.email || "—" },
            { key: "d", header: "Detail", render: (r) => r.detail || "" },
          ]} rows={audit.slice(0, 30)} />
        )}
      </section>
      {msg && <p role="status" style={{ color: "var(--status-success-text)" }}>{msg}</p>}
      {err && <p role="alert" style={{ color: "var(--status-danger-text)" }}>{err}</p>}
    </div>
  );
}
