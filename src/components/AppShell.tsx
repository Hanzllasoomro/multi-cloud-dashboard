"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import FreshnessIndicator from "./FreshnessIndicator";
import { DATA_AS_OF } from "../lib/types";
const NAV_GROUPS = [
  { label: "Menu", items: [
    ["Overview", "/"], ["Cost Explorer", "/explorer"], ["Budgets", "/budgets"],
    ["Anomalies", "/anomalies"], ["Forecast", "/forecast"], ["Commitments", "/commitments"], ["Recommendations", "/recommendations"],
    ["Allocation", "/allocation"], ["Reports", "/reports"], ["Data Health", "/data-health"],
  ] },
  { label: "General", items: [
    ["Connections", "/connections"], ["Demo walkthrough", "/demo"], ["Demo Studio", "/demo-studio"], ["Settings", "/settings"],
  ] },
];
interface SourceState { source: "demo" | "live"; providers: { provider: string; configured: boolean; missing: string[] }[] }
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [source, setSource] = useState<SourceState | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; displayName: string; status: string }[] | null>(null);
  const [me, setMe] = useState<{ name: string; email: string; role: string } | null>(null);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const isAuthPage = path === "/login" || path === "/register";
  useEffect(() => {
    if (isAuthPage) return;
    fetch("/api/source").then((r) => r.json()).then((j) => setSource(j.data)).catch(() => undefined);
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data)).catch(() => undefined);
    fetch("/api/auth/me").then(async (r) => {
      if (r.status === 401) { router.replace("/login"); return; }
      const j = await r.json().catch(() => ({}));
      if (j.data) setMe(j.data);
    }).catch(() => undefined);
  }, [isAuthPage, router]);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login"); router.refresh();
  }
  const live = source?.source === "live";
  const notConnected = (source?.providers || []).filter((p) => !p.configured).map((p) => p.provider);
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  const crumb = path === "/" ? "Overview" : path.slice(1).split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ");
  const initials = me ? me.name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("") : "L";
  if (isAuthPage) {
    return (
      <div className="shell-canvas">
        <div className="shell-frame" style={{ display: "block" }}>
          <header style={{ height: 56, display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid var(--border-default)" }}>
            <Link href="/" className="sidebar-logo" style={{ margin: 0 }}><span className="logo-mark">✓</span> Ledger</Link>
          </header>
          <main style={{ padding: 24 }}>{children}</main>
        </div>
      </div>
    );
  }
  return (
    <div className="shell-canvas">
      <div className="shell-frame">
        <aside className="sidebar" aria-label="Main">
          <Link href="/" className="sidebar-logo"><span className="logo-mark">✓</span> Ledger</Link>
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map(([label, href]) => (
                <Link key={href} href={href} className={`nav-item${path === href ? " active" : ""}`}>{label}</Link>
              ))}
            </div>
          ))}
          <div className="sidebar-dark-card">
            <strong>{live ? "Live provider data" : "Still on demo data?"}</strong>
            <p className="small">{live ? "Live mode is on. Check which providers are connected." : "Connect a provider to replace synthetic demo figures with real billing."}</p>
            <Link href="/connections" className="btn-light" style={{ padding: "8px 14px", fontSize: 13 }}>Manage connections →</Link>
          </div>
          <p className="caption" style={{ marginTop: 16 }}>Read-only by default. Least-privilege roles; federation over static keys. No secrets in code.</p>
        </aside>
        <div className="shell-main">
          <header className="topbar">
            <form className="search-pill" role="search" onSubmit={(e) => { e.preventDefault(); router.push("/explorer"); }}>
              <span aria-hidden="true">⌕</span>
              <input aria-label="Search costs" placeholder="Search costs…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <span className="kbd">↵ Explorer</span>
            </form>
            <div style={{ flex: 1 }} />
            <span className="small" style={{ display: "inline-flex" }}><FreshnessIndicator freshness="Fresh" monthState="Estimated" reconciliation="Reconciled" dataAsOf={DATA_AS_OF} /></span>
            <button className="btn-ghost" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle dark theme" style={{ padding: "8px 14px" }}>{theme === "light" ? "☾ Dark" : "☀ Light"}</button>
            {me ? (
              <span className="user-chip">
                <span className="avatar" aria-hidden="true">{initials}</span>
                <span style={{ lineHeight: 1.25 }}>
                  <strong style={{ display: "block", fontSize: 13 }}>{me.name}</strong>
                  <span className="small muted">{me.email} · {me.role}</span>
                </span>
                <button className="btn-ghost" onClick={logout} style={{ padding: "6px 12px" }}>Log out</button>
              </span>
            ) : (
              <Link href="/login" className="small">Sign in</Link>
            )}
          </header>
          <main className="shell-content">
            <p className="caption" aria-label="Breadcrumb">Ledger / {crumb}</p>
            <div className="banner" style={{ background: live ? "var(--status-success-bg)" : "var(--status-warning-bg)" }}>
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
                <div className="banner" style={{ background: flagged.length ? "var(--status-warning-bg)" : "var(--bg-sunken)" }}>
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
    </div>
  );
}
