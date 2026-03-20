import path from "node:path";
import { createHash } from "node:crypto";
import type { ScanResult, Severity } from "../scanner/types.js";
import type { AISystem, DataClassification, InventoryReport } from "./types.js";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PII_INDICATORS = [
  "ssn", "social_security", "email", "phone", "address", "dob",
  "date_of_birth", "name", "account_id", "member_id", "mrn",
  "diagnosis", "income", "credit", "pnl", "unrealized_pnl",
  "zip_code", "demographic",
];

function maxSeverity(severities: Severity[]): Severity {
  let min = 3;
  for (const s of severities) {
    const order = SEVERITY_ORDER[s] ?? 3;
    if (order < min) min = order;
  }
  const entries = Object.entries(SEVERITY_ORDER);
  return (entries.find(([, v]) => v === min)?.[0] as Severity) ?? "low";
}

function deriveDataTypes(findings: ScanResult[]): string[] {
  const types = new Set<string>();
  for (const f of findings) {
    if (f.type === "pii-in-prompt") {
      const ctx = (f.context + " " + f.match).toLowerCase();
      for (const indicator of PII_INDICATORS) {
        if (ctx.includes(indicator)) {
          types.add(indicator);
        }
      }
      if (types.size === 0) types.add("pii");
    }
  }
  return [...types].sort();
}

function deriveClassification(findings: ScanResult[]): DataClassification {
  const hasPii = findings.some((f) => f.type === "pii-in-prompt");
  const hasKey = findings.some((f) => f.type === "hardcoded-key");
  if (hasPii || hasKey) return "restricted";
  const hasApiCall = findings.some((f) => f.type === "api-call");
  if (hasApiCall) return "confidential";
  return "internal";
}

function deriveSystemName(file: string): string {
  const base = path.basename(file, path.extname(file));
  return base
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildInventory(findings: ScanResult[]): InventoryReport {
  // Group by file
  const byFile = new Map<string, ScanResult[]>();
  for (const f of findings) {
    const group = byFile.get(f.file) ?? [];
    group.push(f);
    byFile.set(f.file, group);
  }

  const allProviders = new Set<string>();
  const systems: AISystem[] = [];

  for (const [file, fileFindings] of byFile) {
    // Skip files with only import/api-call detections
    const riskFindings = fileFindings.filter(
      (f) => f.type !== "import" && f.type !== "api-call"
    );
    const hasRisk = riskFindings.length > 0;
    const hasImportOrCall = fileFindings.some(
      (f) => f.type === "import" || f.type === "api-call"
    );
    if (!hasImportOrCall && !hasRisk) continue;

    const providers = [
      ...new Set(
        fileFindings
          .filter((f) => f.provider !== "any")
          .map((f) => f.provider)
      ),
    ];
    providers.forEach((p) => allProviders.add(p));

    const models = [
      ...new Set(
        fileFindings
          .filter((f) => f.type === "unversioned-model")
          .map((f) => f.match)
      ),
    ];

    // Detect pinned models from context
    const modelPinned =
      fileFindings.filter((f) => f.type === "unversioned-model").length === 0;

    const severities = fileFindings
      .filter((f) => f.type !== "import" && f.type !== "api-call")
      .map((f) => f.severity);

    const tags = new Set<string>();
    for (const f of fileFindings) {
      if (f.complianceTags) {
        for (const t of f.complianceTags) tags.add(t);
      }
    }

    const id = "sys-" + createHash("sha256").update(file).digest("hex").slice(0, 8);

    systems.push({
      id,
      name: deriveSystemName(file),
      file,
      providers,
      models,
      modelPinned,
      dataClassification: deriveClassification(fileFindings),
      dataTypes: deriveDataTypes(fileFindings),
      riskLevel: severities.length > 0 ? maxSeverity(severities) : "low",
      hasHumanOversight: !fileFindings.some(
        (f) => f.type === "autonomous-decision"
      ),
      hasErrorHandling: !fileFindings.some(
        (f) => f.type === "no-error-handling"
      ),
      hasOutputValidation: !fileFindings.some(
        (f) => f.type === "missing-output-validation"
      ),
      complianceTags: [...tags].sort(),
      findingCount: fileFindings.length,
    });
  }

  // Sort by risk level (critical first)
  systems.sort(
    (a, b) => (SEVERITY_ORDER[a.riskLevel] ?? 3) - (SEVERITY_ORDER[b.riskLevel] ?? 3)
  );

  return {
    systems,
    totalSystems: systems.length,
    totalProviders: allProviders.size,
    totalFindings: findings.length,
  };
}
