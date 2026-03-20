export interface MonitorEvent {
  timestamp: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  statusCode: number;
  estimatedCostUsd: number;
  project?: string;
  file?: string;
  hasPersonalData?: boolean;
}

export interface MonitorSummary {
  totalCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  averageLatencyMs: number;
  errorRate: number;
  errorCount: number;
  byProvider: Record<string, ProviderSummary>;
  timeRange: { first: string; last: string } | null;
}

export interface ProviderSummary {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  averageLatencyMs: number;
  models: Record<string, ModelSummary>;
}

export interface ModelSummary {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  averageLatencyMs: number;
}
