# vulfix — design spec

**Date:** 2026-04-27
**Status:** Draft for review

## Purpose

`vulfix` is a CLI tool, distributed via npm, that scans an npm project for known vulnerabilities and fixes them with help from an LLM. It is a developer-focused, locally-run tool — not a CI gate, not a server.

## Scope (v1)

In scope:

- npm projects only (detected by `package.json` and `package-lock.json`).
- Calling `npm audit` for the vuln list.
- Sending each vuln plus relevant context to a user-configured LLM provider.
- Applying patch/minor version bumps automatically; prompting for major bumps and source-code edits with a unified diff.
- Reporting before/after vuln counts.

Out of scope (v1):

- yarn / pnpm / bun support.
- Custom config file (`.vulfixrc`) — env vars and CLI flags only.
- Telemetry of any kind.
- LLM hosting — the user supplies the API key.
- Lockfile-only fixes that don't pass through `npm install` (no manual `package-lock.json` patching).

## CLI surface

```
npx vulfix              # scan + interactive fix (default)
npx vulfix --dry-run    # scan + print suggestions, apply nothing
npx vulfix --auto       # apply everything, including risky, no prompts
npx vulfix --provider gemini|openai|anthropic|groq
```

Exit codes:

- `0` — no vulnerabilities remain after the run.
- `1` — at least one vulnerability remains, OR the run failed before completion (not a node project, no API key, etc.).

There is intentionally no separate exit code for "user declined" vs "LLM refused" vs "install failed." Devs can read the printed report.

## Architecture

Four modules behind the CLI entry:

1. **Auditor** — wraps `npm audit --json`. Parses the output into a normalized list of vuln records.
2. **Provider** — abstraction over LLM APIs. One interface (`generateFix(context) -> FixResponse`), one implementation per supported provider. Provider chosen by `--provider` flag, otherwise auto-selected by which `*_API_KEY` env var is set (priority: explicit flag > GEMINI > OPENAI > ANTHROPIC > GROQ).
3. **Fixer** — for each vuln: builds the LLM context, calls the provider, parses the response, classifies as safe vs risky, applies or prompts.
4. **Reporter** — re-runs `npm audit` after the fix loop, prints a before/after summary table.

Language: TypeScript, compiled to JavaScript for distribution.

Dependencies (intentionally small): `commander` (arg parsing), `chalk` (color output), `node:readline` (built-in prompts), `node:child_process` (npm invocation). No `inquirer`, no test framework runtime deps in published package.

## LLM contract

### Request context (built per vuln)

```json
{
  "package": "lodash",
  "current_version": "4.17.15",
  "vuln_id": "GHSA-jf85-cpcp-j695",
  "severity": "high",
  "advisory_summary": "Prototype Pollution in lodash",
  "patched_versions": ">=4.17.21",
  "available_versions": ["4.17.20", "4.17.21", "4.17.22"],
  "is_direct_dep": true,
  "found_in_source": [
    { "file": "src/utils.js", "line": 42, "snippet": "_.merge(target, src)" }
  ]
}
```

`found_in_source` is populated only for direct dependencies. The Fixer greps the project source for `import`/`require` of the vulnerable package, excluding `node_modules` and any path matched by `.gitignore` (if present). Up to 5 matching call sites are included, each with 2 lines of surrounding context. Transitive deps skip this step (too noisy, rarely actionable).

### Response shape (LLM is required to return this exactly)

```json
{
  "action": "bump" | "replace" | "patch_code" | "none",
  "target_version": "4.17.21",
  "replacement_package": null,
  "code_diffs": [
    { "file": "src/utils.js", "search": "_.merge(target, src)", "replace": "_.mergeWith(target, src, customizer)" }
  ],
  "risk": "safe" | "risky",
  "explanation": "Lodash 4.17.21 patches the prototype pollution. No code changes required."
}
```

System prompt instructs the LLM to:

- Prefer `bump` to the smallest patched version.
- Mark `risk: safe` only when the major version does not change AND no source edits are needed.
- Use `patch_code` only if a major bump introduces a breaking change the user actually hits in `found_in_source`.
- Use `none` if no safe fix exists; explain why.

### Parse handling

