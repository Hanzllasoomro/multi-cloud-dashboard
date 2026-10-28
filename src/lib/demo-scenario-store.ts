// Ledger — Demo Studio file-backed store (v1.5, server-only).
// Mirrors the v1.3.1 auth store pattern: every read loads from disk first,
// every mutation saves atomically (tmp + rename), corrupt files are
// quarantined instead of bricking the page, and persistence is DISABLED
// under Vitest so tests stay hermetic. The file carries multipliers and
// demo-account shapes only — never credentials, never passwords.
// Path: .ledger-data/demo-scenario.json (gitignored), or LEDGER_DEMO_SCENARIO_FILE.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cleanScenario, defaultScenario, type DemoScenario } from "./demo-scenario";

export function demoScenarioPersistenceEnabled(): boolean {
  return process.env.NODE_ENV !== "test" && !process.env.VITEST;
}
export function demoScenarioFilePath(): string {
  const raw = process.env.LEDGER_DEMO_SCENARIO_FILE;
  return raw ? resolve(process.cwd(), raw) : resolve(process.cwd(), ".ledger-data", "demo-scenario.json");
}
let memory: DemoScenario = defaultScenario();
export function resetDemoScenarioStore(): void {
  memory = defaultScenario();
}
export function loadScenario(): DemoScenario {
  if (!demoScenarioPersistenceEnabled()) return memory;
  const file = demoScenarioFilePath();
  if (!existsSync(file)) return memory;
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as unknown;
    memory = cleanScenario(data);
    return memory;
  } catch {
    try { renameSync(file, `${file}.corrupt-${Date.now()}`); } catch { /* ignore */ }
    memory = defaultScenario();
    return memory;
  }
}
export function saveScenario(input: unknown): DemoScenario {
  const cleaned: DemoScenario = {
    ...cleanScenario(input),
    updatedAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
  };
  memory = cleaned;
  if (!demoScenarioPersistenceEnabled()) return memory;
  try {
    const file = demoScenarioFilePath();
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(cleaned), "utf8");
    renameSync(tmp, file);
  } catch { /* in-memory state is still correct for this process */ }
  return memory;
}
