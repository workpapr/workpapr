// Per-token cost estimates (USD per 1K tokens) — as of March 2026
const COST_TABLE: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-2024-11-20": { input: 0.0025, output: 0.01 },
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o-mini-2024-07-18": { input: 0.00015, output: 0.0006 },
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "claude-3-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-haiku": { input: 0.00025, output: 0.00125 },
  "claude-opus-4-20250514": { input: 0.015, output: 0.075 },
  "gemini-pro": { input: 0.00025, output: 0.0005 },
  "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
};

const DEFAULT_COST = { input: 0.005, output: 0.015 };

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rate = COST_TABLE[model] ?? DEFAULT_COST;
  return (
    (promptTokens / 1000) * rate.input +
    (completionTokens / 1000) * rate.output
  );
}
