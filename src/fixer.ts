import { spawn } from "node:child_process";
import type { Vuln, FixContext, FixOutcome, RunMode, FixResponse } from "./types.ts";
import type { Provider } from "./providers/index.ts";
import { findUsages } from "./source-grep.ts";
import { applyBump, applyPatchCode, applyReplace, type ApplyOptions } from "./applier.ts";

export type ConfirmFn = (response: FixResponse, vuln: Vuln) => Promise<boolean>;

export interface BuildContextOptions {
  skipVersionLookup?: boolean;
}

export async function fetchAvailableVersions(pkgName: string): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn("npm", ["view", pkgName, "versions", "--json"], { shell: true });
    let stdout = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.on("close", (code) => {
      if (code !== 0) { resolve([]); return; }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(Array.isArray(parsed) ? parsed : []);
      } catch {
        resolve([]);
      }
    });
    proc.on("error", () => resolve([]));
  });
}

export async function buildContext(vuln: Vuln, cwd: string, buildOpts: BuildContextOptions = {}): Promise<FixContext> {
  const foundInSource = vuln.isDirectDep ? await findUsages(vuln.package, cwd) : [];
  const availableVersions = (!buildOpts.skipVersionLookup && vuln.isDirectDep)
    ? await fetchAvailableVersions(vuln.package)
    : [];
  return {
    package: vuln.package,
    currentVersion: vuln.currentVersion,
    vulnId: vuln.vulnId,
    severity: vuln.severity,
    advisorySummary: vuln.advisorySummary,
    patchedVersions: vuln.patchedVersions,
    availableVersions,
    isDirectDep: vuln.isDirectDep,
    foundInSource,
  };
}

async function callWithRetry(provider: Provider, ctx: FixContext): Promise<FixResponse> {
  try {
    return await provider.generateFix(ctx);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return await provider.generateFix(ctx, { strict: true });
    }
    throw err;
  }
}

export async function fixVuln(
  vuln: Vuln,
  cwd: string,
  provider: Provider,
  mode: RunMode,
  confirm: ConfirmFn,
  applyOpts: ApplyOptions = {},
  buildOpts: BuildContextOptions = {},
): Promise<FixOutcome> {
  let response: FixResponse;
  try {
    const ctx = await buildContext(vuln, cwd, buildOpts);
    response = await callWithRetry(provider, ctx);
  } catch (err) {
    return { kind: "skipped", vuln, reason: err instanceof Error ? err.message : String(err) };
  }

  if (response.action === "none") {
    return { kind: "declined-by-llm", vuln, reason: response.explanation };
  }

  if (mode.dryRun) {
    return { kind: "skipped", vuln, reason: "dry-run" };
  }

  const effectivelyRisky = response.risk === "risky" || response.action === "patch_code" || response.action === "replace";
  const needsConfirm = effectivelyRisky && !mode.auto;
  if (needsConfirm) {
    const ok = await confirm(response, vuln);
    if (!ok) return { kind: "declined-by-user", vuln };
  }

  let result;
  switch (response.action) {
    case "bump":
      if (!response.targetVersion) return { kind: "failed", vuln, reason: "bump action missing targetVersion" };
      result = await applyBump(cwd, vuln.package, response.targetVersion, applyOpts);
      break;
    case "replace":
      if (!response.replacementPackage || !response.targetVersion) return { kind: "failed", vuln, reason: "replace action missing fields" };
      result = await applyReplace(cwd, vuln.package, response.replacementPackage, response.targetVersion, response.codeDiffs, applyOpts);
      break;
    case "patch_code":
      result = await applyPatchCode(cwd, response.codeDiffs);
      break;
  }

  return result.ok
    ? { kind: "fixed", vuln, action: response.action }
    : { kind: "failed", vuln, reason: result.reason };
}
