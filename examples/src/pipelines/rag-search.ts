import OpenAI from "openai";

const openai = new OpenAI();

interface SearchResult {
  id: string;
  content: string;
  score: number;
}

async function embedQuery(query: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  return response.data[0].embedding;
}

async function retrieveDocuments(embedding: number[]): Promise<SearchResult[]> {
  // Vector DB lookup (Pinecone/Weaviate/etc.)
  return [
    { id: "doc-1", content: "Q3 revenue was $4.2M...", score: 0.92 },
    { id: "doc-2", content: "Operating expenses increased...", score: 0.87 },
  ];
}

export async function ragSearch(query: string): Promise<string> {
  const embedding = await embedQuery(query);
  const docs = await retrieveDocuments(embedding);

  const context = docs.map((d) => d.content).join("\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Answer financial questions using the provided context. Cite sources.",
      },
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${query}`,
      },
    ],
  });

  // Return response directly without validation
  return completion.choices[0].message.content;
}
