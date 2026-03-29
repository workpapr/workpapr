import type { DataFlowGraph } from "../../analyzer/types.js";
import type { WorkpaperSection } from "../types.js";

export function generateDataFlowSection(
  dataFlow: DataFlowGraph | undefined,
  systemFile: string
): WorkpaperSection {
  if (!dataFlow || (dataFlow.edges.length === 0 && dataFlow.entryPoints.length === 0)) {
    return {
      id: "data-flow-analysis",
      title: "Data Flow Analysis",
      content: "*No data flow information available. Run with `--tier analyze` or higher to enable AI-powered data flow tracing.*",
    };
  }

  const lines: string[] = [];

  // Entry points
  if (dataFlow.entryPoints.length > 0) {
    lines.push("### Entry Points");
    lines.push("");
    for (const ep of dataFlow.entryPoints) {
      lines.push(`- **${ep.file}:${ep.line}** — ${ep.description}`);
    }
    lines.push("");
  }

  // Data flow edges
  if (dataFlow.edges.length > 0) {
    lines.push("### Data Flow");
    lines.push("");
    lines.push("| From | To | Data Type | Controls | Risks |");
    lines.push("|------|----|-----------|----------|-------|");

    for (const edge of dataFlow.edges) {
      const from = `${edge.from.file}:${edge.from.line}`;
      const to = `${edge.to.file}:${edge.to.line}`;
      const controls = edge.controls.length > 0 ? edge.controls.join(", ") : "None";
      const risks = edge.risks.length > 0 ? edge.risks.join(", ") : "None identified";
      lines.push(`| ${from} | ${to} | ${edge.dataType} | ${controls} | ${risks} |`);
    }
    lines.push("");
  }

  // Exit points
  if (dataFlow.exitPoints.length > 0) {
    lines.push("### Exit Points");
    lines.push("");
    for (const ep of dataFlow.exitPoints) {
      lines.push(`- **${ep.file}:${ep.line}** — ${ep.description}`);
    }
    lines.push("");
  }

  return {
    id: "data-flow-analysis",
    title: "Data Flow Analysis",
    content: lines.join("\n"),
  };
}
