import { test } from "node:test";
import assert from "node:assert/strict";
import { findUsages } from "../src/source-grep.ts";

test("findUsages locates require() of a package", async () => {
  const matches = await findUsages("lodash", "test/fixtures/vulnerable-app");
  assert.equal(matches.length >= 1, true);
  assert.equal(matches[0].file.endsWith("utils.js"), true);
  assert.equal(matches[0].snippet.includes("require"), true);
});

test("findUsages skips node_modules", async () => {
  const matches = await findUsages("lodash", "test/fixtures/vulnerable-app");
  assert.equal(matches.every((m) => !m.file.includes("node_modules")), true);
});

test("findUsages caps results at 5", async () => {
  const matches = await findUsages("lodash", "test/fixtures/vulnerable-app");
  assert.equal(matches.length <= 5, true);
});
