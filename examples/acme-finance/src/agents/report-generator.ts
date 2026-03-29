// Generates monthly financial summary reports from structured accounting data
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY!);

export async function generateMonthlyReport(data: {
  revenue: number;
  expenses: number;
  period: string;
}) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent(
    `Generate a concise financial summary report for ${data.period}.\n` +
    `Revenue: $${data.revenue.toLocaleString()}\n` +
    `Expenses: $${data.expenses.toLocaleString()}\n` +
    `Net Income: $${(data.revenue - data.expenses).toLocaleString()}\n\n` +
    `Include: executive summary, key metrics, and variance analysis.`
  );

  return { period: data.period, report: result.response.text() };
}
