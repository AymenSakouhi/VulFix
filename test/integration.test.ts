import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseAuditJson } from "../src/auditor.ts";
import { fixVuln } from "../src/fixer.ts";
import { fakeProvider } from "./helpers/fake-provider.ts";
import type { FixOutcome } from "../src/types.ts";

test("end-to-end: parse audit + apply bump for each direct vuln", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vulfix-int-"));
  try {
    await writeFile(join(dir, "package.json"), JSON.stringify({
      name: "int-test", version: "0.0.0", dependencies: { lodash: "4.17.15" },
    }, null, 2));
    const auditRaw = await readFile("test/fixtures/audit/lodash-vuln.json", "utf8");
    const vulns = parseAuditJson(auditRaw);
    assert.equal(vulns.length, 1);

    const provider = fakeProvider({
      action: "bump", targetVersion: "4.17.21", replacementPackage: null,
      codeDiffs: [], risk: "safe", explanation: "patched",
    });

    const outcomes: FixOutcome[] = [];
    for (const v of vulns) {
      const outcome = await fixVuln(v, dir, provider, { dryRun: false, auto: true }, async () => true, { skipInstall: true });
      outcomes.push(outcome);
    }
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].kind, "fixed");
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    assert.equal(pkg.dependencies.lodash, "4.17.21");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
