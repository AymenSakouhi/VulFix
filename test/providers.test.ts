import { test } from "node:test";
import assert from "node:assert/strict";
import { selectProvider } from "../src/providers/index.ts";

test("selectProvider honors explicit name when key present", () => {
  const env = { OPENAI_API_KEY: "x", GEMINI_API_KEY: "y" };
  assert.equal(selectProvider("openai", env).name, "openai");
});

test("selectProvider auto-picks Gemini first", () => {
  const env = { GEMINI_API_KEY: "g", OPENAI_API_KEY: "o" };
  assert.equal(selectProvider(undefined, env).name, "gemini");
});

test("selectProvider falls through priority order", () => {
  assert.equal(selectProvider(undefined, { OPENAI_API_KEY: "x" }).name, "openai");
  assert.equal(selectProvider(undefined, { ANTHROPIC_API_KEY: "x" }).name, "anthropic");
  assert.equal(selectProvider(undefined, { GROQ_API_KEY: "x" }).name, "groq");
});

test("selectProvider returns null when no key set", () => {
  assert.equal(selectProvider(undefined, {}), null);
});

test("selectProvider returns null when explicit choice has no key", () => {
  assert.equal(selectProvider("openai", { GEMINI_API_KEY: "g" }), null);
});

import { createProvider } from "../src/providers/index.ts";

test("Gemini provider parses a well-formed JSON response", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [{
          content: { parts: [{ text: '{"action":"bump","targetVersion":"4.17.21","replacementPackage":null,"codeDiffs":[],"risk":"safe","explanation":"patched"}' }] },
        }],
      }),
      { status: 200 },
    );
  t.after(() => { globalThis.fetch = originalFetch; });

  const provider = createProvider({ name: "gemini", apiKey: "test-key" });
  const result = await provider.generateFix({
    package: "lodash",
    currentVersion: "<4.17.21",
    vulnId: "GHSA-x",
    severity: "high",
    advisorySummary: "test",
    patchedVersions: ">=4.17.21",
    availableVersions: ["4.17.21"],
    isDirectDep: true,
    foundInSource: [],
  });
  assert.equal(result.action, "bump");
  assert.equal(result.targetVersion, "4.17.21");
  assert.equal(result.risk, "safe");
});

test("OpenAI provider parses a well-formed JSON response", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{
          message: { content: '{"action":"bump","targetVersion":"4.17.21","replacementPackage":null,"codeDiffs":[],"risk":"safe","explanation":"ok"}' },
        }],
      }),
      { status: 200 },
    );
  t.after(() => { globalThis.fetch = originalFetch; });

  const provider = createProvider({ name: "openai", apiKey: "test-key" });
  const result = await provider.generateFix({
    package: "lodash", currentVersion: "<4.17.21", vulnId: "GHSA-x",
    severity: "high", advisorySummary: "test", patchedVersions: ">=4.17.21",
    availableVersions: ["4.17.21"], isDirectDep: true, foundInSource: [],
  });
  assert.equal(result.action, "bump");
  assert.equal(result.risk, "safe");
});

test("Anthropic provider parses a well-formed JSON response", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        content: [{ type: "text", text: '{"action":"bump","targetVersion":"4.17.21","replacementPackage":null,"codeDiffs":[],"risk":"safe","explanation":"ok"}' }],
      }),
      { status: 200 },
    );
  t.after(() => { globalThis.fetch = originalFetch; });

  const provider = createProvider({ name: "anthropic", apiKey: "test-key" });
  const result = await provider.generateFix({
    package: "lodash", currentVersion: "<4.17.21", vulnId: "GHSA-x",
    severity: "high", advisorySummary: "test", patchedVersions: ">=4.17.21",
    availableVersions: ["4.17.21"], isDirectDep: true, foundInSource: [],
  });
  assert.equal(result.action, "bump");
});
