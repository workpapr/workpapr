export type AITier = "off" | "assist" | "analyze" | "full";

export interface AIProvenance {
  model: string;
  provider: string;
  promptHash: string;
  timestamp: string;
  tokenCount: { prompt: number; completion: number };
  cached: boolean;
  temperature: number;
}

export interface AIConfidence {
  level: "high" | "medium" | "low";
  reasoning: string;
  corroborating: string[];
  contradicting: string[];
}

export interface CompletionRequest {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
}

export interface CompletionResponse {
  content: string;
  tokenCount: { prompt: number; completion: number };
  model: string;
  cached: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  isAvailable(): Promise<boolean>;
}

export interface AIConfig {
  tier: AITier;
  provider?: string;
  model?: string;
  sendSourceCode: boolean;
  maxContextLines: number;
  maxCostPerRun: number;
  cache: boolean;
  cacheTtl: number;
  auditLog: boolean;
  context?: {
    industry?: string;
    dataTypes?: string[];
    regulatoryFrameworks?: string[];
  };
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  tier: "off",
  sendSourceCode: true,
  maxContextLines: 50,
  maxCostPerRun: 5.0,
  cache: true,
  cacheTtl: 604800,
  auditLog: true,
};
