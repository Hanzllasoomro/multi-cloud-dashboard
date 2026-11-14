"use client";
import { useEffect, useRef, useState } from "react";
import type { CostRow } from "../lib/types";
import { applyScenario, type DemoScenario } from "../lib/demo-scenario";
import { onScenarioChanged } from "../lib/demo-scenario-channel";

// Client-side demo-scenario hook (v1.5, auto-refresh in v1.8.3): pages render
// the seeded rows first, then re-render with the saved scenario applied.
// A Studio save used to need a manual reload of every open dashboard tab;
// now the hook re-fetches on three triggers, so dashboards follow Studio
// within a second (BroadcastChannel/storage ping) and within 5 seconds at
// most (polling, skipped while the tab is hidden):
//  - instant: a Studio save in any tab of this browser,
//  - poll: every 5s, comparing the scenario JSON — no change, no re-render,
//  - initial load, as before.
// A failed fetch (or no active scenario) leaves the last good rows in
// place, so a Studio outage never blanks a dashboard page. When the
// scenario is reset/inactive the seeded rows return.
const POLL_MS = 5000;
export function useScenarioRows(base: CostRow[]): { rows: CostRow[]; scenario: DemoScenario | null; updatedAt: Date | null } {
  const [rows, setRows] = useState<CostRow[]>(base);
  const [scenario, setScenario] = useState<DemoScenario | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const lastJson = useRef<string>("");
  useEffect(() => {
    let cancelled = false;
    const apply = (s: DemoScenario | null) => {
      if (cancelled) return;
      setScenario(s);
      setRows(s && s.active ? applyScenario(base, s) : base);
      setUpdatedAt(new Date());
    };
    const fetchScenario = async () => {
      try {
        const j = await (await fetch("/api/demo-scenario")).json();
        if (cancelled || !j.data) return;
        const json = JSON.stringify(j.data);
        if (json === lastJson.current) return; // unchanged — no re-render
        lastJson.current = json;
        apply(j.data as DemoScenario);
      } catch { /* keep last good rows */ }
    };
    fetchScenario();
    const unsub = onScenarioChanged(() => { void fetchScenario(); });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void fetchScenario();
    }, POLL_MS);
    return () => { cancelled = true; unsub(); clearInterval(timer); };
  }, [base]);
  return { rows, scenario, updatedAt };
}
