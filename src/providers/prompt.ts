import type { FixResponse } from "../types.ts";

export function buildSystemPrompt(strict?: boolean): string {
  const prefix = strict
    ? `CRITICAL: return ONLY valid JSON. No prose, no markdown fences, no explanations outside the JSON object. If you cannot produce valid JSON, return {"action":"none","targetVersion":null,"replacementPackage":null,"codeDiffs":[],"risk":"safe","explanation":"could not generate fix"}.\n\n`
    : "";
  return `${prefix}You are a security-fix assistant. Given a JSON object describing one npm vulnerability,
return ONLY a JSON object matching this schema (no prose, no markdown fences):

{
  "action": "bump" | "replace" | "patch_code" | "none",
  "targetVersion": string | null,
  "replacementPackage": string | null,
  "codeDiffs": [ { "file": string, "search": string, "replace": string } ],
  "risk": "safe" | "risky",
  "explanation": string
}

Rules:
- Prefer "bump" to the smallest version in availableVersions that satisfies patchedVersions.
- Mark risk:"safe" only when the major version does NOT change AND no source edits are needed.
- Use "patch_code" only if a major bump introduces a breaking change visible in foundInSource.
- Use "none" only if no safe fix is known; explain why.
- "search" strings in codeDiffs must match the file's text EXACTLY (whitespace included).`;
}

export function parseFixResponse(text: string): FixResponse {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    action: parsed.action,
    targetVersion: parsed.targetVersion ?? null,
    replacementPackage: parsed.replacementPackage ?? null,
    codeDiffs: parsed.codeDiffs ?? [],
    risk: parsed.risk,
    explanation: parsed.explanation ?? "",
  };
}
