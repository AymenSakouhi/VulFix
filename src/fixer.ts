import type { Vuln, FixContext, FixOutcome, RunMode, FixResponse } from "./types.ts";
import type { Provider } from "./providers/index.ts";
import { findUsages } from "./source-grep.ts";
import { applyBump, applyPatchCode, applyReplace, type ApplyOptions } from "./applier.ts";

export type ConfirmFn = (response: FixResponse, vuln: Vuln) => Promise<boolean>;

export async function buildContext(vuln: Vuln, cwd: string): Promise<FixContext> {
  const foundInSource = vuln.isDirectDep ? await findUsages(vuln.package, cwd) : [];
  return {
    package: vuln.package,
    currentVersion: vuln.currentVersion,
    vulnId: vuln.vulnId,
    severity: vuln.severity,
    advisorySummary: vuln.advisorySummary,
    patchedVersions: vuln.patchedVersions,
    availableVersions: [],
    isDirectDep: vuln.isDirectDep,
    foundInSource,
  };
}

async function callWithRetry(provider: Provider, ctx: FixContext): Promise<FixResponse> {
  try {
    return await provider.generateFix(ctx);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return await provider.generateFix(ctx);
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
): Promise<FixOutcome> {
  let response: FixResponse;
  try {
    const ctx = await buildContext(vuln, cwd);
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

  const needsConfirm = response.risk === "risky" && !mode.auto;
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
