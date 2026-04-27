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
