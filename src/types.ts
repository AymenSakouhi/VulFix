export type Severity = "low" | "moderate" | "high" | "critical";

export interface Vuln {
  package: string;
  currentVersion: string;
  vulnId: string;
  severity: Severity;
  advisorySummary: string;
  patchedVersions: string;
  isDirectDep: boolean;
}

export interface SourceMatch {
  file: string;
  line: number;
  snippet: string;
}

export interface FixContext {
  package: string;
  currentVersion: string;
  vulnId: string;
  severity: Severity;
  advisorySummary: string;
  patchedVersions: string;
  availableVersions: string[];
  isDirectDep: boolean;
  foundInSource: SourceMatch[];
}

export type FixAction = "bump" | "replace" | "patch_code" | "none";
export type FixRisk = "safe" | "risky";

export interface CodeDiff {
  file: string;
  search: string;
  replace: string;
}

export interface FixResponse {
  action: FixAction;
  targetVersion: string | null;
  replacementPackage: string | null;
  codeDiffs: CodeDiff[];
  risk: FixRisk;
  explanation: string;
}

export type FixOutcome =
  | { kind: "fixed"; vuln: Vuln; action: FixAction }
  | { kind: "declined-by-user"; vuln: Vuln }
  | { kind: "declined-by-llm"; vuln: Vuln; reason: string }
  | { kind: "skipped"; vuln: Vuln; reason: string }
  | { kind: "failed"; vuln: Vuln; reason: string };

export interface RunMode {
  dryRun: boolean;
  auto: boolean;
}
