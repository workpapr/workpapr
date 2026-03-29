import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { ComplianceMapping } from "../analyzer/types.js";

export interface PersistedComplianceMapping extends ComplianceMapping {
  auditorStatus?: "met" | "partially-met" | "not-met" | "not-applicable";
  auditorRationale?: string;
  correctedBy?: string;
  correctedAt?: string;
}

export interface ComplianceState {
  lastUpdated: string;
  mappings: PersistedComplianceMapping[];
}

export function loadComplianceState(rootDir: string): ComplianceState {
  const filePath = path.join(rootDir, ".workpapr", "compliance-state.yaml");
  if (!fs.existsSync(filePath)) {
    return { lastUpdated: "", mappings: [] };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = parseYaml(raw) as ComplianceState;
    return parsed ?? { lastUpdated: "", mappings: [] };
  } catch {
    return { lastUpdated: "", mappings: [] };
  }
}

export function saveComplianceState(
  rootDir: string,
  state: ComplianceState
): void {
  const dir = path.join(rootDir, ".workpapr");
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, "compliance-state.yaml");
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(filePath, stringifyYaml(state, { lineWidth: 120 }), "utf-8");
}

/**
 * Reconcile AI-generated compliance mappings with existing auditor corrections.
 * Preserves auditor overrides while updating AI assessments.
 */
export function reconcileComplianceMappings(
  existing: PersistedComplianceMapping[],
  fresh: ComplianceMapping[]
): PersistedComplianceMapping[] {
  const result: PersistedComplianceMapping[] = [];

  const existingByKey = new Map<string, PersistedComplianceMapping>();
  for (const m of existing) {
    const key = `${m.framework}:${m.requirement}`;
    existingByKey.set(key, m);
  }

  for (const m of fresh) {
    const key = `${m.framework}:${m.requirement}`;
    const prev = existingByKey.get(key);

    if (prev) {
      // Preserve auditor corrections, update AI assessment
      result.push({
        ...m,
        auditorStatus: prev.auditorStatus,
        auditorRationale: prev.auditorRationale,
        correctedBy: prev.correctedBy,
        correctedAt: prev.correctedAt,
      });
    } else {
      result.push(m);
    }
  }

  // Keep auditor-corrected mappings that AI no longer generates
  for (const prev of existing) {
    const key = `${prev.framework}:${prev.requirement}`;
    const inFresh = fresh.some(
      (m) => `${m.framework}:${m.requirement}` === key
    );
    if (!inFresh && prev.correctedBy) {
      result.push(prev);
    }
  }

  return result;
}
