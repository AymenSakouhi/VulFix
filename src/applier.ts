import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

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
