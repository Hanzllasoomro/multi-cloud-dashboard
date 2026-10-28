"use client";
import { useEffect, useState } from "react";
import type { CostRow } from "../lib/types";
import { applyScenario, type DemoScenario } from "../lib/demo-scenario";
// Client-side demo-scenario hook (v1.5): pages render the seeded rows first,
// then re-render with the saved scenario applied once /api/demo-scenario
// answers. A failed fetch (or no active scenario) leaves the seeded rows
// untouched, so a Studio outage never blanks a dashboard page.
export function useScenarioRows(base: CostRow[]): { rows: CostRow[]; scenario: DemoScenario | null } {
  const [rows, setRows] = useState<CostRow[]>(base);
  const [scenario, setScenario] = useState<DemoScenario | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo-scenario").then((r) => r.json()).then((j) => {
      if (cancelled || !j.data) return;
      const s = j.data as DemoScenario;
      setScenario(s);
      if (s.active) setRows(applyScenario(base, s));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [base]);
  return { rows, scenario };
}
