import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hasSeenNotice, markNoticeSeen, getNoticeText } from "../src/privacy.ts";

test("hasSeenNotice false before mark, true after", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vulfix-priv-"));
  try {
    assert.equal(await hasSeenNotice(dir), false);
    await markNoticeSeen(dir);
    assert.equal(await hasSeenNotice(dir), true);
    await access(join(dir, "seen-notice"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("getNoticeText mentions LLM provider", () => {
  const text = getNoticeText("gemini");
  assert.match(text, /gemini/i);
  assert.match(text, /audit data/i);
});
