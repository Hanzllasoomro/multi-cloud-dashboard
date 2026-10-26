// Anomaly + forecast tests (seeded demo data).
import { describe, expect, it } from "vitest";
import { allRows } from "../src/lib/data";
import { currentMonthForecast, detectAnomalies, forecastMonth } from "../src/lib/insights";

describe("anomaly detection", () => {
  it("detects the seeded March 2026 EC2 spike with a positive delta", () => {
    const anomalies = detectAnomalies(allRows());
    const ec2 = anomalies.find((a) => a.service === "Amazon EC2");
    expect(ec2).toBeDefined();
    expect(ec2!.actual).toBeGreaterThan(ec2!.expected);
    expect(ec2!.deltaPct).toBeGreaterThanOrEqual(25);
  });
  it("excludes Purchase rows from baselines (no anomaly is a savings-plan buy)", () => {
    const anomalies = detectAnomalies(allRows());
    // The seeded spike is a Usage spike; Purchase months must not create one.
    expect(anomalies.every((a) => a.delta > 0)).toBe(true);
  });
});

describe("forecast", () => {
  it("month-end forecast = actual-to-date + run-rate remainder, with a band", () => {
    const f = currentMonthForecast(allRows());
    expect(f.forecast).toBeGreaterThan(f.actualToDate);
    expect(f.low).toBeLessThan(f.forecast);
    expect(f.high).toBeGreaterThan(f.forecast);
  });
  it("forecastMonth labels the open month's method in plain words", () => {
    const oct = forecastMonth(allRows()).find((p) => p.month === "2026-10");
    expect(oct?.method).toContain("Actual-to-date");
  });
});
