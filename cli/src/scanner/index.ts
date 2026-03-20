import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";
import { detectInLine } from "./detectors.js";
import { detectRisksInFile } from "./risk-detectors.js";
import type { ScanConfig, ScanResult, ScanSummary } from "./types.js";

const DEFAULT_CONFIG: ScanConfig = {
  include: ["src", "lib", "app", "server", "api", "."],
  exclude: [
    "node_modules",
    "dist",
    "build",
    ".git",
    "vendor",
    "__pycache__",
    ".venv",
    ".workpapr",
    "coverage",
  ],
  extensions: [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".java", ".rs", ".rb"],
};

function buildGlobPattern(config: ScanConfig, rootDir: string): string[] {
  const patterns: string[] = [];
  const extGlob =
    config.extensions.length === 1
      ? `*${config.extensions[0]}`
      : `*{${config.extensions.join(",")}}`;

  for (const dir of config.include) {
    const fullDir = path.join(rootDir, dir);
    if (fs.existsSync(fullDir)) {
      patterns.push(path.join(fullDir, "**", extGlob));
    }
  }

  // If no include dirs exist, scan root
  if (patterns.length === 0) {
    patterns.push(path.join(rootDir, "**", extGlob));
  }

  return patterns;
}

function scanFile(filePath: string): ScanResult[] {
  const results: ScanResult[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return results;
  }

  const lines = content.split("\n");

  // Per-line detection (imports + API calls)
  for (let i = 0; i < lines.length; i++) {
    const lineResults = detectInLine(lines[i], filePath, i + 1);
    results.push(...lineResults);
  }

  // File-level risk detection
  const riskResults = detectRisksInFile(lines, filePath);
  results.push(...riskResults);

  return results;
}

export async function scan(
  rootDir: string,
  config?: Partial<ScanConfig>
): Promise<ScanSummary> {
  const mergedConfig: ScanConfig = {
    include: config?.include ?? DEFAULT_CONFIG.include,
    exclude: config?.exclude ?? DEFAULT_CONFIG.exclude,
    extensions: config?.extensions ?? DEFAULT_CONFIG.extensions,
  };

  const patterns = buildGlobPattern(mergedConfig, rootDir);
  const ignorePatterns = mergedConfig.exclude.map((e) =>
    path.join("**", e, "**")
  );

  let allFiles: string[] = [];
  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: ignorePatterns,
      nodir: true,
      absolute: true,
    });
    allFiles.push(...files);
  }

  // Deduplicate
  allFiles = [...new Set(allFiles)];

  const findings: ScanResult[] = [];
  const filesWithAI = new Set<string>();
  const providerCounts = new Map<string, number>();

  for (const file of allFiles) {
    const relPath = path.relative(rootDir, file);
    const results = scanFile(file);

    // Update results with relative paths
    for (const result of results) {
      result.file = relPath;
      findings.push(result);
      filesWithAI.add(relPath);
      providerCounts.set(
        result.provider,
        (providerCounts.get(result.provider) ?? 0) + 1
      );
    }
  }

  let imports = 0;
  let apiCalls = 0;
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  let riskFindings = 0;

  for (const f of findings) {
    if (f.type === "import") imports++;
    else if (f.type === "api-call") apiCalls++;

    bySeverity[f.severity]++;

    if (f.type !== "import" && f.type !== "api-call") {
      riskFindings++;
    }
  }

  return {
    totalFiles: allFiles.length,
    filesScanned: allFiles.length,
    filesWithAI: filesWithAI.size,
    findings,
    providers: providerCounts,
    byType: { imports, apiCalls },
    bySeverity,
    riskFindings,
  };
}
