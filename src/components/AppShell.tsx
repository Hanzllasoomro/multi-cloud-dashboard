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
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [me, setMe] = useState<{ name: string; email: string; role: string } | null>(null);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const isAuthPage = path === "/login" || path === "/register";
  useEffect(() => {
    if (isAuthPage) return;
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
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
