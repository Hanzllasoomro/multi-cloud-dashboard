import { describe, expect, it } from "vitest";
import { allRows } from "../src/lib/data";
import {
  applyScenario, cleanScenario, defaultScenario, impactRows, multiplierChanges, presetScenario, scenarioMultiplier, scenarioSummary, sumByField,
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
  it("impact rows show up, down, same and new, with $ and %", () => {
    const base = allRows();
    const growth = applyScenario(base, presetScenario("growth"));
    const byProvider = impactRows(base, growth, "provider");
    expect(byProvider).toHaveLength(3);
    expect(byProvider.every((r) => r.direction === "up" && r.deltaPct === 40)).toBe(true);
    const savings = applyScenario(base, presetScenario("savings"));
    expect(impactRows(base, savings, "provider").every((r) => r.direction === "down" && r.deltaPct === -30)).toBe(true);
    expect(impactRows(base, base, "provider").every((r) => r.direction === "same" && r.delta === 0)).toBe(true);
    const extra = applyScenario(base, { ...defaultScenario(), active: true, extraAccounts: [{ id: "x1", provider: "GCP", subAccount: "demo-new-eu", service: "Demo Compute", monthlyBase: 3000 }] });
    const newRow = impactRows(base, extra, "subAccount").find((r) => r.label === "demo-new-eu")!;
    expect(newRow.direction).toBe("new");
    expect(newRow.baseline).toBe(0);
    expect(newRow.deltaPct).toBeNull();
    expect(newRow.preview).toBeGreaterThan(0);
  });
  it("sumByField and multiplierChanges list only real changes", () => {
    const byService = sumByField(allRows(), "service");
    expect(byService.find((d) => d.label === "Amazon EC2")!.cost).toBeGreaterThan(80000);
    expect(multiplierChanges(defaultScenario())).toEqual([]);
    expect(multiplierChanges(presetScenario("spike"))).toEqual([{ label: "Amazon EC2 (service)", multiplier: 2, direction: "up" }]);
    const mixed = multiplierChanges({ ...defaultScenario(), active: true, globalMultiplier: 0.5, providerMultipliers: { Azure: 2 } });
    expect(mixed).toEqual([
      { label: "Everything (global)", multiplier: 0.5, direction: "down" },
      { label: "Azure (provider)", multiplier: 2, direction: "up" },
    ]);
  });
  it("presets are active and summarise honestly", () => {
    expect(presetScenario("growth").active).toBe(true);
    expect(presetScenario("growth").globalMultiplier).toBe(1.4);
    expect(scenarioSummary(presetScenario("spike"))).toContain("Amazon EC2 ×2");
    expect(scenarioSummary(defaultScenario())).toContain("Original seeded demo");
  });
});
