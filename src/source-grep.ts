import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { SourceMatch } from "./types.ts";

const MAX_MATCHES = 5;
const SCANNABLE_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
const HARD_SKIP = new Set(["node_modules", ".git", "dist", "build", "coverage"]);

async function loadGitignore(root: string): Promise<string[]> {
  try {
    const content = await readFile(join(root, ".gitignore"), "utf8");
    return content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    return [];
  }
}

function isIgnored(relPath: string, patterns: string[]): boolean {
  for (const p of patterns) {
    const normalized = p.replace(/^\//, "").replace(/\/$/, "");
    if (relPath === normalized || relPath.startsWith(normalized + "/")) return true;
  }
  return false;
}

async function* walk(root: string, current: string, ignore: string[]): AsyncGenerator<string> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(current, entry.name);
    const rel = relative(root, full).replace(/\\/g, "/");
    if (HARD_SKIP.has(entry.name)) continue;
    if (isIgnored(rel, ignore)) continue;
    if (entry.isDirectory()) {
      yield* walk(root, full, ignore);
    } else if (SCANNABLE_EXTS.has("." + entry.name.split(".").pop())) {
      yield full;
    }
  }
}

export async function findUsages(pkg: string, root: string): Promise<SourceMatch[]> {
  const ignore = await loadGitignore(root);
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const importRe = new RegExp(`(?:require\\(['"\`]${escaped}['"\`]\\)|from\\s+['"\`]${escaped}['"\`])`);
  const matches: SourceMatch[] = [];
  for await (const file of walk(root, root, ignore)) {
    if (matches.length >= MAX_MATCHES) break;
    const content = await readFile(file, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (importRe.test(lines[i])) {
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        matches.push({
          file: relative(root, file).replace(/\\/g, "/"),
          line: i + 1,
          snippet: lines.slice(start, end).join("\n"),
        });
        if (matches.length >= MAX_MATCHES) break;
      }
    }
  }
  return matches;
}
