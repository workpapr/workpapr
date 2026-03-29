import type { AIProvider, CompletionRequest, CompletionResponse } from "../types.js";

export class OpenAIProvider implements AIProvider {
  id = "openai";
  name = "OpenAI";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = config?.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.baseUrl = config?.baseUrl ?? "https://api.openai.com";
    this.model = config?.model ?? "gpt-4o";
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY not set");
    }

    const body: Record<string, unknown> = {
      model: this.model,
      temperature: request.temperature ?? 0,
      max_tokens: request.maxTokens ?? 4096,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (request.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    return {
      content: data.choices[0]?.message.content ?? "",
      tokenCount: {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
      },
      model: data.model,
      cached: false,
    };
  }
}
