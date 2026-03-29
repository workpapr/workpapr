import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { CompletionRequest, CompletionResponse } from "./types.js";

export class AICache {
  private cacheDir: string;
  private ttlMs: number;

  constructor(rootDir: string, ttlSeconds: number = 604800) {
    this.cacheDir = path.join(rootDir, ".workpapr", "cache", "ai");
    this.ttlMs = ttlSeconds * 1000;
  }

  private hashRequest(request: CompletionRequest): string {
    const content = JSON.stringify(request.messages) + (request.temperature ?? 0);
    return createHash("sha256").update(content).digest("hex");
  }

  private cachePath(hash: string): string {
    return path.join(this.cacheDir, `${hash}.json`);
  }

  get(request: CompletionRequest): CompletionResponse | null {
    const hash = this.hashRequest(request);
    const filePath = this.cachePath(hash);

    if (!fs.existsSync(filePath)) return null;

    try {
      const stat = fs.statSync(filePath);
      if (Date.now() - stat.mtimeMs > this.ttlMs) {
        fs.unlinkSync(filePath);
        return null;
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      const cached = JSON.parse(raw) as CompletionResponse;
      return { ...cached, cached: true };
    } catch {
      return null;
    }
  }

  set(request: CompletionRequest, response: CompletionResponse): void {
    const hash = this.hashRequest(request);
    const filePath = this.cachePath(hash);

    fs.mkdirSync(this.cacheDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(response), "utf-8");
  }

  getHash(request: CompletionRequest): string {
    return this.hashRequest(request);
  }
}
