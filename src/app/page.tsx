// Ledger landing page (v1.9) — public homepage at `/`.
//
// Every figure on this page is computed from the same seeded rows the
// dashboards use (src/lib/data), so the homepage can never disagree with
// the app. The numbers are labelled demo data, honestly: the dataset is
// synthetic until a provider is connected. No binary images — the hero
// visual is the live product itself (real KPI cards + charts), so the
// page ships as text and pushes cleanly.
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { allRows, monthCost, monthlyTotals, RECOMMENDATIONS } from "../lib/data";
import { runQuery } from "../lib/query";
import { currentMonthForecast, detectAnomalies, evaluateBudgets } from "../lib/insights";
import { fmtMoneyCompact, fmtMoneyFull, fmtMonth } from "../lib/format";
import { LineChart, DonutChart } from "../components/Charts";
import "./landing.css";
import { LogoMark } from "../components/Logo";

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    el.querySelectorAll(".reveal").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}

function CountUp({ to, money, decimals = 0 }: { to: number; money?: boolean; decimals?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
    let raf = 0; const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1100);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  const text = money
    ? `$${v.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`
    : v.toLocaleString("en-US", { maximumFractionDigits: decimals });
  return <>{text}</>;
}

const FEATURES = [
  { icon: "◈", title: "One number for all clouds", body: "AWS, Azure and GCP billing in a single total, one currency, one cost basis — Billed, so it ties to your invoices. No more three consoles, three spreadsheets." },
  { icon: "⇄", title: "FOCUS-normalised, not copied", body: "Every row is mapped to the FinOps FOCUS schema with Ledger extensions, so a vCPU-hour in one cloud means the same thing in another. Comparisons are honest by construction." },
  { icon: "◔", title: "Budgets that warn early", body: "Budgets trigger at 80% as well as 100%, so you hear about a runaway month while there is still time to act — not after the invoice lands." },
  { icon: "⚡", title: "Anomalies, explained", body: "A modified z-score (median ± MAD) flags the spend that moved — like the March EC2 spike, +48% against its own history — with the expected range shown next to it." },
  { icon: "↗", title: "Forecasts you can plan on", body: "Month-end forecasts from actual-to-date plus run rate, with an ±8% band for the open month. The October forecast in the demo: $17,796, range $16,372–$19,220." },
  { icon: "✓", title: "Savings, ranked by money", body: "Open recommendations are sorted by monthly savings — $5,100/month in the demo — with commitments tracked beside them, so the biggest win is always first." },
];
const STEPS = [
  ["Connect", "Read-only links to AWS Cost Explorer, Azure Cost Management and GCP BigQuery — no write access, ever."],
  ["Normalise", "Billing exports land in one FOCUS schema, with freshness and reconciliation state on every figure."],
  ["Query", "Slice by provider, account, service, tag or team — the same query language everywhere."],
  ["Analyse", "Budgets, anomalies and forecasts run on the same rows, so the story never contradicts itself."],
  ["Act", "Pause an account, chase a recommendation, resize a commitment — from the same screen."],
  ["Govern", "Roles, MFA, API keys and an audit log keep every change attributable."],
];

