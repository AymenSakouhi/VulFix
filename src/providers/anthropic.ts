import type { Provider } from "./index.ts";
import type { FixContext, FixResponse } from "../types.ts";
import { buildSystemPrompt, parseFixResponse } from "./prompt.ts";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

export function createAnthropicProvider(apiKey: string): Provider {
  return {
    name: "anthropic",
    async generateFix(context: FixContext, options?: { strict?: boolean }): Promise<FixResponse> {
      const body = {
        model: MODEL,
        max_tokens: 2048,
        system: buildSystemPrompt(options?.strict),
        messages: [{ role: "user", content: JSON.stringify(context) }],
        temperature: 0,
      };
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { content: { type: string; text: string }[] };
      const textBlock = data.content.find((b) => b.type === "text");
      if (!textBlock) throw new Error("Anthropic returned no text block");
      return parseFixResponse(textBlock.text);
    },
  };
}
