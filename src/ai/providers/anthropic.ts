import type { AIProvider, CompletionRequest, CompletionResponse } from "../types.js";

export class AnthropicProvider implements AIProvider {
  id = "anthropic";
  name = "Anthropic";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = config?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.baseUrl = config?.baseUrl ?? "https://api.anthropic.com";
    this.model = config?.model ?? "claude-sonnet-4-20250514";
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }

    const systemMessage = request.messages.find((m) => m.role === "system");
    const nonSystemMessages = request.messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };

    const content = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    return {
      content,
      tokenCount: {
        prompt: data.usage.input_tokens,
        completion: data.usage.output_tokens,
      },
      model: data.model,
      cached: false,
    };
  }
}
