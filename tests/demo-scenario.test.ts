import { describe, expect, it } from "vitest";
import { allRows } from "../src/lib/data";
import {
  applyScenario, cleanScenario, defaultScenario, presetScenario, scenarioMultiplier, scenarioSummary,
} from "../src/lib/demo-scenario";

describe("demo scenario", () => {
  it("inactive scenario returns the seeded rows unchanged", () => {
    const rows = allRows();
    expect(applyScenario(rows, defaultScenario())).toBe(rows);
  });
  it("global multiplier scales cost and usage together", () => {
    const rows = allRows().slice(0, 10);
    const out = applyScenario(rows, { ...defaultScenario(), active: true, globalMultiplier: 2 });
    expect(out[0].billedCost).toBe(rows[0].billedCost * 2);
    expect(out[0].usageQuantity).toBe(rows[0].usageQuantity * 2);
    expect(out[0].service).toBe(rows[0].service);
    expect(out[0].chargePeriod).toBe(rows[0].chargePeriod);
  });
  it("provider, account and service multipliers combine", () => {
    const s = { ...defaultScenario(), active: true, globalMultiplier: 2, providerMultipliers: { AWS: 0.5 }, accountMultipliers: { "prod-aws": 3 }, serviceMultipliers: { "Amazon EC2": 2 } };
    const ec2 = allRows().find((r) => r.service === "Amazon EC2" && r.subAccount === "prod-aws")!;
    expect(scenarioMultiplier(s, ec2)).toBe(6);
  });
  it("extra demo accounts add a full 12-month daily set", () => {
    const s = { ...defaultScenario(), active: true, extraAccounts: [{ id: "x1", provider: "GCP", subAccount: "demo-acme-eu", service: "Demo Compute", monthlyBase: 3000 }] };
    const out = applyScenario(allRows(), s);
    const extra = out.filter((r) => r.subAccount === "demo-acme-eu");
    expect(extra.length).toBeGreaterThan(300);
    expect(extra.every((r) => r.billingPeriod >= "2025-11" && r.billingPeriod <= "2026-10")).toBe(true);
    const oct = extra.filter((r) => r.billingPeriod === "2026-10").reduce((a, r) => a + r.billedCost, 0);
    expect(oct).toBeGreaterThan(2000);
    expect(oct).toBeLessThan(4000);
  });
  it("cleanScenario rejects out-of-range multipliers and bad providers", () => {
    expect(() => cleanScenario({ active: true, globalMultiplier: 11 })).toThrow();
    expect(() => cleanScenario({ active: true, globalMultiplier: -1 })).toThrow();
    expect(() => cleanScenario({ active: true, providerMultipliers: { Oracle: 2 } })).toThrow();
    expect(() => cleanScenario({ active: true, extraAccounts: [{ provider: "AWS", subAccount: "a", service: "b", monthlyBase: -5 }] })).toThrow();
    expect(() => cleanScenario({ active: true, extraAccounts: [{ provider: "AWS", subAccount: "a", service: "b", monthlyBase: 1 }, { provider: "AWS", subAccount: "a", service: "c", monthlyBase: 1 }] })).toThrow(/Duplicate/);
  });
  it("presets are active and summarise honestly", () => {
    expect(presetScenario("growth").active).toBe(true);
    expect(presetScenario("growth").globalMultiplier).toBe(1.4);
    expect(scenarioSummary(presetScenario("spike"))).toContain("Amazon EC2 ×2");
    expect(scenarioSummary(defaultScenario())).toContain("Original seeded demo");
  });
});
