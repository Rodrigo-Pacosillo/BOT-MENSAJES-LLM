export interface OpenAIProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface LlmProvider {
  generate(args: {
    system: string;
    history: { role: string; content: string }[];
    userMessage: string;
  }): Promise<string>;
}

export function createOpenAIProvider(config: OpenAIProviderConfig): LlmProvider {
  const generateOnce = async (
    system: string,
    history: { role: string; content: string }[],
    userMessage: string
  ): Promise<string> => {
    const messages: { role: string; content: string }[] = [
      { role: "system", content: system },
      ...history,
      { role: "user", content: userMessage },
    ];

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Error en LLM: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.length === 0) {
      throw new Error("Respuesta del LLM sin contenido");
    }

    return content;
  };

  return {
    async generate({ system, history, userMessage }) {
      try {
        return await generateOnce(system, history, userMessage);
      } catch (error) {
        console.error("[llm] Reintento automatico:", error);
        return await generateOnce(system, history, userMessage);
      }
    },
  };
}
