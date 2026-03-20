// AI gateway with Azure OpenAI primary and AWS Bedrock fallback
import { AzureOpenAI } from "@azure/openai";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const azure = new AzureOpenAI({
  endpoint: "https://acme-finance.openai.azure.com",
  apiVersion: "2024-10-21",
});

const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });

export async function aiComplete(prompt: string): Promise<string> {
  try {
    const result = await azure.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });
    return result.choices[0].message.content ?? "";
  } catch (err) {
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      contentType: "application/json",
      body: JSON.stringify({ prompt, max_tokens: 1024 }),
    });
    const response = await bedrock.send(command);
    return new TextDecoder().decode(response.body);
  }
}