- Unparseable JSON → retry once with a stricter "return ONLY valid JSON, no prose" prompt → if that fails, mark vuln as skipped, continue.

## Fix application

Per vuln, after a successful LLM response:

| action | risk | behavior in default mode | behavior in `--dry-run` | behavior in `--auto` |
|---|---|---|---|---|
| `bump` | safe | apply silently | print suggestion | apply |
| `bump` | risky | show diff, prompt y/N | print suggestion | apply |
| `replace` | always risky | show diff, prompt y/N | print suggestion | apply |
| `patch_code` | always risky | show diff, prompt y/N | print suggestion | apply |
| `none` | n/a | log "LLM declined", continue | log | log |

Apply mechanics:

- **`bump`**: edit `package.json` to pin the new version range, run `npm install`. On install failure, restore `package.json` from in-memory backup and mark the vuln as failed.
- **`replace`**: `npm uninstall <old>`, `npm install <new>`, then apply the `code_diffs` exactly as `patch_code`.
- **`patch_code`**: each diff is applied as a literal find-and-replace on the named file. If `search` is not found exactly once, the diff is skipped and the vuln marked failed (no fuzzy matching in v1).

## First-run UX

Run with no API key configured:

```
vulfix needs an LLM provider key. Set one of:
  GEMINI_API_KEY    (recommended — free tier at ai.google.dev)
  OPENAI_API_KEY
  ANTHROPIC_API_KEY
  GROQ_API_KEY
Then re-run vulfix. (vulfix never sends your code anywhere except the LLM you choose.)
```

Exit 1.

First successful run prints a one-paragraph privacy notice — audit data and matched source snippets get sent to the chosen LLM, nothing else leaves the machine. A marker file in the OS-appropriate user cache directory (resolved via `process.env.XDG_CACHE_HOME` on Linux, `~/Library/Caches` on macOS, `%LOCALAPPDATA%` on Windows; falling back to `os.homedir() + '/.cache'`) suppresses the notice on subsequent runs.

## Error handling

Only the cases that actually occur:

- Not in a node project (`package.json` missing) → friendly error, exit 1.
- `npm audit` exits non-zero for reasons other than "found vulns" (e.g., network failure, registry unreachable) → print the underlying error, exit 1.
- LLM API 4xx/5xx/network failure → log the vuln as skipped, continue with the rest of the loop.
- LLM JSON parse failure → one retry with stricter prompt, then skip.
- `npm install` failure after a bump → restore `package.json`, mark vuln as failed, continue.
- `patch_code` `search` string not found exactly once → skip diff, mark vuln failed.

No defensive try/catch around things that cannot fail. No fallback "default fix" if the LLM is unreachable.

## Reporting

After the fix loop, re-run `npm audit --json` and print:

```
vulfix summary
──────────────
Before: 12 vulns (3 high, 7 moderate, 2 low)
After:   2 vulns (0 high, 1 moderate, 1 low)

Fixed:    8
Skipped:  2 (LLM declined)
Failed:   0
Declined: 0 (user said no)
```

Plus a per-vuln list with one line each (package, action taken, outcome).

## Testing

- **Unit tests** with mocked `npm audit` JSON fixtures (a handful of real audit outputs snapshotted into `test/fixtures/audit/`) and a fake LLM provider that returns canned responses. Covers parse → classify → apply pipeline deterministically.
- **One integration test** against a tiny fixture project at `test/fixtures/vulnerable-app/` with pinned old versions of known-vuln packages, using the fake provider end-to-end.
- **No live LLM tests** — flaky and costs money.

Test runner: `node:test` (built-in), no Jest/Vitest dep.

## Distribution

- Published to npm registry as `vulfix` (registry availability to be confirmed before first publish — fallback names: `vulfix-cli`, `npm-vulfix`).
- Single `bin` entry in `package.json` so `npx vulfix` works without global install.
- Build output in `dist/`, source in `src/`. `.npmignore` excludes `src/`, `test/`, `tsconfig.json`.

## Open questions for implementation phase

None blocking — the design above is what to build. Questions that may surface during implementation (e.g., exact prompt wording, concrete model IDs per provider) are implementation details, not design decisions.
