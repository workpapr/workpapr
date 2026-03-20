import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { ScanResult } from "../scanner/types.js";
import type { PersistedFinding } from "./types.js";

export function generateFindingId(result: ScanResult): string {
  const input = `${result.file}:${result.type}:${result.provider}:${result.match}`;
  const hash = createHash("sha256").update(input).digest("hex");
  return `f-${hash.slice(0, 12)}`;
}

export function loadFindings(dir: string): PersistedFinding[] {
  const filePath = path.join(dir, ".workpapr", "findings.yaml");
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = parseYaml(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed?.findings && Array.isArray(parsed.findings)) {
      return parsed.findings;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveFindings(
  dir: string,
  findings: PersistedFinding[]
): void {
  const workpaprDir = path.join(dir, ".workpapr");
  if (!fs.existsSync(workpaprDir)) {
    fs.mkdirSync(workpaprDir, { recursive: true });
  }

  const filePath = path.join(workpaprDir, "findings.yaml");
  const output = stringifyYaml({ findings }, { lineWidth: 120 });
  fs.writeFileSync(filePath, output, "utf-8");
}

export function reconcileFindings(
  existing: PersistedFinding[],
  fresh: ScanResult[]
): PersistedFinding[] {
  const now = new Date().toISOString();
  const existingById = new Map<string, PersistedFinding>();
  for (const f of existing) {
    existingById.set(f.id, f);
  }

  const freshIds = new Set<string>();
  const result: PersistedFinding[] = [];

  // Process fresh scan results
  for (const scanResult of fresh) {
    const id = generateFindingId(scanResult);
    freshIds.add(id);

    const prev = existingById.get(id);
    if (prev) {
      // Update with latest scan data, preserve auditor fields
      result.push({
        ...prev,
        line: scanResult.line,
        context: scanResult.context,
        severity: prev.severity_override ?? scanResult.severity,
        riskCategory: scanResult.riskCategory ?? prev.riskCategory,
        complianceTags: scanResult.complianceTags ?? prev.complianceTags,
        last_seen: now,
        status: "open",
      });
    } else {
      // New finding
      result.push({
        id,
        file: scanResult.file,
        line: scanResult.line,
        type: scanResult.type,
        provider: scanResult.provider,
        match: scanResult.match,
        context: scanResult.context,
        severity: scanResult.severity,
        riskCategory: scanResult.riskCategory,
        complianceTags: scanResult.complianceTags,
        status: "open",
        first_seen: now,
        last_seen: now,
        disposition: null,
        note: null,
        auditor: null,
        reviewed_at: null,
        severity_override: null,
        evidence_ref: null,
      });
    }
  }

  // Mark resolved: existing findings not in fresh scan
  for (const prev of existing) {
    if (!freshIds.has(prev.id)) {
      result.push({
        ...prev,
        status: "resolved",
        last_seen: prev.last_seen,
      });
    }
  }

  return result;
}
