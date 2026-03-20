import type { ScanResult } from "../scanner/types.js";
import type {
  PolicyRule,
  PolicyReport,
  PolicyRuleReport,
  PolicyViolation,
} from "./types.js";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function meetsThreshold(findingSeverity: string, policySeverity: string): boolean {
  return (SEVERITY_ORDER[findingSeverity] ?? 3) <= (SEVERITY_ORDER[policySeverity] ?? 3);
}

export function evaluatePolicies(
  scanResults: ScanResult[],
  policies: PolicyRule[]
): PolicyReport {
  const rules: PolicyRuleReport[] = [];
  let blocked = 0;
  let warned = 0;
  let passed = 0;

  for (const policy of policies) {
    if (!policy.enabled) continue;

    const violations: PolicyViolation[] = [];

    for (const finding of scanResults) {
      if (
        policy.findingTypes.includes(finding.type) &&
        meetsThreshold(finding.severity, policy.severity)
      ) {
        violations.push({
          policyId: policy.id,
          policyName: policy.name,
          file: finding.file,
          line: finding.line,
          findingType: finding.type,
          severity: finding.severity,
          context: finding.context,
        });
      }
    }

    let result: "pass" | "warn" | "block";
    if (violations.length === 0) {
      result = "pass";
      passed++;
    } else if (policy.action === "block") {
      result = "block";
      blocked++;
    } else {
      result = "warn";
      warned++;
    }

    rules.push({ rule: policy, result, violations });
  }

  return {
    passed: blocked === 0,
    rules,
    summary: { blocked, warned, passed },
  };
}
