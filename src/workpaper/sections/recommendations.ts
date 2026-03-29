import type { AIProvider, CompletionRequest } from "../../ai/types.js";
import type { AICache } from "../../ai/cache.js";
import type { AuditLog } from "../../ai/audit-log.js";
import type { ScanResult } from "../../scanner/types.js";
import type { AIFinding } from "../../analyzer/types.js";
import type { WorkpaperSection } from "../types.js";

const SYSTEM_PROMPT = `You are writing the "Recommendations" section of an AI audit workpaper. Based on the findings provided, create a prioritized list of actionable recommendations.

Structure recommendations by priority:
1. **Critical** — Must fix before production deployment
2. **High** — Should fix in next sprint
3. **Medium** — Plan for remediation
4. **Low** — Best practice improvements

For each recommendation:
- Be specific and actionable (not "improve error handling" but "add try/catch around the OpenAI call at line 42 with fallback to return a safe default response")
- Reference the specific finding(s) it addresses
- Estimate implementation effort (trivial / small / medium / large)

Format as Markdown with priority headers and bulleted recommendations.`;

export async function generateRecommendations(
  staticFindings: ScanResult[],
  aiFindings: AIFinding[],
  systemFile: string,
  provider: AIProvider,
  cache: AICache | null,
  auditLog: AuditLog | null
): Promise<WorkpaperSection> {
  const relevantStatic = staticFindings.filter((f) => f.file === systemFile);
  const relevantAI = aiFindings.filter((f) => f.file === systemFile);

  if (relevantStatic.length === 0 && relevantAI.length === 0) {
    return {
      id: "recommendations",
      title: "Recommendations",
      content: "No recommendations — no findings identified for this system.",
    };
  }

  const findingSummary = [
    ...relevantStatic.map((f) => ({
      source: "static" as const,
      file: f.file,
      line: f.line,
      type: f.type,
      severity: f.severity,
      context: f.context,
    })),
    ...relevantAI.map((f) => ({
      source: "ai" as const,
      file: f.file,
      line: f.line,
      type: f.type,
      severity: f.severity,
      context: f.description,
    })),
  ];

  const request: CompletionRequest = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `System: ${systemFile}\n\nFindings:\n${JSON.stringify(findingSummary, null, 2)}`,
      },
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
        task: "workpaper-recommendations",
        file: systemFile,
        durationMs,
        promptHash,
      });
      cache?.set(request, response);
    } catch {
      content = `*Unable to generate recommendations for ${systemFile}. AI analysis unavailable.*`;
    }
  }

  return {
    id: "recommendations",
    title: "Recommendations",
    content,
    provenance,
  };
}
