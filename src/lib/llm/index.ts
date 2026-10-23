import { createOpenAIProvider, type LlmProvider } from "./openai";
import { createGroqProvider } from "./groq";
import type { Env } from "@/lib/env";

export type { LlmProvider };

export interface LlmFactoryEnv {
  LLM_PROVIDER: string;
  LLM_API_KEY: string;
  LLM_BASE_URL?: string;
  LLM_MODEL: string;
}

export function getLlmProvider(env: LlmFactoryEnv): LlmProvider {
  const baseUrl =
    env.LLM_BASE_URL ??
    (env.LLM_PROVIDER === "groq"
      ? "https://api.groq.com/openai/v1"
      : env.LLM_PROVIDER === "z.ai"
        ? "https://api.z.ai/api/paas/v4"
        : "https://api.openai.com/v1");

  switch (env.LLM_PROVIDER) {
    case "groq":
      return createGroqProvider({ apiKey: env.LLM_API_KEY, model: env.LLM_MODEL });
    case "z.ai":
      return createOpenAIProvider({ apiKey: env.LLM_API_KEY, baseUrl, model: env.LLM_MODEL });
    case "openai":
    default:
      return createOpenAIProvider({ apiKey: env.LLM_API_KEY, baseUrl, model: env.LLM_MODEL });
  }
}
