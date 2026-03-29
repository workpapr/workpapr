import type { AIProvider, CompletionRequest, CompletionResponse } from "../types.js";

export class MLXProvider implements AIProvider {
  id = "mlx";
  name = "MLX (Local Fine-tuned)";
  private baseUrl: string;

  constructor(config: { baseUrl?: string; port?: number }) {
    const port = config.port ?? 8765;
    this.baseUrl = config.baseUrl ?? `http://localhost:${port}`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const body = {
      model: "default",
      messages: request.messages,
      temperature: request.temperature ?? 0,
      max_tokens: request.maxTokens ?? 4096,
      ...(request.responseFormat === "json"
        ? { response_format: { type: "json_object" } }
        : {}),
    };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`MLX server error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      content: data.choices[0].message.content,
      tokenCount: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
      },
      model: data.model ?? "mlx-finetuned",
      cached: false,
    };
  }
}
