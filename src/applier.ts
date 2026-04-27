import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { CodeDiff } from "./types.ts";

export type ApplyResult = { ok: true } | { ok: false; reason: string };

export interface ApplyOptions { skipInstall?: boolean; }

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function findDepLocation(pkg: PackageJson, name: string): "dependencies" | "devDependencies" | null {
  if (pkg.dependencies?.[name]) return "dependencies";
  if (pkg.devDependencies?.[name]) return "devDependencies";
  return null;
}

async function runNpmInstall(cwd: string): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("npm", ["install"], { cwd, shell: true });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", (code) => resolve({ ok: code === 0, stderr }));
    proc.on("error", () => resolve({ ok: false, stderr: "spawn error" }));
  });
}

export async function applyBump(
  cwd: string,
  pkgName: string,
  targetVersion: string,
  opts: ApplyOptions = {},
): Promise<ApplyResult> {
  const pkgPath = join(cwd, "package.json");
  const original = await readFile(pkgPath, "utf8");
  const pkg = JSON.parse(original) as PackageJson;
  const loc = findDepLocation(pkg, pkgName);
  if (!loc) return { ok: false, reason: `${pkgName} not in dependencies or devDependencies` };

  pkg[loc]![pkgName] = targetVersion;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  if (opts.skipInstall) return { ok: true };

  const install = await runNpmInstall(cwd);
  if (!install.ok) {
    await writeFile(pkgPath, original);
    return { ok: false, reason: `npm install failed: ${install.stderr.trim().slice(0, 200)}` };
  }
  return { ok: true };
}

export async function applyPatchCode(cwd: string, diffs: CodeDiff[]): Promise<ApplyResult> {
  for (const diff of diffs) {
    const filePath = join(cwd, diff.file);
    const content = await readFile(filePath, "utf8");
    const occurrences = content.split(diff.search).length - 1;
    if (occurrences === 0) {
      return { ok: false, reason: `Pattern not found in ${diff.file}: ${diff.search.slice(0, 60)}` };
    }
    if (occurrences > 1) {
      return { ok: false, reason: `Pattern matches ${occurrences} times in ${diff.file}; require exactly 1` };
    }
    const replaced = content.replace(diff.search, diff.replace);
    await writeFile(filePath, replaced);
  }
  return { ok: true };
}

export async function applyReplace(
  cwd: string,
  oldPkg: string,
  newPkg: string,
  newVersion: string,
  diffs: CodeDiff[],
  opts: ApplyOptions = {},
): Promise<ApplyResult> {
  const pkgPath = join(cwd, "package.json");
  const original = await readFile(pkgPath, "utf8");
  const pkg = JSON.parse(original) as PackageJson;
  const loc = findDepLocation(pkg, oldPkg);
  if (!loc) return { ok: false, reason: `${oldPkg} not in dependencies or devDependencies` };

  delete pkg[loc]![oldPkg];
  pkg[loc]![newPkg] = newVersion;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  if (!opts.skipInstall) {
    const install = await runNpmInstall(cwd);
    if (!install.ok) {
      await writeFile(pkgPath, original);
      return { ok: false, reason: `npm install failed: ${install.stderr.trim().slice(0, 200)}` };
    }
  }
  if (diffs.length > 0) return applyPatchCode(cwd, diffs);
  return { ok: true };
}
