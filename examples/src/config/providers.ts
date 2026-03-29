// Centralizes AI provider configuration for all ACME Finance services
export const providers = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseUrl: "https://api.anthropic.com/v1/messages",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: "https://api.openai.com/v1/chat/completions",
  },
  google: {
    apiKey: process.env.GOOGLE_AI_KEY,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
  },
  azure: {
    apiKey: process.env.AZURE_OPENAI_KEY,
    baseUrl: "https://acme-finance.openai.azure.com/openai/deployments",
  },
  bedrock: {
    region: process.env.AWS_REGION ?? "us-east-1",
    baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
  },
} as const;

export type ProviderName = keyof typeof providers;
