import type { FixOutcome } from "./types.ts";

interface AuditCounts { low: number; moderate: number; high: number; critical: number; total: number; }

function fmt(c: AuditCounts): string {
  return `${c.total} vulns (${c.critical} critical, ${c.high} high, ${c.moderate} moderate, ${c.low} low)`;
}

export function renderSummary(before: AuditCounts, after: AuditCounts, outcomes: FixOutcome[]): string {
  const counts = {
    fixed: outcomes.filter((o) => o.kind === "fixed").length,
    skipped: outcomes.filter((o) => o.kind === "skipped").length,
    failed: outcomes.filter((o) => o.kind === "failed").length,
    declinedByUser: outcomes.filter((o) => o.kind === "declined-by-user").length,
    declinedByLlm: outcomes.filter((o) => o.kind === "declined-by-llm").length,
  };
  const lines = [
    "vulfix summary",
    "──────────────",
    `Before: ${fmt(before)}`,
    `After:  ${fmt(after)}`,
    "",
    `Fixed:    ${counts.fixed}`,
    `Skipped:  ${counts.skipped}`,
    `Failed:   ${counts.failed}`,
    `Declined: ${counts.declinedByUser} (user) + ${counts.declinedByLlm} (LLM)`,
    "",
  ];
  for (const o of outcomes) {
    const tag = o.kind === "fixed" ? `fixed (${o.action})` : o.kind;
    const detail = "reason" in o ? ` — ${o.reason}` : "";
    lines.push(`  - ${o.vuln.package}: ${tag}${detail}`);
  }
  return lines.join("\n");
}
