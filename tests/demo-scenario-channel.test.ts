// Demo-scenario change channel tests (v1.8.3): a Studio save notifies
// open dashboard tabs instantly via BroadcastChannel, with a localStorage
// ping as the fallback path. Polling in useScenarioRows covers the rest.
import { describe, expect, it } from "vitest";
import { notifyScenarioChanged, onScenarioChanged, DEMO_SCENARIO_CHANNEL } from "../src/lib/demo-scenario-channel";

describe("demo-scenario channel", () => {
  it("a notify reaches a subscriber on the same channel name", async () => {
    const seen: number[] = [];
    const unsub = onScenarioChanged(() => seen.push(1));
    notifyScenarioChanged();
    await new Promise((r) => setTimeout(r, 50));
    unsub();
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(DEMO_SCENARIO_CHANNEL).toBe("ledger-demo-scenario");
  });
  it("unsubscribing stops delivery", async () => {
    let n = 0;
    const unsub = onScenarioChanged(() => { n++; });
    unsub();
    notifyScenarioChanged();
    await new Promise((r) => setTimeout(r, 50));
    expect(n).toBe(0);
  });
  it("notify does not throw where localStorage is absent (Node test env)", () => {
    expect(() => notifyScenarioChanged()).not.toThrow();
  });
});
