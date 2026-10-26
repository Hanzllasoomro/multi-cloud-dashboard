// Query invariant + export escaping tests.
import { describe, expect, it } from "vitest";
import { allRows } from "../src/lib/data";
import { runQuery } from "../src/lib/query";
import { escapeCsvCell } from "../src/lib/format";
import { toJsonExport } from "../src/lib/exports";

describe("query totals invariant", () => {
  it("grouped costs sum to the ungrouped total (within rounding)", () => {
    const rows = allRows();
    // End 2026-10-31: Oct tax rows are dated the 28th, after the Oct 26 data-as-of
    // date, so a 2026-10-26 range correctly excludes exactly those 3 rows.
    const total = runQuery(rows, { groupBy: ["provider"], start: "2025-11-01", end: "2026-10-31", topN: 50 });
    const byService = runQuery(rows, { groupBy: ["service"], start: "2025-11-01", end: "2026-10-31", topN: 50 });
    const groupedSum = byService.data.reduce((a, d) => a + d.cost, 0);
    expect(Math.abs(groupedSum - total.totals.cost)).toBeLessThan(1);
    expect(total.totals.rows).toBe(rows.length);
  });
  it("tenant filter is mandatory: rows from another tenant never appear", () => {
    const rows = allRows();
    const foreign = { ...rows[0], x_tenantId: "other-tenant" };
    const q = runQuery([...rows, foreign], { groupBy: ["provider"], start: "2025-11-01", end: "2026-10-31", topN: 50 });
    expect(q.totals.rows).toBe(rows.length);
  });
});

describe("export escaping (formula injection)", () => {
  it("neutralises =, +, -, @ leading cells in CSV", () => {
    expect(escapeCsvCell("=2+2")).toBe("'=2+2");
    expect(escapeCsvCell("+cmd")).toBe("'+cmd");
    expect(escapeCsvCell("-x")).toBe("'-x");
    expect(escapeCsvCell("@x")).toBe("'@x");
    expect(escapeCsvCell("plain")).toBe("plain");
  });
  it("JSON export keeps the same totals and escapes nothing silently", () => {
    const rows = allRows();
    const q = runQuery(rows, { groupBy: ["service"], start: "2025-11-01", end: "2026-10-31", topN: 50 });
    const parsed = JSON.parse(toJsonExport(q));
    expect(parsed.totals.cost).toBeCloseTo(q.totals.cost, 2);
    expect(parsed.data.length).toBe(q.data.length);
    expect(parsed.meta.source).toBe("demo");
  });
});
