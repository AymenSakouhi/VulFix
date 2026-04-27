import { spawn } from "node:child_process";
import type { Vuln, Severity } from "./types.ts";

interface AuditAdvisory {
  source: number;
  url?: string;
  title?: string;
  range?: string;
}

interface AuditEntry {
  name: string;
  severity: Severity;
  isDirect: boolean;
  via: (string | AuditAdvisory)[];
  range: string;
  fixAvailable: false | { name: string; version: string; isSemVerMajor: boolean };
}

interface AuditReport {
  vulnerabilities: Record<string, AuditEntry>;
  metadata: {
    vulnerabilities: { low: number; moderate: number; high: number; critical: number; total: number };
  };
}

export function parseAuditJson(raw: string): Vuln[] {
  const report = JSON.parse(raw) as AuditReport;
  const vulns: Vuln[] = [];
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    const advisory = entry.via.find((v): v is AuditAdvisory => typeof v === "object");
    if (!advisory) continue;
    const ghsaMatch = advisory.url?.match(/GHSA-[a-z0-9-]+/i);
    const fix = entry.fixAvailable && typeof entry.fixAvailable === "object" ? entry.fixAvailable : null;
    vulns.push({
      package: name,
      currentVersion: entry.range,
      vulnId: ghsaMatch ? ghsaMatch[0] : `audit-${advisory.source}`,
      severity: entry.severity,
      advisorySummary: advisory.title ?? "",
      patchedVersions: fix ? `>=${fix.version}` : "",
      isDirectDep: entry.isDirect,
    });
  }
  return vulns;
}

export function summarizeAudit(raw: string) {
  const report = JSON.parse(raw) as AuditReport;
  const m = report.metadata.vulnerabilities;
  return { low: m.low, moderate: m.moderate, high: m.high, critical: m.critical, total: m.total };
}

export async function runNpmAudit(cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("npm", ["audit", "--json"], { cwd, shell: true });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", (code) => {
      try {
        JSON.parse(stdout);
        resolve(stdout);
      } catch {
        reject(new Error(`npm audit failed (exit ${code}): ${stderr || stdout}`));
      }
    });
    proc.on("error", reject);
  });
}
