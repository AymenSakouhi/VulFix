import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAuditJson, summarizeAudit } from "../src/auditor.ts";

test("parseAuditJson returns empty list for clean audit", async () => {
  const raw = await readFile("test/fixtures/audit/empty.json", "utf8");
  const vulns = parseAuditJson(raw);
  assert.equal(vulns.length, 0);
});

test("parseAuditJson extracts a single direct vuln", async () => {
  const raw = await readFile("test/fixtures/audit/lodash-vuln.json", "utf8");
  const vulns = parseAuditJson(raw);
  assert.equal(vulns.length, 1);
  const v = vulns[0];
  assert.equal(v.package, "lodash");
  assert.equal(v.severity, "high");
  assert.equal(v.isDirectDep, true);
  assert.equal(v.vulnId, "GHSA-jf85-cpcp-j695");
  assert.equal(v.patchedVersions, ">=4.17.21");
});

test("summarizeAudit counts by severity", async () => {
  const raw = await readFile("test/fixtures/audit/lodash-vuln.json", "utf8");
  const summary = summarizeAudit(raw);
  assert.deepEqual(summary, { low: 0, moderate: 0, high: 1, critical: 0, total: 1 });
});
