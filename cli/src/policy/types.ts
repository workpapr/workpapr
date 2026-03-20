import type { FindingType, Severity } from "../scanner/types.js";

export type PolicyAction = "block" | "warn";

export interface PolicyRule {
  id: string;
  name: string;
  findingTypes: FindingType[];
  severity: Severity;
  action: PolicyAction;
  enabled: boolean;
}

export interface PolicyConfig {
  policies: PolicyRule[];
}

export interface PolicyViolation {
  policyId: string;
  policyName: string;
  file: string;
  line: number;
  findingType: FindingType;
  severity: Severity;
  context: string;
}

export type PolicyRuleResult = "pass" | "warn" | "block";

export interface PolicyRuleReport {
  rule: PolicyRule;
  result: PolicyRuleResult;
  violations: PolicyViolation[];
}

export interface PolicyReport {
  passed: boolean;
  rules: PolicyRuleReport[];
  summary: {
    blocked: number;
    warned: number;
    passed: number;
  };
}
