import type { FixContext, FixResponse } from "../types.ts";
import { createGeminiProvider } from "./gemini.ts";

export interface Provider {
  name: ProviderName;
  generateFix(context: FixContext): Promise<FixResponse>;
}

export type ProviderName = "gemini" | "openai" | "anthropic" | "groq";

export const PROVIDER_ENV: Record<ProviderName, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
};

const PRIORITY: ProviderName[] = ["gemini", "openai", "anthropic", "groq"];

export interface ProviderStub {
  name: ProviderName;
  apiKey: string;
}

export function selectProvider(
  explicit: string | undefined,
  env: Record<string, string | undefined>,
): ProviderStub | null {
  if (explicit) {
    const name = explicit as ProviderName;
    if (!PROVIDER_ENV[name]) return null;
    const key = env[PROVIDER_ENV[name]];
    return key ? { name, apiKey: key } : null;
  }
  for (const name of PRIORITY) {
    const key = env[PROVIDER_ENV[name]];
    if (key) return { name, apiKey: key };
  }
  return null;
}

export function createProvider(stub: ProviderStub): Provider {
  switch (stub.name) {
    case "gemini": return createGeminiProvider(stub.apiKey);
    default: throw new Error(`Provider not implemented: ${stub.name}`);
  }
}
