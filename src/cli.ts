#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runNpmAudit, parseAuditJson, summarizeAudit } from "./auditor.ts";
import { selectProvider, createProvider, PROVIDER_ENV } from "./providers/index.ts";
import { fixVuln } from "./fixer.ts";
import { renderSummary } from "./reporter.ts";
import { hasSeenNotice, markNoticeSeen, getNoticeText } from "./privacy.ts";
import type { FixOutcome, FixResponse, Vuln } from "./types.ts";

async function confirmRisky(response: FixResponse, vuln: Vuln): Promise<boolean> {
  const rl = createInterface({ input: stdin, output: stdout });
  const diffPreview = response.codeDiffs
    .map((d) => `  ${d.file}:\n    - ${d.search}\n    + ${d.replace}`)
    .join("\n");
  console.log(chalk.yellow(`\nRisky fix for ${vuln.package} (${vuln.severity}): ${response.action}`));
  if (response.targetVersion) console.log(`  target version: ${response.targetVersion}`);
  if (response.replacementPackage) console.log(`  replacement: ${response.replacementPackage}`);
  if (diffPreview) console.log(diffPreview);
  console.log(chalk.gray(response.explanation));
  const answer = await rl.question("Apply this fix? [y/N] ");
  rl.close();
  return /^y/i.test(answer.trim());
}

async function main(): Promise<void> {
  const program = new Command()
    .name("vulfix")
    .description("Scan and fix npm vulnerabilities with help from an LLM.")
    .option("--dry-run", "scan and report; apply nothing", false)
    .option("--auto", "apply all fixes including risky, no prompts", false)
    .option("--provider <name>", "gemini | openai | anthropic | groq")
    .parse(process.argv);
  const opts = program.opts<{ dryRun: boolean; auto: boolean; provider?: string }>();

  const stub = selectProvider(opts.provider, process.env);
  if (!stub) {
    console.error(chalk.red("vulfix needs an LLM provider key. Set one of:"));
    for (const [name, env] of Object.entries(PROVIDER_ENV)) {
      const note = name === "gemini" ? "  (recommended — free tier at ai.google.dev)" : "";
      console.error(`  ${env}${note}`);
    }
    console.error("Then re-run vulfix. (vulfix never sends your code anywhere except the LLM you choose.)");
    process.exit(1);
  }

  if (!(await hasSeenNotice())) {
    console.log(chalk.cyan(getNoticeText(stub.name)));
    await markNoticeSeen();
  }

  const cwd = process.cwd();
  let beforeRaw: string;
  try {
    beforeRaw = await runNpmAudit(cwd);
  } catch (err) {
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
  const before = summarizeAudit(beforeRaw);
  const vulns = parseAuditJson(beforeRaw);
  if (vulns.length === 0) {
    console.log(chalk.green("No vulnerabilities found."));
    process.exit(0);
  }

  console.log(`Found ${vulns.length} vulnerabilities. Using provider: ${stub.name}.`);
  const provider = createProvider(stub);
  const outcomes: FixOutcome[] = [];
  for (const vuln of vulns) {
    process.stdout.write(`  ${vuln.package} (${vuln.severity})... `);
    const outcome = await fixVuln(vuln, cwd, provider, { dryRun: opts.dryRun, auto: opts.auto }, confirmRisky);
    outcomes.push(outcome);
    console.log(outcome.kind);
  }

  const afterRaw = await runNpmAudit(cwd);
  const after = summarizeAudit(afterRaw);
  console.log("\n" + renderSummary(before, after, outcomes));

  process.exit(after.total === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(chalk.red(err instanceof Error ? err.stack : String(err)));
  process.exit(1);
});
