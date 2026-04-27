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

import { applyPatchCode } from "../src/applier.ts";

test("applyPatchCode replaces a unique snippet", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vulfix-test-"));
  try {
    await writeFile(join(dir, "a.js"), "before\nx = old()\nafter\n");
    const result = await applyPatchCode(dir, [{ file: "a.js", search: "x = old()", replace: "x = newApi()" }]);
    assert.equal(result.ok, true);
    const content = await readFile(join(dir, "a.js"), "utf8");
    assert.equal(content, "before\nx = newApi()\nafter\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("applyPatchCode fails when search appears zero times", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vulfix-test-"));
  try {
    await writeFile(join(dir, "a.js"), "before\nafter\n");
    const result = await applyPatchCode(dir, [{ file: "a.js", search: "missing", replace: "anything" }]);
    assert.equal(result.ok, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("applyPatchCode fails when search appears more than once", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vulfix-test-"));
  try {
    await writeFile(join(dir, "a.js"), "dup\ndup\n");
    const result = await applyPatchCode(dir, [{ file: "a.js", search: "dup", replace: "uniq" }]);
    assert.equal(result.ok, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

import { applyReplace } from "../src/applier.ts";

test("applyReplace swaps dep entries (skipInstall mode)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vulfix-test-"));
  try {
    await writeFile(join(dir, "package.json"), JSON.stringify({
      name: "x", version: "0.0.0", dependencies: { "old-pkg": "1.0.0" },
    }, null, 2));
    const result = await applyReplace(dir, "old-pkg", "new-pkg", "2.0.0", [], { skipInstall: true });
    assert.equal(result.ok, true);
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    assert.equal(pkg.dependencies["old-pkg"], undefined);
    assert.equal(pkg.dependencies["new-pkg"], "2.0.0");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
