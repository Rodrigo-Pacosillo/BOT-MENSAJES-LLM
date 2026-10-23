import { createOpenAIProvider, type LlmProvider } from "./openai";

export interface GroqProviderConfig {
  apiKey: string;
  model: string;
}

export function createGroqProvider(config: GroqProviderConfig): LlmProvider {
  return createOpenAIProvider({
    apiKey: config.apiKey,
    baseUrl: "https://api.groq.com/openai/v1",
    model: config.model,
  });
}
