# vulfix

> Scan and fix npm vulnerabilities with help from an LLM.

[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

`vulfix` wraps `npm audit`, sends each vulnerability to an LLM of your choice (Gemini, OpenAI, Anthropic, or Groq), and applies the recommended fix. Safe fixes (patch/minor bumps) apply automatically; risky fixes (major bumps, code edits) show you a diff and ask for confirmation before touching your code.

It's a developer-focused tool — locally run, BYO API key, no telemetry.

---

## Why

`npm audit fix` only handles the easy cases. The hard ones — major-version bumps that break your code, advisories with no automatic fix, transitive dep tangles — get left for you. `vulfix` asks an LLM to read the advisory, look at how you actually use the package, and propose a fix. You stay in control: anything that touches source code or jumps a major version asks for your confirmation first.

## Install

```bash
npm install -g vulfix
# or run without installing:
npx vulfix
```

## Setup

Set one provider API key. `vulfix` auto-selects the first one it finds, in this order: Gemini, OpenAI, Anthropic, Groq.

```bash
export GEMINI_API_KEY=...      # recommended — free tier at ai.google.dev
# or
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
export GROQ_API_KEY=...
```

Override the auto-selection with `--provider`.

## Usage

```bash
npx vulfix                  # scan + interactive fix (default)
npx vulfix --dry-run        # scan + print suggestions, apply nothing
npx vulfix --auto           # apply everything, no prompts (use carefully)
npx vulfix --provider openai
```

### Example

```
$ npx vulfix
Found 3 vulnerabilities. Using provider: gemini.
  lodash (high)... fixed
  semver (moderate)... fixed
  minimatch (low)... declined-by-user

vulfix summary
──────────────
Before: 3 vulns (0 critical, 1 high, 1 moderate, 1 low)
After:  1 vulns (0 critical, 0 high, 0 moderate, 1 low)

Fixed:    2
Skipped:  0
Failed:   0
Declined: 1 (user) + 0 (LLM)
```

## How it works

1. Runs `npm audit --json` to find vulnerabilities.
2. For each vuln, builds a structured context (advisory, severity, available versions, and — for direct deps — actual call sites in your source).
3. Sends the context to the LLM with a strict JSON schema for the response.
4. Classifies the response: safe fixes (patch/minor bumps) are applied automatically. Risky fixes (major bumps, code edits, package replacements) show you a diff and prompt for confirmation.
5. Re-runs `npm audit` and prints a before/after summary.

## Privacy

`vulfix` sends each vulnerability's audit data and matched source snippets to the LLM provider **you** configure. Nothing else leaves your machine. No telemetry, no analytics, no remote logging. The first run prints a one-time privacy notice listing exactly what gets sent and to whom.

## Exit codes

- `0` — no vulnerabilities remain after the run.
- `1` — vulnerabilities remain, or the run failed (no API key, not a node project, audit failed, etc.).

## Supported providers

| Provider | Default model | Free tier |
|---|---|---|
| Gemini | `gemini-2.0-flash` | Yes — generous free tier at [ai.google.dev](https://ai.google.dev) |
| OpenAI | `gpt-4o-mini` | No |
| Anthropic | `claude-haiku-4-5` | No |
| Groq | `llama-3.3-70b-versatile` | Yes — free tier at [console.groq.com](https://console.groq.com) |

## Limitations

`vulfix` is v0.1 and intentionally narrow. Things it doesn't do (yet):

- yarn / pnpm support (npm only for now).
- Custom config file — env vars and CLI flags only.
- Print suggested fixes during `--dry-run` (currently only counts them — see [#TODO](#contributing) below).
- CI gating beyond basic exit codes.

If you want any of these, [PRs are welcome](#contributing).

---

## Contributing

**PRs are very welcome.** This tool is small, focused, and easy to extend — a great project to contribute to if you're getting into open-source.

### Good first issues

Pick one of these and open a PR. Each is bounded, tested, and a real improvement:

- **Print LLM suggestions in `--dry-run` mode.** Currently dry-run discards the LLM's `explanation`, `targetVersion`, and `codeDiffs`. Surface them. (Touches `src/fixer.ts` and `src/cli.ts`.)
- **Add yarn / pnpm support.** Detect lockfile, call the right audit command, normalize the output. (New module + branching in `src/auditor.ts`.)
- **Wrap the second `npm audit` in `cli.ts` with try/catch** so a network hiccup at the end doesn't lose the fix-summary table.
- **Make `selectProvider` return a distinct error for "invalid provider name" vs "no key set"** so the CLI error message can be more helpful.
- **Add a multi-vuln integration test** with mixed outcomes (fixed, declined, failed) — exercises the fixer loop end-to-end.
- **Verify Anthropic model ID** against the live model list (`claude-haiku-4-5-20251001` may need updating).
- **Add a `--config <path>` flag** for projects that want to pin a provider/model without exporting env vars.

Want to tackle something bigger? Open an issue first to talk through the design.

### Dev setup

```bash
git clone https://github.com/AymenSakouhi/VulFix.git
cd VulFix
npm install
npm test          # 31 tests, ~250ms
npm run build     # compile src/ → dist/
```

You'll need **Node 20+**.

### Project layout

```
src/
  cli.ts           commander entry, --dry-run / --auto / --provider, exit codes
  types.ts         Vuln, FixContext, FixResponse, FixOutcome, RunMode
  auditor.ts       npm audit JSON parser + runner
  source-grep.ts   find import/require sites, .gitignore-aware, 5-match cap
  providers/       gemini, openai (also Groq), anthropic + selection + shared prompt
  applier.ts       bump (with rollback), patch_code (exact-match-once), replace
  fixer.ts         per-vuln orchestration, retry-on-SyntaxError with stricter prompt
  reporter.ts      before/after summary
  privacy.ts       first-run notice + OS-aware cache marker
test/
  fixtures/        sample npm audit JSON + a mock vulnerable app
  helpers/         fake provider for deterministic tests
  *.test.ts        one test file per src/ module + an integration test
docs/
  superpowers/specs/    design spec
  superpowers/plans/    implementation plan (TDD, task-by-task)
```

### Conventions

- **TDD.** Every feature starts with a failing test. Look at any `test/*.test.ts` for the pattern.
- **No mocks of the npm registry or LLM APIs in unit tests.** Use the fixtures in `test/fixtures/` and the fake provider in `test/helpers/fake-provider.ts`.
- **Conventional commits.** `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`.
- **Small, focused changes.** One concern per PR. If you find adjacent issues, open a separate PR or issue.
- **No new runtime dependencies** without a strong reason — this is a security tool, dep count matters.
- **Comments are rare.** Code should be self-explanatory; comment only the non-obvious *why*.

### Submitting a PR

1. Fork and create a feature branch (`git checkout -b feat/your-thing`).
2. Make your changes with tests. Run `npm test` and `npm run build` — both must pass.
3. Commit with conventional-commits style.
4. Open a PR against `main` with:
   - What changed and why
   - How you tested it (unit / integration / manual)
   - Any limitations or follow-ups

Code review will focus on correctness, test coverage, and whether the change fits the design philosophy in `docs/superpowers/specs/`. Don't be shy — first-time PRs get the same treatment as any other.

### Reporting bugs

Open a GitHub issue with:

- `vulfix` version (`npx vulfix --version` once that flag exists, or git SHA otherwise)
- Node version (`node --version`)
- The provider you used
- A minimal `package.json` that reproduces the issue (or a link to the affected repo)
- The full `vulfix` output

If the bug involves an LLM response that broke the fix flow, paste the response so we can add it as a test fixture.

---

## License

MIT — see [LICENSE](LICENSE) (or treat as MIT until that file lands).

---

Built with help from Claude Code. The full design spec and implementation plan are in `docs/superpowers/` if you're curious how it was designed.
