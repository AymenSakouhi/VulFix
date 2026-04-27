import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSummary } from "../src/reporter.ts";
import type { FixOutcome } from "../src/types.ts";

test("renderSummary counts each outcome kind", () => {
  const outcomes: FixOutcome[] = [
    { kind: "fixed", vuln: { package: "a" } as any, action: "bump" },
    { kind: "fixed", vuln: { package: "b" } as any, action: "patch_code" },
    { kind: "skipped", vuln: { package: "c" } as any, reason: "x" },
    { kind: "declined-by-user", vuln: { package: "d" } as any },
    { kind: "declined-by-llm", vuln: { package: "e" } as any, reason: "y" },
    { kind: "failed", vuln: { package: "f" } as any, reason: "z" },
  ];
  const before = { low: 1, moderate: 2, high: 3, critical: 0, total: 6 };
  const after = { low: 0, moderate: 1, high: 1, critical: 0, total: 2 };
  const text = renderSummary(before, after, outcomes);
  assert.match(text, /Before: 6/);
  assert.match(text, /After:\s+2/);
  assert.match(text, /Fixed:\s+2/);
  assert.match(text, /Skipped:\s+1/);
  assert.match(text, /Failed:\s+1/);
});
