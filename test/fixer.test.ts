import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fixVuln } from "../src/fixer.ts";
import { fakeProvider, failingProvider } from "./helpers/fake-provider.ts";
import type { Vuln } from "../src/types.ts";

const sampleVuln: Vuln = {
  package: "lodash", currentVersion: "4.17.15", vulnId: "GHSA-x",
  severity: "high", advisorySummary: "Prototype pollution",
  patchedVersions: ">=4.17.21", isDirectDep: true,
};

async function makeProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vulfix-fixer-"));
  await writeFile(join(dir, "package.json"), JSON.stringify({
    name: "x", version: "0.0.0", dependencies: { lodash: "4.17.15" },
  }, null, 2));
  return dir;
}

test("fixVuln applies safe bump in auto mode", async () => {
  const dir = await makeProject();
  try {
    const provider = fakeProvider({
      action: "bump", targetVersion: "4.17.21", replacementPackage: null,
      codeDiffs: [], risk: "safe", explanation: "ok",
    });
    const outcome = await fixVuln(sampleVuln, dir, provider, { dryRun: false, auto: true }, async () => true, { skipInstall: true });
    assert.equal(outcome.kind, "fixed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("fixVuln dry-run reports without applying", async () => {
  const dir = await makeProject();
  try {
    const provider = fakeProvider({
      action: "bump", targetVersion: "4.17.21", replacementPackage: null,
      codeDiffs: [], risk: "safe", explanation: "ok",
    });
    const outcome = await fixVuln(sampleVuln, dir, provider, { dryRun: true, auto: false }, async () => true, { skipInstall: true });
    assert.equal(outcome.kind, "skipped");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("fixVuln prompts on risky action and respects 'no'", async () => {
  const dir = await makeProject();
  try {
    const provider = fakeProvider({
      action: "bump", targetVersion: "5.0.0", replacementPackage: null,
      codeDiffs: [], risk: "risky", explanation: "major bump",
    });
    const outcome = await fixVuln(sampleVuln, dir, provider, { dryRun: false, auto: false }, async () => false, { skipInstall: true });
    assert.equal(outcome.kind, "declined-by-user");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("fixVuln returns 'declined-by-llm' for action:none", async () => {
  const dir = await makeProject();
  try {
    const provider = fakeProvider({
      action: "none", targetVersion: null, replacementPackage: null,
      codeDiffs: [], risk: "safe", explanation: "no fix known",
    });
    const outcome = await fixVuln(sampleVuln, dir, provider, { dryRun: false, auto: true }, async () => true, { skipInstall: true });
    assert.equal(outcome.kind, "declined-by-llm");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("fixVuln returns 'skipped' on provider error", async () => {
  const dir = await makeProject();
  try {
    const outcome = await fixVuln(sampleVuln, dir, failingProvider(), { dryRun: false, auto: true }, async () => true, { skipInstall: true });
    assert.equal(outcome.kind, "skipped");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
