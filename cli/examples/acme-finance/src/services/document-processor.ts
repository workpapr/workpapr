import OpenAI from "openai";

const openai = new OpenAI();

interface ReceiptData {
  vendor: string;
  amount: number;
  date: string;
  category: string;
  items: string[];
}

export async function processReceipt(imageBase64: string): Promise<ReceiptData> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract receipt data as JSON: vendor, amount, date, category, items[]",
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
        ],
      },
    ],
  });

  // Parse AI response directly as structured data — no validation
  const content = response.choices[0].message.content;
  return JSON.parse(content) as ReceiptData;
}

export async function classifyDocument(text: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Classify financial documents. Return one of: invoice, receipt, statement, contract, other",
      },
      { role: "user", content: text },
    ],
  });

  return response.choices[0].message.content;
}
