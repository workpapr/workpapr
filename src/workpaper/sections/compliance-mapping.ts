import type { ComplianceMapping } from "../../analyzer/types.js";
import type { WorkpaperSection } from "../types.js";

const STATUS_ICON: Record<string, string> = {
  met: "PASS",
  "partially-met": "PARTIAL",
  "not-met": "FAIL",
  "not-applicable": "N/A",
};

export function generateComplianceMappingSection(
  mappings: ComplianceMapping[]
): WorkpaperSection {
  if (mappings.length === 0) {
    return {
      id: "compliance-mapping",
      title: "Compliance Mapping",
      content:
        "*No compliance mappings available. Configure `regulatoryFrameworks` in workpapr.yaml and run with `--tier analyze` or higher.*",
    };
  }

  const lines: string[] = [];

  // Group by framework
  const byFramework = new Map<string, ComplianceMapping[]>();
  for (const m of mappings) {
    const existing = byFramework.get(m.framework) ?? [];
    existing.push(m);
    byFramework.set(m.framework, existing);
  }

  for (const [framework, fwMappings] of byFramework) {
    lines.push(`### ${formatFrameworkName(framework)}`);
    lines.push("");
    lines.push("| Requirement | Status | Related Findings | Rationale |");
    lines.push("|-------------|--------|------------------|-----------|");

    for (const m of fwMappings) {
      const status = STATUS_ICON[m.status] ?? m.status;
      const findings = m.findings.length > 0 ? m.findings.join("; ") : "—";
      lines.push(`| ${m.requirement} | ${status} | ${findings} | ${m.rationale} |`);
    }

    // Summary
    const met = fwMappings.filter((m) => m.status === "met").length;
    const partial = fwMappings.filter((m) => m.status === "partially-met").length;
    const notMet = fwMappings.filter((m) => m.status === "not-met").length;
    const na = fwMappings.filter((m) => m.status === "not-applicable").length;

    lines.push("");
    lines.push(
      `**Summary:** ${met} met, ${partial} partially met, ${notMet} not met, ${na} N/A`
    );
    lines.push("");
  }

  return {
    id: "compliance-mapping",
    title: "Compliance Mapping",
    content: lines.join("\n"),
  };
}

function formatFrameworkName(id: string): string {
  const names: Record<string, string> = {
    "eu-ai-act": "EU AI Act",
    "nist-ai-rmf": "NIST AI Risk Management Framework",
    sox: "SOX (Sarbanes-Oxley)",
    "soc-2": "SOC 2 Trust Services Criteria",
    "soc2": "SOC 2 Trust Services Criteria",
  };
  return names[id] ?? id.toUpperCase();
}
