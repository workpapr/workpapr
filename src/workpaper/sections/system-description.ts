import type { AIProvider, CompletionRequest } from "../../ai/types.js";
import type { AICache } from "../../ai/cache.js";
import type { AuditLog } from "../../ai/audit-log.js";
import type { FileContext } from "../../ai/context.js";
import { formatFileForPrompt } from "../../ai/context.js";
import type { WorkpaperSection } from "../types.js";

const SYSTEM_PROMPT = `You are writing the "System Description" section of an AI audit workpaper. Based on the source code provided, describe:

1. What this AI system does (purpose, capabilities)
2. The AI/LLM provider and model used
3. The type of AI system (chatbot, agent, classifier, RAG pipeline, etc.)
4. Input sources (user input, database, files, APIs)
5. Output destinations (user-facing, database, downstream services)
6. Key integrations and dependencies

Write in professional audit language. Be factual and evidence-based — cite specific code elements.
Do not speculate beyond what the code shows. Use Markdown formatting.`;

export async function generateSystemDescription(
  fileCtx: FileContext,
  provider: AIProvider,
  cache: AICache | null,
  auditLog: AuditLog | null
): Promise<WorkpaperSection> {
  const request: CompletionRequest = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: formatFileForPrompt(fileCtx) },
    ],
    temperature: 0,
  };

  let content = "";
  let provenance;

  if (cache) {
    const cached = cache.get(request);
    if (cached) {
      content = cached.content;
    }
  }

  if (!content) {
    const start = Date.now();
    try {
      const response = await provider.complete(request);
      content = response.content;
      const durationMs = Date.now() - start;
      const promptHash = cache?.getHash(request) ?? "";
      provenance = auditLog?.logCompletion(request, response, {
        task: "workpaper-system-description",
        file: fileCtx.file,
        durationMs,
        promptHash,
      });
      cache?.set(request, response);
    } catch {
      content = `*Unable to generate system description for ${fileCtx.file}. AI analysis unavailable.*`;
    }
  }

  return {
    id: "system-description",
    title: "System Description",
    content,
    provenance,
  };
}
