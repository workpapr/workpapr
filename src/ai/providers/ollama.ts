import type { AIProvider, CompletionRequest, CompletionResponse } from "../types.js";

export class OllamaProvider implements AIProvider {
  id = "ollama";
  name = "Ollama (Local)";
  private baseUrl: string;
  private model: string;

  constructor(config?: { baseUrl?: string; model?: string }) {
    this.baseUrl = config?.baseUrl ?? "http://localhost:11434";
    this.model = config?.model ?? "workpapr/auditor";
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      if (!data.models) return false;
      return data.models.some((m) => m.name.startsWith(this.model));
    } catch {
      return false;
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const body = {
      model: this.model,
      messages: request.messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0,
        num_predict: request.maxTokens ?? 4096,
      },
      ...(request.responseFormat === "json" ? { format: "json" } : {}),
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      message: { content: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      content: data.message.content,
      tokenCount: {
        prompt: data.prompt_eval_count ?? 0,
        completion: data.eval_count ?? 0,
      },
      model: this.model,
      cached: false,
    };
  }
}
