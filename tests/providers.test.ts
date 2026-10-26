// Provider mapping tests — recorded synthetic fixtures only, never live calls.
import { describe, expect, it } from "vitest";
import { awsConnector } from "../src/lib/providers/aws";
import { azureConnector } from "../src/lib/providers/azure";
import { gcpConnector, parseBigQueryResponse } from "../src/lib/providers/gcp";
import awsFixture from "../src/lib/providers/fixtures/aws.json";
import azureFixture from "../src/lib/providers/fixtures/azure.json";
import gcpFixture from "../src/lib/providers/fixtures/gcp.json";

describe("AWS Cost Explorer mapping", () => {
  const rows = awsConnector.toFocusRows(awsFixture);
  it("preserves totals through mapping", () => {
    const sum = rows.reduce((a, r) => a + r.billedCost, 0);
    expect(sum).toBeCloseTo(270, 6); // 100+120+50-30+20+10
  });
  it("drops no row silently and classifies every row", () => {
    expect(rows).toHaveLength(6);
    for (const r of rows) expect(["Usage", "Purchase", "Credit", "Tax", "Adjustment"]).toContain(r.chargeCategory);
  });
  it("handles credits and tax", () => {
    expect(rows.find((r) => r.chargeCategory === "Credit")?.billedCost).toBe(-30);
    expect(rows.find((r) => r.chargeCategory === "Tax")?.billedCost).toBe(20);
  });
  it("falls back safely for an unknown service", () => {
    const u = rows.find((r) => r.service === "Unknown service");
    expect(u).toBeDefined();
    expect(u!.billedCost).toBe(10);
  });
});

describe("Azure Cost Management mapping", () => {
  const rows = azureConnector.toFocusRows(azureFixture);
  it("preserves totals through mapping", () => {
    expect(rows.reduce((a, r) => a + r.billedCost, 0)).toBeCloseTo(244, 6);
  });
  it("maps Refund to Credit and unknown ChargeType to Adjustment, dropping nothing", () => {
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.service === "Virtual Machines" && r.chargeCategory === "Credit")?.billedCost).toBe(-15);
    expect(rows.find((r) => r.service === "Mystery Service")?.chargeCategory).toBe("Adjustment");
  });
});

describe("GCP BigQuery mapping", () => {
  const rows = gcpConnector.toFocusRows(gcpFixture.rows);
  it("preserves totals through mapping", () => {
    expect(rows.reduce((a, r) => a + r.billedCost, 0)).toBeCloseTo(199, 6);
  });
  it("handles credits, tax and unknown cost types", () => {
    expect(rows.filter((r) => r.chargeCategory === "Credit")[0]?.billedCost).toBe(-20);
    expect(rows.filter((r) => r.chargeCategory === "Tax")[0]?.billedCost).toBe(9);
    expect(rows).toHaveLength(5);
    for (const r of rows) expect(r.chargeCategory).toBeTruthy();
  });
  it("parses a raw BigQuery jobs.query response", () => {
    const parsed = parseBigQueryResponse({
      schema: { fields: [{ name: "service_description" }, { name: "project_id" }, { name: "cost" }] },
      rows: [{ f: [{ v: "Compute Engine" }, { v: "p1" }, { v: "42" }] }],
    });
    expect(parsed[0]).toMatchObject({ service: "Compute Engine", project: "p1", cost: 42 });
  });
});

describe("connector validation reports names only", () => {
  it("AWS validate() never includes a credential value", () => {
    const v = awsConnector.validate();
    expect(JSON.stringify(v)).not.toContain("AKIA");
    expect(v.missing.every((m) => /^[A-Z_]+$/.test(m))).toBe(true);
  });
});
