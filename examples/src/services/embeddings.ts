// Document search via embeddings - indexes financial policies and audit evidence
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
}

export async function searchDocuments(query: string, corpus: string[]) {
  const queryVec = await getEmbedding(query);
  const corpusVecs = await Promise.all(corpus.map(getEmbedding));

  return corpusVecs
    .map((vec, i) => ({ index: i, score: cosineSim(queryVec, vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
