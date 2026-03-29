import type { AIProvider, CompletionRequest } from "../../ai/types.js";
import type { AICache } from "../../ai/cache.js";
import type { AuditLog } from "../../ai/audit-log.js";
import type { FileContext } from "../../ai/context.js";
import { formatFileForPrompt } from "../../ai/context.js";
import type { WorkpaperSection } from "../types.js";

const SYSTEM_PROMPT = `You are writing the "Control Evaluation" section of an AI audit workpaper. Evaluate whether the following controls are present in the code:

1. **Human Oversight** — Is there a human review step before AI-driven actions take effect?
2. **Error Handling** — Are AI API calls wrapped in try/catch with appropriate fallback behavior?
3. **Input Validation** — Is user input validated/sanitized before being passed to AI models?
4. **Output Validation** — Is AI output validated/parsed before being used downstream?
5. **Rate Limiting** — Are there rate limits or cost controls on AI API usage?
6. **Audit Logging** — Are AI interactions logged for review (inputs, outputs, decisions)?
7. **Model Pinning** — Are model versions pinned to specific date releases?
8. **Access Control** — Are AI capabilities restricted to authorized users/contexts?

For each control, assess:
- Present / Partially Present / Absent
- Evidence from the code (cite specific lines or patterns)
- Risk if absent

Format as a Markdown table followed by detailed notes for any absent or partially present controls.`;

export async function generateControlEvaluation(
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
        task: "workpaper-control-evaluation",
        file: fileCtx.file,
        durationMs,
        promptHash,
      });
      cache?.set(request, response);
    } catch {
      content = `*Unable to generate control evaluation for ${fileCtx.file}. AI analysis unavailable.*`;
    }
  }

  return {
    id: "control-evaluation",
    title: "Control Evaluation",
    content,
    provenance,
  };
}
