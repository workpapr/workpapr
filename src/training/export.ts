import fs from "node:fs";
import path from "node:path";
import type { TrainingTriple, InvestigationTrace } from "./types.js";
import type { PersistedFinding } from "../findings/types.js";
import { loadFindings } from "../findings/persistence.js";

/** Load traces from disk for export/analysis. */
function loadTraces(rootDir: string): InvestigationTrace[] {
  const tracePath = path.join(rootDir, ".workpapr", "training-data", "traces.jsonl");
  if (!fs.existsSync(tracePath)) return [];
  try {
    const raw = fs.readFileSync(tracePath, "utf-8");
    return raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as InvestigationTrace);
  } catch {
    return [];
  }
}

/**
 * Export training data from accumulated findings, traces, and style preferences.
 * Outputs JSONL files grouped by task type.
 */
export function exportTrainingData(rootDir: string): {
  taskType: string;
  count: number;
  path: string;
}[] {
  const outDir = path.join(rootDir, ".workpapr", "training-data", "export");
  fs.mkdirSync(outDir, { recursive: true });

  const results: { taskType: string; count: number; path: string }[] = [];

  // 1. FP detection training data
  const fpTriples = exportFPTrainingData(rootDir);
  if (fpTriples.length > 0) {
    const fpPath = path.join(outDir, "false-positive-detection.jsonl");
    writeJsonl(fpPath, fpTriples);
    results.push({ taskType: "false-positive-detection", count: fpTriples.length, path: fpPath });
  }

  // 2. Severity calibration training data
  const sevTriples = exportSeverityTrainingData(rootDir);
  if (sevTriples.length > 0) {
    const sevPath = path.join(outDir, "severity-calibration.jsonl");
    writeJsonl(sevPath, sevTriples);
    results.push({ taskType: "severity-calibration", count: sevTriples.length, path: sevPath });
  }

  // 3. Investigation traces
  const traces = loadTraces(rootDir);
  if (traces.length > 0) {
    const tracePath = path.join(outDir, "investigation-traces.jsonl");
    writeJsonl(tracePath, traces);
    results.push({ taskType: "investigation-traces", count: traces.length, path: tracePath });
  }

  // 4. Style preferences
  const stylePath = path.join(rootDir, ".workpapr", "training-data", "style-preferences.jsonl");
  if (fs.existsSync(stylePath)) {
    const styleData = fs.readFileSync(stylePath, "utf-8").split("\n").filter((l) => l.trim()).length;
    if (styleData > 0) {
      const destPath = path.join(outDir, "style-preferences.jsonl");
      fs.copyFileSync(stylePath, destPath);
      results.push({ taskType: "style-preferences", count: styleData, path: destPath });
    }
  }

  return results;
}

function exportFPTrainingData(rootDir: string): TrainingTriple[] {
  const findings = loadFindings(rootDir);
  const triples: TrainingTriple[] = [];

  for (const f of findings) {
    // Only include findings where both AI and human made a decision
    if (f.ai_fp_flag !== undefined && f.fp_override) {
      triples.push({
        taskType: "false-positive-detection",
        input: JSON.stringify({
          file: f.file,
          line: f.line,
          type: f.type,
          severity: f.severity,
          match: f.match,
          context: f.context,
        }),
        aiOutput: f.ai_fp_flag ? "false-positive" : "true-positive",
        humanLabel: f.fp_override === "confirmed" ? "false-positive" : "true-positive",
        metadata: {
          findingId: f.id,
          aiReasoning: f.ai_fp_reasoning,
          auditor: f.auditor,
        },
        timestamp: f.reviewed_at ?? f.last_seen,
      });
    }
  }

  return triples;
}

function exportSeverityTrainingData(rootDir: string): TrainingTriple[] {
  const findings = loadFindings(rootDir);
  const triples: TrainingTriple[] = [];

  for (const f of findings) {
    if (f.ai_predicted_severity && f.severity_override) {
      triples.push({
        taskType: "severity-calibration",
        input: JSON.stringify({
          file: f.file,
          line: f.line,
          type: f.type,
          context: f.context,
          riskCategory: f.riskCategory,
        }),
        aiOutput: f.ai_predicted_severity,
        humanLabel: f.severity_override,
        metadata: {
          findingId: f.id,
          originalSeverity: f.severity,
          aiReasoning: f.ai_reasoning,
          auditor: f.auditor,
        },
        timestamp: f.reviewed_at ?? f.last_seen,
      });
    }
  }

  return triples;
}

function writeJsonl(filePath: string, data: unknown[]): void {
  const content = data.map((item) => JSON.stringify(item)).join("\n") + "\n";
  fs.writeFileSync(filePath, content, "utf-8");
}
