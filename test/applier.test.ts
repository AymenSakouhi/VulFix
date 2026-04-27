import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyBump } from "../src/applier.ts";

async function makeProject(deps: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vulfix-test-"));
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: "x", version: "0.0.0", dependencies: deps }, null, 2));
  return dir;
}

test("applyBump rewrites the dependency version (skipInstall mode)", async () => {
  const dir = await makeProject({ lodash: "4.17.15" });
  try {
    const result = await applyBump(dir, "lodash", "4.17.21", { skipInstall: true });
    assert.equal(result.ok, true);
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    assert.equal(pkg.dependencies.lodash, "4.17.21");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("applyBump returns failure when package not in deps", async () => {
  const dir = await makeProject({ lodash: "4.17.15" });
  try {
    const result = await applyBump(dir, "missing-pkg", "1.0.0", { skipInstall: true });
    assert.equal(result.ok, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
