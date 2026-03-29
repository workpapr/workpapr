import fs from "node:fs";
import path from "node:path";
import type { CompletionRequest, CompletionResponse, AIProvenance } from "./types.js";

export interface AuditLogEntry {
  timestamp: string;
  provider: string;
  model: string;
  promptHash: string;
  tokenCount: { prompt: number; completion: number };
  cached: boolean;
  temperature: number;
  task: string;
  file?: string;
  durationMs: number;
  error?: string;
  // Full prompt+response logging (opt-in for training data capture)
  promptText?: string;
  responseText?: string;
}

export class AuditLog {
  private logPath: string;
  private logFullPrompts: boolean;

  constructor(rootDir: string, logFullPrompts = false) {
    const dir = path.join(rootDir, ".workpapr");
    fs.mkdirSync(dir, { recursive: true });
    this.logPath = path.join(dir, "audit-log.jsonl");
    this.logFullPrompts = logFullPrompts;
  }

  log(entry: AuditLogEntry): void {
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(this.logPath, line, "utf-8");
  }

  logCompletion(
    request: CompletionRequest,
    response: CompletionResponse,
    meta: { task: string; file?: string; durationMs: number; promptHash: string }
  ): AIProvenance {
    const provenance: AIProvenance = {
      model: response.model,
      provider: response.model.includes("workpapr") ? "ollama" : "cloud",
      promptHash: meta.promptHash,
      timestamp: new Date().toISOString(),
      tokenCount: response.tokenCount,
      cached: response.cached,
      temperature: request.temperature ?? 0,
    };

    const entry: AuditLogEntry = {
      timestamp: provenance.timestamp,
      provider: provenance.provider,
      model: provenance.model,
      promptHash: meta.promptHash,
      tokenCount: response.tokenCount,
      cached: response.cached,
      temperature: provenance.temperature,
      task: meta.task,
      file: meta.file,
      durationMs: meta.durationMs,
    };

    // Opt-in full prompt+response logging for training data capture
    if (this.logFullPrompts) {
      entry.promptText = JSON.stringify(request.messages);
      entry.responseText = response.content;
    }

    this.log(entry);

    return provenance;
  }

  logError(
    task: string,
    error: string,
    meta: { provider: string; file?: string; durationMs: number }
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      provider: meta.provider,
      model: "unknown",
      promptHash: "",
      tokenCount: { prompt: 0, completion: 0 },
      cached: false,
      temperature: 0,
      task,
      file: meta.file,
      durationMs: meta.durationMs,
      error,
    });
  }
}
