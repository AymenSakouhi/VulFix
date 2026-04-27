import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import type { ProviderName } from "./providers/index.ts";

function defaultCacheDir(): string {
  if (platform() === "win32") {
    return process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
  }
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Caches");
  }
  return process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
}

export function noticeDir(): string {
  return join(defaultCacheDir(), "vulfix");
}

export async function hasSeenNotice(dir: string = noticeDir()): Promise<boolean> {
  try {
    await access(join(dir, "seen-notice"));
    return true;
  } catch {
    return false;
  }
}

export async function markNoticeSeen(dir: string = noticeDir()): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "seen-notice"), new Date().toISOString());
}

export function getNoticeText(providerName: ProviderName): string {
  return `vulfix sends each vulnerability's audit data and matched source snippets to ${providerName}. Nothing else leaves your machine. This notice is shown once.`;
}
