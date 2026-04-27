import type { Provider } from "../../src/providers/index.ts";
import type { FixContext, FixResponse } from "../../src/types.ts";

export function fakeProvider(canned: FixResponse | ((ctx: FixContext) => FixResponse)): Provider {
  return {
    name: "gemini",
    async generateFix(ctx: FixContext): Promise<FixResponse> {
      return typeof canned === "function" ? canned(ctx) : canned;
    },
  };
}

export function failingProvider(message = "boom"): Provider {
  return {
    name: "gemini",
    async generateFix(): Promise<FixResponse> { throw new Error(message); },
  };
}
