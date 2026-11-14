// Ledger — demo-scenario change channel (v1.8.3, client-only).
//
// Demo Studio runs in one tab and the dashboards in others (or the same
// tab, switched later). A saved scenario used to sit unnoticed until a
// dashboard tab was manually reloaded. This channel closes that gap two
// ways, so a dashboard updates within a second of a Studio save and
// within 5 seconds even if the instant path is unavailable:
//  1. BroadcastChannel "ledger-demo-scenario" — instant, same browser.
//  2. localStorage ping ("ledger-demo-scenario-ping" = Date.now()) — the
//     storage event fires in every other tab, including browsers without
//     BroadcastChannel. The polling in useScenarioRows is the fallback
//     for the same tab and for any missed event.
export const DEMO_SCENARIO_CHANNEL = "ledger-demo-scenario";
const PING_KEY = "ledger-demo-scenario-ping";

export function notifyScenarioChanged(): void {
  try {
    const bc = new BroadcastChannel(DEMO_SCENARIO_CHANNEL);
    bc.postMessage({ at: Date.now() });
    bc.close();
  } catch { /* BroadcastChannel unavailable — the storage ping below still fires */ }
  try { localStorage.setItem(PING_KEY, String(Date.now())); } catch { /* private mode etc. — polling still covers it */ }
}

/** Subscribe to scenario-change pings. Returns an unsubscribe function. */
export function onScenarioChanged(cb: () => void): () => void {
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(DEMO_SCENARIO_CHANNEL);
    bc.onmessage = () => cb();
  } catch { bc = null; }
  const onStorage = (e: StorageEvent) => { if (e.key === PING_KEY) cb(); };
  const hasWindow = typeof window !== "undefined";
  if (hasWindow) window.addEventListener("storage", onStorage);
  return () => {
    try { bc?.close(); } catch { /* ignore */ }
    if (hasWindow) window.removeEventListener("storage", onStorage);
  };
}
