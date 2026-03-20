// Flags suspicious transactions using anomaly detection and LLM reasoning
import OpenAI from "openai";

const openai = new OpenAI();

export async function detectFraud(transaction: {
  id: string;
  amount: number;
  merchant: string;
  timestamp: string;
}) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a fraud detection agent for a financial institution. Analyze transactions and flag suspicious patterns.",
      },
      {
        role: "user",
        content: `Analyze this transaction for fraud risk:\nID: ${transaction.id}\nAmount: $${transaction.amount}\nMerchant: ${transaction.merchant}\nTime: ${transaction.timestamp}`,
      },
    ],
    temperature: 0,
  });

  return { transactionId: transaction.id, analysis: response.choices[0].message.content };
}