export default function LandingPage() {
  const rootRef = useReveal();
  const baseRows = useMemo(() => allRows(), []);
  const months = useMemo(() => monthlyTotals(baseRows), [baseRows]);
  const mtd = monthCost(baseRows, "2026-10");
  const total12 = months.reduce((a, m) => a + m.cost, 0);
  const fc = currentMonthForecast(baseRows);
  const anomalies = useMemo(() => detectAnomalies(baseRows), [baseRows]);
  const budgets = useMemo(() => evaluateBudgets(baseRows), [baseRows]);
  const savings = RECOMMENDATIONS.filter((r) => r.status === "Open").reduce((a, r) => a + r.monthlySavings, 0);
  const byProvider = runQuery(baseRows, { groupBy: ["provider"], start: "2025-11-01", end: "2026-10-26", topN: 10 }).data;
  const fcSeries = months.map((m) => (m.month === "2026-10" ? fc.forecast : m.cost));

  return (
    <div className="landing" ref={rootRef}>
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <Link href="/" className="lp-logo"><span className="mark"><LogoMark size={30} /></span> Ledger</Link>
          <nav className="lp-nav-links" aria-label="Sections">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#numbers">Live numbers</a>
            <a href="#proof">Why it matters</a>
          </nav>
          <div className="lp-nav-cta">
            <Link href="/login" className="lp-btn-ghost">Sign in</Link>
            <Link href="/overview" className="lp-btn">Open the app →</Link>
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-blob b1" aria-hidden="true" />
        <div className="lp-blob b2" aria-hidden="true" />
        <div className="lp-wrap lp-hero-grid">
          <div>
            <span className="lp-eyebrow"><span className="dot" /> AWS · Azure · GCP — one platform</span>
            <h1 className="lp-display">Every cloud bill.<br /><em>One honest number.</em></h1>
            <p className="lede">Ledger unifies billing, usage, budgets, anomalies and forecasts across AWS, Azure and GCP — normalised to one schema, reconciled to the invoice, and explained in plain language. Stop guessing where the money went.</p>
            <div className="lp-hero-ctas">
              <Link href="/overview" className="lp-btn">Open the app →</Link>
              <Link href="/demo" className="lp-btn-ghost">Take the 3-minute tour</Link>
            </div>
            <p className="lp-hero-note"><b>No card, no cloud keys to start.</b> Sign in and explore the demo — connect a provider when you want your real billing.</p>
          </div>
          <div className="lp-preview" aria-label="Live preview of the Ledger Overview dashboard">
            <div className="lp-preview-bar"><i /><i /><i /><span>● Live preview — demo data</span></div>
            <div className="lp-preview-body">
              <div className="lp-kpis">
                <div className="lp-kpi"><div className="k-label">Month-to-date</div><div className="k-value">{fmtMoneyFull(mtd)}</div><div className="k-sub">Oct 2026 · Est.</div></div>
                <div className="lp-kpi"><div className="k-label">Month-end forecast</div><div className="k-value">{fmtMoneyFull(fc.forecast)}</div><div className="k-sub">{fmtMoneyFull(fc.low)} – {fmtMoneyFull(fc.high)}</div></div>
                <div className="lp-kpi"><div className="k-label">Open savings / mo</div><div className="k-value">{fmtMoneyCompact(savings)}</div><div className="k-sub">Recommendations</div></div>
                <div className="lp-kpi"><div className="k-label">Anomalies open</div><div className="k-value">{anomalies.length}</div><div className="k-sub">Needs review</div></div>
              </div>
              <LineChart series={[{ label: "Monthly spend", values: months.map((m) => m.cost) }, { label: "Forecast", values: fcSeries }]} labels={months.map((m) => fmtMonth(m.month))} height={170} />
              <div style={{ marginTop: 12 }}><DonutChart data={byProvider.map((d) => ({ label: d.label, value: d.cost }))} /></div>
            </div>
            <div className="lp-preview-foot"><span>Overview · 12 months, all providers</span><Link href="/demo-studio">Try a scenario →</Link></div>
          </div>
        </div>
      </section>

      <section className="lp-stats" id="numbers">
        <div className="lp-wrap lp-stats-inner">
          <div className="lp-stat reveal"><b><CountUp to={total12} money /></b><span>12-month spend in the demo dataset (Nov 2025 – Oct 2026)</span></div>
          <div className="lp-stat reveal d1"><b><CountUp to={3} /></b><span>Cloud providers unified — AWS, Azure, GCP</span></div>
          <div className="lp-stat reveal d2"><b><CountUp to={savings} money /></b><span>Open savings per month, ranked by value</span></div>
          <div className="lp-stat reveal d3"><b>{anomalies.length > 0 ? `+${Math.round(((anomalies[0].actual - anomalies[0].expected) / anomalies[0].expected) * 100)}%` : "0"}</b><span>March EC2 anomaly vs its own history — caught, explained</span></div>
        </div>
      </section>

      <section className="lp-section" id="features">
        <div className="lp-wrap">
          <span className="lp-eyebrow">Features</span>
          <h2 className="lp-display reveal">Built for the question<br />“where did it go?”</h2>
          <p className="sub reveal">Every screen answers one job a FinOps team actually has — and every figure carries its freshness and reconciliation state, so you know how much to trust it.</p>
          <div className="lp-features">
            {FEATURES.map((f, i) => (
              <article className={`lp-feature reveal d${i % 3}`} key={f.title}>
                <div className="icon" aria-hidden="true">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="how" style={{ background: "#fff", borderTop: "1px solid var(--lp-line)", borderBottom: "1px solid var(--lp-line)" }}>
        <div className="lp-wrap">
          <span className="lp-eyebrow">How it works</span>
          <h2 className="lp-display reveal">Connect → Govern, in six steps</h2>
          <p className="sub reveal">The same pipeline every figure travels — from a billing export to a decision you can defend in front of finance.</p>
          <div className="lp-steps">
            {STEPS.map(([title, body], i) => (
              <div className={`lp-step reveal d${i % 3}`} key={title}><h3>{title}</h3><p>{body}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="proof">
        <div className="lp-wrap">
          <span className="lp-eyebrow">Why it matters</span>
          <h2 className="lp-display reveal">Cloud waste is not a rounding error</h2>
          <p className="sub reveal">The industry numbers say the same thing Ledger finds in its own demo data: the money is there, it is just hard to see.</p>
          <div className="lp-proof">
            <div className="lp-proof-card reveal">
              <div className="big">27%</div>
              <p>of IaaS/PaaS spend is estimated wasted — and managing cloud spend is the #1 cloud challenge, for the second year running. 89% of organisations are already multi-cloud.</p>
              <div className="src">Flexera 2024 State of the Cloud Report (n = 753)</div>
            </div>
            <div className="lp-proof-card reveal d1">
              <div className="big">$723.4B</div>
              <p>forecast worldwide public-cloud end-user spending in 2025, up 21.5% on 2024 — with 90% of organisations expected to adopt hybrid cloud through 2027.</p>
              <div className="src">Gartner press release, 19 Nov 2024</div>
            </div>
          </div>
          <div className="lp-proof-card lp-found reveal">
            <h3 style={{ margin: "0 0 8px" }}>What Ledger found in its own demo data</h3>
            <table>
              <thead><tr><th>Finding</th><th>Figure</th></tr></thead>
              <tbody>
                <tr><td>March 2026 EC2 anomaly — actual vs expected</td><td>$6,525 vs $4,395</td></tr>
                <tr><td>Open recommendations, monthly savings</td><td>{fmtMoneyFull(savings)} / mo</td></tr>
                <tr><td>Budgets triggered in October (at the 80% warning)</td><td>{budgets.filter((b) => b.status === "Triggered").length} of {budgets.length}</td></tr>
                <tr><td>12-month total, all providers</td><td>{fmtMoneyFull(total12)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="lp-honesty">Honest note: the figures on this page come from Ledger&apos;s seeded demo dataset — synthetic, clearly labelled, and the same data the app ships with. Connect a provider to replace them with your real billing.</div>
        </div>
      </section>

      <section className="lp-section lp-faq" style={{ paddingTop: 0 }}>
        <div className="lp-wrap">
          <span className="lp-eyebrow">Questions</span>
          <h2 className="lp-display reveal" style={{ marginBottom: 28 }}>Asked before you ask</h2>
          <details className="reveal"><summary>Is any of this my real billing?</summary><p>Not until you connect a provider. Everything on this page and in the demo is the seeded dataset — synthetic rows labelled as demo. Live mode reads your billing exports with read-only credentials that never leave your server&apos;s environment variables.</p></details>
          <details className="reveal d1"><summary>Do I need cloud keys to try it?</summary><p>No. Create an account, sign in, and the demo is fully explorable — including Demo Studio, where you can scale the demo story up or down and watch every dashboard follow. Keys are only needed for live billing.</p></details>
          <details className="reveal d2"><summary>Will my account survive a redeploy?</summary><p>Yes. Since v1.7, users, sessions, API keys and connected accounts live in Postgres (Vercel Postgres) when DATABASE_URL is set — not in a file that a serverless cold start can lose.</p></details>
          <details className="reveal d3"><summary>Who can change what?</summary><p>Roles are Owner, Admin, FinOps Manager, Analyst, Viewer and Auditor, enforced server-side on every API route. Viewers can look; only Owners, Admins and FinOps Managers can change connections or demo scenarios.</p></details>
        </div>
      </section>

      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-wrap">
          <div className="lp-cta reveal">
            <h2 className="lp-display">See your cloud spend clearly.</h2>
            <p>Open the app, take the tour, or bend the demo in Demo Studio — the numbers will follow you, live.</p>
            <Link href="/overview" className="lp-btn">Open the app →</Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer lp-wrap">
        <span><b style={{ color: "var(--lp-ink)" }}>Ledger</b> — Multi-Cloud Cost &amp; Usage Platform</span>
        <span><Link href="/overview">App</Link> · <Link href="/demo">Tour</Link> · <Link href="/demo-studio">Demo Studio</Link> · <Link href="/login">Sign in</Link></span>
        <span>Demo data is synthetic · FOCUS-normalised · v1.9.0</span>
      </footer>
    </div>
  );
}
