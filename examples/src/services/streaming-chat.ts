import OpenAI from "openai";
import type { Request, Response } from "express";

const openai = new OpenAI();

interface ChatRequest {
  message: string;
  userId: string;
  userEmail: string;
  userName: string;
}

export async function handleStreamingChat(req: Request, res: Response) {
  const { message, userId, userEmail, userName } = req.body as ChatRequest;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    stream: true,
    messages: [
      {
        role: "system",
        content: "You are a financial advisor assistant for ACME Finance.",
      },
      {
        role: "user",
        content: `Customer ${userName} (${userEmail}) asks: ${message}`,
      },
    ],
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      // Stream directly to frontend without filtering
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  res.write("data: [DONE]\n\n");
  res.end();
}
