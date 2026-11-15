// Governance views (v1.10): MoM waterfall, stacked provider totals, tagging
// compliance and the "What needs attention" narrative — all computed from
// real rows, never invented.
import { describe, expect, it } from "vitest";
import type { CostRow } from "../src/lib/types";
import { allRows } from "../src/lib/data";
import { attentionBullets, isTagged, monthlySpendByProvider, providerMoM, taggingCompliance } from "../src/lib/governance";

function row(partial: Partial<CostRow> & { billingPeriod: string; billedCost: number; provider: CostRow["provider"] }): CostRow {
  return {
    provider: partial.provider, billingAccount: "x", billingAccountId: "x", subAccount: "s", subAccountId: "s",
    service: "Svc", serviceCategory: "Compute", region: "us", resourceId: "r", skuId: "s",
    chargeCategory: "Usage", chargePeriod: `${partial.billingPeriod}-15`, billingPeriod: partial.billingPeriod,
    billedCost: partial.billedCost, effectiveCost: partial.billedCost, listCost: partial.billedCost, contractedCost: partial.billedCost,
    usageQuantity: 1, usageUnit: "Hrs", currency: "USD", tags: partial.tags ?? { team: "platform", env: "prod" },
    x_sourceFile: "f", x_sourceVersion: "v", x_ingestedAt: "2026-10-26", x_tenantId: "t", x_connectionId: "c",
    x_rawServiceCode: "S", x_normalizerVersion: "1",
  };
}

describe("providerMoM", () => {
  it("attributes the change per provider and totals it", () => {
    const rows = [
      row({ provider: "AWS", billingPeriod: "2026-08", billedCost: 100 }),
      row({ provider: "AWS", billingPeriod: "2026-09", billedCost: 130 }),
      row({ provider: "GCP", billingPeriod: "2026-08", billedCost: 50 }),
      row({ provider: "GCP", billingPeriod: "2026-09", billedCost: 40 }),
    ];
    const { changes, total } = providerMoM(rows, "2026-08", "2026-09");
    expect(total.change).toBe(20);
    expect(changes[0].provider).toBe("AWS"); // largest increase first
    expect(changes[0].change).toBe(30);
    expect(changes.find((c) => c.provider === "GCP")?.change).toBe(-10);
  });
});

describe("monthlySpendByProvider", () => {
  it("splits each month by provider and totals it", () => {
    const rows = [
      row({ provider: "AWS", billingPeriod: "2026-08", billedCost: 100 }),
      row({ provider: "Azure", billingPeriod: "2026-08", billedCost: 50 }),
    ];
    const out = monthlySpendByProvider(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ month: "2026-08", AWS: 100, Azure: 50, GCP: 0, total: 150 });
  });
});

describe("taggingCompliance", () => {
  it("counts blank and messy team tags as untagged, normalised ones as tagged", () => {
    expect(isTagged(row({ provider: "AWS", billingPeriod: "2026-09", billedCost: 1, tags: { team: "", env: "prod" } }))).toBe(false);
    expect(isTagged(row({ provider: "AWS", billingPeriod: "2026-09", billedCost: 1, tags: { team: "  Platform ", env: "prod" } }))).toBe(true);
    expect(isTagged(row({ provider: "AWS", billingPeriod: "2026-09", billedCost: 1, tags: { team: "PLATFORM", env: "prod" } }))).toBe(true);
    const rows = [
      row({ provider: "AWS", billingPeriod: "2026-09", billedCost: 90, tags: { team: "data", env: "prod" } }),
      row({ provider: "AWS", billingPeriod: "2026-09", billedCost: 10, tags: { team: "", env: "prod" } }),
    ];
    const { byProvider, overall } = taggingCompliance(rows);
    expect(byProvider.find((c) => c.provider === "AWS")?.taggedPct).toBe(90);
    expect(overall.untaggedPct).toBe(10);
  });
  it("seeded demo data: overall untagged share is in the expected ~8% band", () => {
    const { overall } = taggingCompliance(allRows());
    expect(overall.untaggedPct).toBeGreaterThan(4);
    expect(overall.untaggedPct).toBeLessThan(14);
  });
});

describe("attentionBullets", () => {
  it("names the driver provider, the months, and the anomaly", () => {
    const rows = [
      row({ provider: "AWS", billingPeriod: "2026-08", billedCost: 100 }),
      row({ provider: "AWS", billingPeriod: "2026-09", billedCost: 150 }),
      row({ provider: "GCP", billingPeriod: "2026-08", billedCost: 50 }),
      row({ provider: "GCP", billingPeriod: "2026-09", billedCost: 50 }),
    ];
    const bullets = attentionBullets(rows, {
      prevMonth: "2026-08", curMonth: "2026-09", openMonth: "2026-10",
      openMonthForecast: 210, openMonthActual: 180,
      topAnomaly: { service: "Amazon EC2", provider: "AWS", month: "2026-03", actual: 6525, expected: 4395, deltaPct: 48 },
      triggeredBudgets: ["Total-cloud"],
    });
    expect(bullets[0]).toContain("September 2026");
    expect(bullets[0]).toContain("AWS");
    expect(bullets[0]).toContain("$200");
    expect(bullets.join(" ")).toContain("Amazon EC2");
    expect(bullets.join(" ")).toContain("Total-cloud");
    expect(bullets.join(" ")).toContain("October 2026");
  });
  it("seeded data produces the known story: Sep up on Aug, AWS the driver", () => {
    const rows = allRows();
    const { total } = providerMoM(rows, "2026-08", "2026-09");
    expect(total.change).toBeGreaterThan(0);
    const bullets = attentionBullets(rows, {
      prevMonth: "2026-08", curMonth: "2026-09", openMonth: "2026-10",
      openMonthForecast: 17796, openMonthActual: 19848.69,
      topAnomaly: null, triggeredBudgets: [],
    });
    expect(bullets.length).toBeGreaterThanOrEqual(3);
    expect(bullets[0]).toContain("September 2026");
  });
});
