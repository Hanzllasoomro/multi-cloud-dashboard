"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import FreshnessIndicator from "./FreshnessIndicator";
import { DATA_AS_OF } from "../lib/types";
const NAV = [
  ["Overview", "/"], ["Demo walkthrough", "/demo"], ["Cost Explorer", "/explorer"], ["Connections", "/connections"], ["Budgets", "/budgets"],
  ["Anomalies", "/anomalies"], ["Forecast", "/forecast"], ["Commitments", "/commitments"], ["Recommendations", "/recommendations"],
  ["Allocation", "/allocation"], ["Reports", "/reports"], ["Data Health", "/data-health"], ["Settings", "/settings"],
];
interface SourceState { source: "demo" | "live"; providers: { provider: string; configured: boolean; missing: string[] }[] }
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [source, setSource] = useState<SourceState | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; displayName: string; status: string }[] | null>(null);
  useEffect(() => {
    fetch("/api/source").then((r) => r.json()).then((j) => setSource(j.data)).catch(() => undefined);
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data)).catch(() => undefined);
  }, []);
  const live = source?.source === "live";
  const notConnected = (source?.providers || []).filter((p) => !p.configured).map((p) => p.provider);
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  const crumb = path === "/" ? "Overview" : path.slice(1).split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ");
  return (
    <div>
      <header style={{ height: 56, display: "flex", alignItems: "center", gap: 16, padding: "0 16px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border-default)", position: "sticky", top: 0, zIndex: 10 }}>
        <Link href="/" style={{ textDecoration: "none", color: "var(--text-primary)", fontWeight: 800, fontSize: 18 }}>▦ Ledger</Link>
        <label className="small">Organisation <select className="select" defaultValue="Acme Corp"><option>Acme Corp</option><option>Acme Corp › Platform team (child org)</option></select></label>
        <div style={{ flex: 1 }} />
        <FreshnessIndicator freshness="Fresh" monthState="Estimated" reconciliation="Reconciled" dataAsOf={DATA_AS_OF} />
        <button className="btn-ghost" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle dark theme">{theme === "light" ? "☾ Dark" : "☀ Light"}</button>
        <span className="small">FinOps Manager ▾</span>
      </header>
      <div style={{ display: "flex" }}>
        <nav aria-label="Main" style={{ width: 240, flexShrink: 0, padding: 16, borderRight: "1px solid var(--border-default)", minHeight: "calc(100vh - 56px)" }}>
          {NAV.map(([label, href]) => (
            <Link key={href} href={href} style={{ display: "block", padding: "8px 10px", borderRadius: "var(--radius-6)", background: path === href ? "var(--bg-selected)" : "transparent", color: "var(--text-primary)", textDecoration: "none", fontWeight: path === href ? 700 : 400 }}>{label}</Link>
          ))}
          <p className="caption" style={{ marginTop: 24 }}>Read-only by default. Least-privilege roles; federation over static keys. No secrets in code.</p>
        </nav>
        <main style={{ flex: 1, padding: 24, maxWidth: 1240 }}>
          <p className="caption" aria-label="Breadcrumb">Ledger / {crumb}</p>
          <div style={{ background: live ? "var(--status-success-bg, #ECFDF3)" : "var(--status-warning-bg)", border: "1px solid var(--amber-200)", borderRadius: "var(--radius-8)", padding: "10px 14px", marginBottom: 16 }}>
            {live ? (
              <><strong>Live provider data</strong> — LEDGER_DATA_SOURCE=live. Configured: {(source?.providers || []).filter((p) => p.configured).map((p) => p.provider).join(", ") || "none"}. {notConnected.length > 0 && <>Not connected (no fake numbers for these): {notConnected.join(", ")}.</>} See <Link href="/connections">Connections</Link> and <Link href="/demo">Demo walkthrough</Link>.</>
            ) : (
              <><strong>Demo data</strong> — connect a provider to see real billing. Synthetic data only; no real credentials, no network calls at runtime. Set LEDGER_DATA_SOURCE=live with provider env vars to switch to live data (see docs/REAL_ACCOUNTS.md). Judge walkthrough: <Link href="/demo">/demo</Link>.</>
            )}
          </div>
          {accounts && (() => {
            const active = accounts.filter((a) => a.status !== "Paused").length;
            const flagged = accounts.filter((a) => a.status === "Paused" || a.status === "Broken");
            return (
              <div style={{ background: flagged.length ? "var(--status-warning-bg)" : "var(--bg-sunken)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-8)", padding: "10px 14px", marginBottom: 16 }}>
                <span className="small">Connected accounts: <strong>{accounts.length}</strong> · Active: <strong>{active}</strong></span>
                {flagged.length > 0 && <span className="small"> · ⚠ Paused / broken: {flagged.map((a) => a.displayName).join(", ")} — paused accounts are excluded from /api/query totals. Manage them in <Link href="/settings">Settings › Connected accounts</Link>.</span>}
                {flagged.length === 0 && <span className="small"> · Manage them in <Link href="/settings">Settings › Connected accounts</Link>.</span>}
              </div>
            );
          })()}
          {children}
        </main>
      </div>
    </div>
  );
}
