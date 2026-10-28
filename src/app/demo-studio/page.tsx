"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { allRows, monthCost } from "../../lib/data";
import { fmtMoneyFull } from "../../lib/format";
import {
  cleanScenario, defaultScenario, applyScenario, presetScenario, scenarioSummary,
  DEMO_ACCOUNTS, DEMO_PROVIDERS, DEMO_SERVICES, type DemoScenario, type ExtraDemoAccount,
} from "../../lib/demo-scenario";

const num = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 1;
};
export default function DemoStudio() {
  const baseRows = useMemo(() => allRows(), []);
  const [draft, setDraft] = useState<DemoScenario>(defaultScenario());
  const [me, setMe] = useState<{ role: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [extraForm, setExtraForm] = useState({ provider: "AWS" as ExtraDemoAccount["provider"], subAccount: "", service: "", monthlyBase: "5000" });
  const canEdit = !!me && ["Owner", "Admin", "FinOps Manager"].includes(me.role);

  const refresh = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        fetch("/api/demo-scenario").then((r) => r.json()).catch(() => ({})),
        fetch("/api/auth/me").then((r) => r.json()).catch(() => ({})),
      ]);
      if (s.data) setDraft(cleanScenario(s.data));
      if (m.data) setMe(m.data);
    } catch { /* keep draft; page shows the note below */ }
    setLoaded(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const originalTotal = useMemo(() => baseRows.reduce((a, r) => a + r.billedCost, 0), [baseRows]);
  const originalMtd = useMemo(() => monthCost(baseRows, "2026-10"), [baseRows]);
  // Preview always shows the draft's effect (as if Active were on), so the
  // presenter can judge a preset before saving it.
  const previewRows = useMemo(() => applyScenario(baseRows, { ...draft, active: true }), [baseRows, draft]);
  const previewTotal = useMemo(() => previewRows.reduce((a, r) => a + r.billedCost, 0), [previewRows]);
  const previewMtd = useMemo(() => monthCost(previewRows, "2026-10"), [previewRows]);
  const deltaPct = originalTotal ? ((previewTotal - originalTotal) / originalTotal) * 100 : 0;

  async function save(next: DemoScenario, okMsg: string) {
    setErr(""); setMsg("");
    const r = await fetch("/api/demo-scenario", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || "Save failed"); return; }
    setDraft(cleanScenario(j.data));
    setMsg(okMsg);
  }
  async function reset() {
    setErr(""); setMsg("");
    const r = await fetch("/api/demo-scenario", { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || "Reset failed"); return; }
    setDraft(cleanScenario(j.data));
    setMsg("Reset to the original seeded demo. Reload any open dashboard tab to see it.");
  }
  function setMult(kind: "provider" | "account" | "service", key: string, value: number) {
    setDraft((d) => {
      const next = { ...d };
      if (kind === "provider") next.providerMultipliers = { ...d.providerMultipliers, [key]: value };
      if (kind === "account") next.accountMultipliers = { ...d.accountMultipliers, [key]: value };
      if (kind === "service") next.serviceMultipliers = { ...d.serviceMultipliers, [key]: value };
      return next;
    });
  }
  function addExtra(e: React.FormEvent) {
    e.preventDefault();
    if (!extraForm.subAccount.trim() || !extraForm.service.trim()) { setErr("Extra account needs a sub-account name and a service."); return; }
    if (draft.extraAccounts.some((x) => x.subAccount === extraForm.subAccount.trim())) { setErr("That sub-account name is already used by an extra account."); return; }
    setDraft((d) => ({ ...d, extraAccounts: [...d.extraAccounts, { id: `extra-${Date.now().toString(36)}`, provider: extraForm.provider, subAccount: extraForm.subAccount.trim(), service: extraForm.service.trim(), monthlyBase: num(extraForm.monthlyBase) }] }));
    setExtraForm({ provider: "AWS", subAccount: "", service: "", monthlyBase: "5000" });
    setErr("");
  }
  const multInput = (label: string, value: number | undefined, onChange: (n: number) => void) => (
    <label className="small" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 150 }}>
      {label}
      <input className="input" type="number" min={0} max={10} step={0.1} value={value ?? 1} onChange={(e) => onChange(num(e.target.value))} />
    </label>
  );
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Demo Studio</h1>
          <p className="muted" style={{ margin: 0 }}>Change the demo story, save, reload the dashboard — and it looks like a different company&apos;s bill. External control panel for the demo data only.</p>
        </div>
        <div className="page-actions">
          <Link href="/" className="btn">Open Overview →</Link>
          <Link href="/demo" className="btn-ghost">Walkthrough</Link>
        </div>
      </div>

      <section className="banner" style={{ background: "var(--status-warning-bg)" }}>
        <span className="small"><strong>Demo data only — read this before presenting.</strong> This panel never touches live provider data: saving is blocked while the server is in live mode, and the Demo banner stays on every page while a scenario is active. In your presentation, call it a demo scenario, not live billing. Recommendation and commitment lists are static demo lists and are not scaled by a scenario, so they will not move with these multipliers.</span>
      </section>

      {!loaded && <p className="muted">Loading current scenario…</p>}
      {err && <p role="alert" style={{ color: "var(--status-danger-text)" }}>{err}</p>}
      {msg && <p role="status" style={{ color: "var(--status-success-text)" }}>{msg}</p>}
      {!canEdit && loaded && <p className="small">Editing needs Owner, Admin, or FinOps Manager. Your role ({me?.role || "unknown"}) can view the current scenario read-only below.</p>}

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Live preview (before you save)</h2>
        <p>
          Original 12-month total <strong>{fmtMoneyFull(originalTotal)}</strong> · Oct 2026 <strong>{fmtMoneyFull(originalMtd)}</strong>
          <br />
          With this draft applied: <strong>{fmtMoneyFull(previewTotal)}</strong> · Oct 2026 <strong>{fmtMoneyFull(previewMtd)}</strong> {draft.active ? "(this draft is the saved active scenario)" : "(preview only — save with Active on to apply it)"}
          {" "}({deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}% vs original)
        </p>
        <p className="caption">Preview scales cost and usage together from the same seeded rows the dashboards use, so totals, charts, budgets, forecasts and anomalies move together. Current saved scenario: {scenarioSummary(draft)}{draft.updatedAt ? ` · updated ${draft.updatedAt}` : ""}.</p>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Scenario</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
          <label className="small" style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 220 }}>
            Scenario name (shown on Overview while active)
            <input className="input" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </label>
          <label className="small"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active — apply on save</label>
          {multInput("Multiply everything by", draft.globalMultiplier, (n) => setDraft({ ...draft, globalMultiplier: n }))}
        </div>
        <p className="caption">0 = that slice becomes $0 (useful to simulate an account/service disappearing). Multipliers combine: global × provider × account × service. Range 0–10.</p>
        <h3 style={{ marginTop: 20 }}>Presets (one click, then Save)</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-ghost" disabled={!canEdit} onClick={() => setDraft(presetScenario("original"))}>Original seeded demo</button>
          <button className="btn-ghost" disabled={!canEdit} onClick={() => setDraft(presetScenario("growth"))}>Growth story (×1.4)</button>
          <button className="btn-ghost" disabled={!canEdit} onClick={() => setDraft(presetScenario("spike"))}>EC2 spike story (EC2 ×2)</button>
          <button className="btn-ghost" disabled={!canEdit} onClick={() => setDraft(presetScenario("savings"))}>Savings story (×0.7)</button>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Per provider</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {DEMO_PROVIDERS.map((p) => multInput(p, draft.providerMultipliers[p], (n) => setMult("provider", p, n)))}
        </div>
        <h2 style={{ marginTop: 20 }}>Per fake account (sub-account)</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {DEMO_ACCOUNTS.map((a) => multInput(`${a.subAccount} (${a.provider})`, draft.accountMultipliers[a.subAccount], (n) => setMult("account", a.subAccount, n)))}
        </div>
        <p className="caption">These are the demo sub-accounts in the seeded rows. Renaming a real managed account is still done in Settings › Connected accounts; this panel only scales its spend.</p>
        <h2 style={{ marginTop: 20 }}>Per service</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {DEMO_SERVICES.map((s) => multInput(`${s.service} (${s.provider})`, draft.serviceMultipliers[s.service], (n) => setMult("service", s.service, n)))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Extra demo accounts (appear in Top accounts, provider split, totals)</h2>
        {draft.extraAccounts.length === 0 ? <p className="small">None yet. Add one below — it gets a full 12 months of daily demo rows at roughly its monthly base, so it shows up everywhere scaled rows do.</p> : (
          <ul>{draft.extraAccounts.map((x) => (
            <li key={x.id} className="small">{x.provider} · <strong>{x.subAccount}</strong> · {x.service} · {fmtMoneyFull(x.monthlyBase)}/month{" "}
              <button className="btn-ghost" style={{ padding: "2px 8px" }} disabled={!canEdit} onClick={() => setDraft({ ...draft, extraAccounts: draft.extraAccounts.filter((e) => e.id !== x.id) })}>Remove</button>
            </li>
          ))}</ul>
        )}
        <form onSubmit={addExtra} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <label className="small">Provider <select className="select" value={extraForm.provider} onChange={(e) => setExtraForm({ ...extraForm, provider: e.target.value as ExtraDemoAccount["provider"] })}><option>AWS</option><option>Azure</option><option>GCP</option></select></label>
          <label className="small">Sub-account name * <input className="input" required value={extraForm.subAccount} onChange={(e) => setExtraForm({ ...extraForm, subAccount: e.target.value })} placeholder="e.g. demo-acme-eu" /></label>
          <label className="small">Service * <input className="input" required value={extraForm.service} onChange={(e) => setExtraForm({ ...extraForm, service: e.target.value })} placeholder="e.g. Demo Compute" /></label>
          <label className="small">Monthly base ($) * <input className="input" type="number" min={0} max={1000000} required value={extraForm.monthlyBase} onChange={(e) => setExtraForm({ ...extraForm, monthlyBase: e.target.value })} /></label>
          <button className="btn" type="submit" disabled={!canEdit}>Add to draft</button>
        </form>
        <p className="caption">An extra account is demo-only and lives in the scenario file. Pausing a managed account in Settings whose scope covers its sub-account name will still exclude it from /api/query totals.</p>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Save, use, reset</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" disabled={!canEdit} onClick={() => save({ ...draft, active: true }, "Scenario saved and active. Reload any open dashboard tab to see it.")}>Save &amp; activate</button>
          <button className="btn-ghost" disabled={!canEdit} onClick={() => save(draft, "Scenario saved.")}>Save draft as-is</button>
          <button className="btn-ghost" disabled={!canEdit} onClick={reset}>Reset to original demo</button>
        </div>
        <ol className="small" style={{ marginTop: 12 }}>
          <li>For tomorrow: open Demo Studio in a second tab, change a multiplier or preset, press Save &amp; activate.</li>
          <li>Reload the dashboard tab (or open Overview fresh) — Overview, Explorer, Budgets, Anomalies, Forecast, Allocation and the walkthrough all pick up the scenario.</li>
          <li>Mid-presentation, you can switch presets the same way; each save takes effect on the next reload.</li>
          <li>After the presentation, press Reset to original demo so the next run starts from the seeded story.</li>
        </ol>
        <p className="caption">The scenario is saved to .ledger-data/demo-scenario.json on the machine running the server (gitignored, never committed), so it survives a server restart — but it does not travel with a git pull to another machine. Set it up on the presentation machine itself.</p>
      </section>
    </div>
  );
}
