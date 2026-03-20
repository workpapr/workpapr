import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { PolicyRule, PolicyConfig } from "./types.js";
import { DEFAULT_POLICIES } from "./defaults.js";

export function loadPolicies(dir: string): PolicyRule[] {
  const configPath = path.join(dir, "workpapr.yaml");
  if (!fs.existsSync(configPath)) {
    return DEFAULT_POLICIES;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = parseYaml(raw) as Record<string, unknown>;
    if (parsed?.policies && Array.isArray(parsed.policies)) {
      return (parsed.policies as PolicyRule[]).map((p) => ({
        id: p.id,
        name: p.name,
        findingTypes: p.findingTypes,
        severity: p.severity,
        action: p.action ?? "warn",
        enabled: p.enabled ?? true,
      }));
    }
  } catch {
    // Fall through to defaults
  }

  return DEFAULT_POLICIES;
}
