import type { AIProvider, AIConfig } from "./types.js";
import { OllamaProvider } from "./providers/ollama.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAIProvider } from "./providers/openai.js";

export interface ProviderConfig {
  id: string;
  config?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
}

export async function resolveProvider(
  options: {
    provider?: string;
    model?: string;
    aiConfig?: AIConfig;
    providers?: ProviderConfig[];
  } = {}
): Promise<AIProvider> {
  const { provider: cliProvider, model: cliModel, aiConfig, providers } = options;

  // CLI flag takes highest priority
  if (cliProvider) {
    return createProvider(cliProvider, findProviderConfig(cliProvider, providers), cliModel);
  }

  // Config file provider
  if (aiConfig?.provider) {
    return createProvider(
      aiConfig.provider,
      findProviderConfig(aiConfig.provider, providers),
      aiConfig.model
    );
  }

  // Auto-detect: try Ollama first (free, private, local)
  const ollama = new OllamaProvider();
  if (await ollama.isAvailable()) {
    return ollama;
  }

  // Fall back to env vars
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider({ model: cliModel });
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIProvider({ model: cliModel });
  }

  throw new Error(
    "No AI provider available. Options:\n" +
      "  1. Install Ollama and run: ollama pull workpapr/auditor\n" +
      "  2. Set ANTHROPIC_API_KEY or OPENAI_API_KEY\n" +
      "  3. Configure a provider in workpapr.yaml\n" +
      "  4. Use --provider <name> with the scan command"
  );
}

function findProviderConfig(
  id: string,
  providers?: ProviderConfig[]
): ProviderConfig["config"] {
  if (!providers) return undefined;
  const found = providers.find((p) => p.id === id);
  return found?.config;
}

function resolveConfigValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const envMatch = value.match(/^\$\{(\w+)\}$/);
  if (envMatch) {
    return process.env[envMatch[1]] ?? "";
  }
  return value;
}

function createProvider(
  id: string,
  config?: ProviderConfig["config"],
  modelOverride?: string
): AIProvider {
  const apiKey = resolveConfigValue(config?.apiKey);
  const baseUrl = resolveConfigValue(config?.baseUrl);
  const model = modelOverride ?? config?.model;

  switch (id) {
    case "ollama":
      return new OllamaProvider({ baseUrl, model });
    case "anthropic":
      return new AnthropicProvider({ apiKey, baseUrl, model });
    case "openai":
    case "azure":
      return new OpenAIProvider({ apiKey, baseUrl, model });
    default:
      throw new Error(
        `Unknown AI provider: ${id}. Supported: ollama, anthropic, openai, azure`
      );
  }
}
