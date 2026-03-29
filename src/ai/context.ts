import fs from "node:fs";
import path from "node:path";
import type { ScanResult } from "../scanner/types.js";

export interface FileContext {
  file: string;
  content: string;
  truncated: boolean;
  findings: ScanResult[];
}

export interface CodeContext {
  files: FileContext[];
  industry?: string;
  dataTypes?: string[];
  regulatoryFrameworks?: string[];
}

export function buildFileContext(
  rootDir: string,
  file: string,
  maxLines: number,
  findings: ScanResult[]
): FileContext {
  const absPath = path.join(rootDir, file);
  let content = "";
  let truncated = false;

  try {
    const raw = fs.readFileSync(absPath, "utf-8");
    const lines = raw.split("\n");
    if (lines.length > maxLines) {
      content = lines.slice(0, maxLines).join("\n");
      truncated = true;
    } else {
      content = raw;
    }
  } catch {
    content = `[Could not read file: ${file}]`;
  }

  return {
    file,
    content,
    truncated,
    findings: findings.filter((f) => f.file === file),
  };
}

export function buildCodeContext(
  rootDir: string,
  findings: ScanResult[],
  maxLines: number,
  contextConfig?: { industry?: string; dataTypes?: string[]; regulatoryFrameworks?: string[] }
): CodeContext {
  const fileSet = new Set(findings.map((f) => f.file));
  const files: FileContext[] = [];

  for (const file of fileSet) {
    files.push(buildFileContext(rootDir, file, maxLines, findings));
  }

  return {
    files,
    industry: contextConfig?.industry,
    dataTypes: contextConfig?.dataTypes,
    regulatoryFrameworks: contextConfig?.regulatoryFrameworks,
  };
}

export function formatFileForPrompt(ctx: FileContext): string {
  const header = `--- ${ctx.file}${ctx.truncated ? " (truncated)" : ""} ---`;
  const findingNotes =
    ctx.findings.length > 0
      ? `\nStatic findings in this file:\n${ctx.findings.map((f) => `  - Line ${f.line}: [${f.type}] ${f.severity} — ${f.context}`).join("\n")}\n`
      : "";
  return `${header}\n${ctx.content}\n${findingNotes}`;
}

export function formatContextForPrompt(ctx: CodeContext): string {
  const parts: string[] = [];

  if (ctx.industry) {
    parts.push(`Industry: ${ctx.industry}`);
  }
  if (ctx.dataTypes?.length) {
    parts.push(`Data types handled: ${ctx.dataTypes.join(", ")}`);
  }
  if (ctx.regulatoryFrameworks?.length) {
    parts.push(`Regulatory frameworks: ${ctx.regulatoryFrameworks.join(", ")}`);
  }
  if (parts.length > 0) {
    parts.push("");
  }

  for (const file of ctx.files) {
    parts.push(formatFileForPrompt(file));
  }

  return parts.join("\n");
}
