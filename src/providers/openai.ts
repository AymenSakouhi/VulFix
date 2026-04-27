import type { Provider, ProviderName } from "./index.ts";
import type { FixContext, FixResponse } from "../types.ts";
import { buildSystemPrompt, parseFixResponse } from "./prompt.ts";

interface Config { endpoint: string; model: string; name: ProviderName; }

const OPENAI_CFG: Config = {
  endpoint: "https://api.openai.com/v1/chat/completions",
  model: "gpt-4o-mini",
  name: "openai",
};
const GROQ_CFG: Config = {
  endpoint: "https://api.groq.com/openai/v1/chat/completions",
  model: "llama-3.3-70b-versatile",
  name: "groq",
};

function createCompatProvider(apiKey: string, cfg: Config): Provider {
  return {
    name: cfg.name,
    async generateFix(context: FixContext): Promise<FixResponse> {
      const body = {
        model: cfg.model,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: JSON.stringify(context) },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      };
      const res = await fetch(cfg.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${cfg.name} API error ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      return parseFixResponse(data.choices[0].message.content);
    },
  };
}

export function createOpenAIProvider(apiKey: string): Provider {
  return createCompatProvider(apiKey, OPENAI_CFG);
}

export function createGroqProvider(apiKey: string): Provider {
  return createCompatProvider(apiKey, GROQ_CFG);
}
