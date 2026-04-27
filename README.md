# vulfix

Scan and fix npm vulnerabilities with help from an LLM.

## Install

```bash
npm install -g vulfix
# or run without installing:
npx vulfix
```

## Setup

Set one provider API key:

```bash
export GEMINI_API_KEY=...      # recommended — free tier at ai.google.dev
# or OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY
```

## Usage

```bash
npx vulfix              # scan + interactive fix
npx vulfix --dry-run    # scan + print suggestions, apply nothing
npx vulfix --auto       # apply everything, no prompts
npx vulfix --provider openai
```

## How it works

1. Runs `npm audit --json` to find vulns.
2. For each vuln, sends a structured payload to your chosen LLM.
3. Applies safe fixes (patch/minor bumps) automatically.
4. Shows a unified diff and prompts for risky fixes (major bumps, code edits).
5. Re-runs `npm audit` and prints a before/after summary.

## Privacy

Audit data and matched source snippets get sent to the LLM provider you choose. Nothing else leaves your machine. No telemetry.

## Exit codes

- `0` — no vulnerabilities remain.
- `1` — vulnerabilities remain or the run failed.

## License

MIT
