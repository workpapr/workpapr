// Classifies expense receipts into GL account codes per company chart of accounts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function classifyExpense(receipt: {
  vendor: string;
  amount: number;
  description: string;
}) {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Classify this expense into the correct GL account code.\nVendor: ${receipt.vendor}\nAmount: $${receipt.amount}\nDescription: ${receipt.description}\n\nReturn JSON: { "gl_code": string, "category": string, "confidence": number }`,
      },
    ],
  });

  return JSON.parse(message.content[0].type === "text" ? message.content[0].text : "{}");
}
