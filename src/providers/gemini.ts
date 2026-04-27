import type { Provider } from "./index.ts";
import type { FixContext, FixResponse } from "../types.ts";
import { buildSystemPrompt, parseFixResponse } from "./prompt.ts";

const MODEL = "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export function createGeminiProvider(apiKey: string): Provider {
  return {
    name: "gemini",
    async generateFix(context: FixContext): Promise<FixResponse> {
      const body = {
        systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(context) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      };
      const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
      const text = data.candidates[0].content.parts[0].text;
      return parseFixResponse(text);
    },
  };
}
