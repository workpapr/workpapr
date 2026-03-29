import type { MonitorEvent, MonitorSummary, ProviderSummary, ModelSummary } from "./types.js";

export function aggregateEvents(events: MonitorEvent[]): MonitorSummary {
  if (events.length === 0) {
    return {
      totalCalls: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      averageLatencyMs: 0,
      errorRate: 0,
      errorCount: 0,
      byProvider: {},
      timeRange: null,
    };
  }

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostUsd = 0;
  let totalLatency = 0;
  let errorCount = 0;

  const byProvider: Record<string, {
    calls: number;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
    totalLatency: number;
    models: Record<string, {
      calls: number;
      promptTokens: number;
      completionTokens: number;
      costUsd: number;
      totalLatency: number;
    }>;
  }> = {};

  const timestamps: string[] = [];

  for (const event of events) {
    totalPromptTokens += event.promptTokens;
    totalCompletionTokens += event.completionTokens;
    totalCostUsd += event.estimatedCostUsd;
    totalLatency += event.latencyMs;
    timestamps.push(event.timestamp);

    if (event.statusCode >= 400) errorCount++;

    // Provider aggregation
    if (!byProvider[event.provider]) {
      byProvider[event.provider] = {
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        totalLatency: 0,
        models: {},
      };
    }
    const prov = byProvider[event.provider];
    prov.calls++;
    prov.promptTokens += event.promptTokens;
    prov.completionTokens += event.completionTokens;
    prov.costUsd += event.estimatedCostUsd;
    prov.totalLatency += event.latencyMs;

    // Model aggregation
    if (!prov.models[event.model]) {
      prov.models[event.model] = {
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        totalLatency: 0,
      };
    }
    const model = prov.models[event.model];
    model.calls++;
    model.promptTokens += event.promptTokens;
    model.completionTokens += event.completionTokens;
    model.costUsd += event.estimatedCostUsd;
    model.totalLatency += event.latencyMs;
  }

  // Convert to final format
  const providerSummaries: Record<string, ProviderSummary> = {};
  for (const [name, data] of Object.entries(byProvider)) {
    const modelSummaries: Record<string, ModelSummary> = {};
    for (const [modelName, modelData] of Object.entries(data.models)) {
      modelSummaries[modelName] = {
        calls: modelData.calls,
        promptTokens: modelData.promptTokens,
        completionTokens: modelData.completionTokens,
        costUsd: modelData.costUsd,
        averageLatencyMs: Math.round(modelData.totalLatency / modelData.calls),
      };
    }
    providerSummaries[name] = {
      calls: data.calls,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      costUsd: data.costUsd,
      averageLatencyMs: Math.round(data.totalLatency / data.calls),
      models: modelSummaries,
    };
  }

  timestamps.sort();

  return {
    totalCalls: events.length,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens: totalPromptTokens + totalCompletionTokens,
    totalCostUsd,
    averageLatencyMs: Math.round(totalLatency / events.length),
    errorRate: errorCount / events.length,
    errorCount,
    byProvider: providerSummaries,
    timeRange: {
      first: timestamps[0],
      last: timestamps[timestamps.length - 1],
    },
  };
}
