import { Command } from "commander";
import chalk from "chalk";

interface Provider {
  id: string;
  name: string;
  status: "supported" | "planned";
  sdkPackage: string;
  apiEndpoint: string;
}

const PROVIDERS: Provider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    status: "supported",
    sdkPackage: "@anthropic-ai/sdk",
    apiEndpoint: "api.anthropic.com/v1/messages",
  },
  {
    id: "openai",
    name: "OpenAI",
    status: "supported",
    sdkPackage: "openai",
    apiEndpoint: "api.openai.com/v1/chat/completions",
  },
  {
    id: "google",
    name: "Google AI (Gemini)",
    status: "supported",
    sdkPackage: "@google/generative-ai",
    apiEndpoint: "generativelanguage.googleapis.com",
  },
  {
    id: "bedrock",
    name: "AWS Bedrock",
    status: "supported",
    sdkPackage: "@aws-sdk/client-bedrock-runtime",
    apiEndpoint: "bedrock-runtime.*.amazonaws.com",
  },
  {
    id: "azure",
    name: "Azure OpenAI",
    status: "supported",
    sdkPackage: "@azure/openai",
    apiEndpoint: "*.openai.azure.com",
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    status: "supported",
    sdkPackage: "ollama",
    apiEndpoint: "localhost:11434",
  },
  {
    id: "cohere",
    name: "Cohere",
    status: "planned",
    sdkPackage: "cohere-ai",
    apiEndpoint: "api.cohere.ai",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    status: "planned",
    sdkPackage: "@mistralai/mistralai",
    apiEndpoint: "api.mistral.ai",
  },
];

export const providersCommand = new Command("providers")
  .description("List supported LLM providers")
  .option("--json", "Output as JSON")
  .action((options: { json?: boolean }) => {
    if (options.json) {
      console.log(JSON.stringify(PROVIDERS, null, 2));
      return;
    }

    console.log();
    console.log(chalk.bold("Supported LLM Providers"));
    console.log();

    const supported = PROVIDERS.filter((p) => p.status === "supported");
    const planned = PROVIDERS.filter((p) => p.status === "planned");

    for (const provider of supported) {
      console.log(
        `  ${chalk.green("●")} ${chalk.bold(provider.name)} ${chalk.dim(`(${provider.id})`)}`
      );
      console.log(
        `    SDK: ${chalk.cyan(provider.sdkPackage)}  Endpoint: ${chalk.dim(provider.apiEndpoint)}`
      );
    }

    if (planned.length > 0) {
      console.log();
      console.log(chalk.dim("  Planned:"));
      for (const provider of planned) {
        console.log(
          `  ${chalk.dim("○")} ${provider.name} ${chalk.dim(`(${provider.id})`)}`
        );
      }
    }

    console.log();
    console.log(
      chalk.dim(
        `  ${supported.length} supported, ${planned.length} planned`
      )
    );
  });
