import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";

const DEFAULT_CONFIG = `# workpapr.yaml — AI Audit Configuration
# Docs: https://workpapr.ai/docs/config

project:
  name: my-project
  description: ""

# AI/LLM providers to evaluate against
providers:
  - id: anthropic
    # config:
    #   apiKey: \${ANTHROPIC_API_KEY}
    #   model: claude-sonnet-4-20250514

  - id: openai
    # config:
    #   apiKey: \${OPENAI_API_KEY}
    #   model: gpt-4o

# Scan settings — discover AI usage in your codebase
scan:
  # Directories to scan (relative to project root)
  include:
    - "src"
    - "lib"
    - "app"
    - "server"
    - "api"
  # Directories to skip
  exclude:
    - "node_modules"
    - "dist"
    - "build"
    - ".git"
    - "vendor"
    - "__pycache__"
    - ".venv"
  # File extensions to scan
  extensions:
    - ".ts"
    - ".tsx"
    - ".js"
    - ".jsx"
    - ".py"
    - ".go"
    - ".java"
    - ".rs"
    - ".rb"

# Evaluation settings
eval:
  # Maximum concurrent evaluations
  maxConcurrency: 4
  # Cache evaluation results to reduce token costs
  cache: true
  # Output directory for reports
  outputDir: ".workpapr/reports"

# AI-powered analysis settings
ai:
  # Analysis tier: off | assist | analyze | full
  # off:     Pure static analysis (free, no AI needed)
  # assist:  AI explains findings, filters false positives, adjusts severity
  # analyze: Semantic detection, cross-file data flow, compliance reasoning
  # full:    All of above + generates complete audit workpapers
  tier: "off"
  # Default provider: workpapr/auditor via Ollama (free, private, local)
  # Override with cloud provider: anthropic, openai
  # provider: anthropic
  # model: claude-sonnet-4-20250514
  sendSourceCode: true
  maxContextLines: 50
  maxCostPerRun: 5.00
  cache: true
  cacheTtl: 604800
  auditLog: true
  # context:
  #   industry: financial-services
  #   dataTypes:
  #     - customer-pii
  #     - financial-transactions
  #   regulatoryFrameworks:
  #     - eu-ai-act
  #     - nist-ai-rmf
  # Enable full prompt+response logging for training data capture (default: false)
  # logFullPrompts: true

# Training data capture — feeds RLHF/SFT model improvement
# training:
#   enabled: true          # Auto-record investigation traces during scans
#   captureStyle: true     # Track workpaper edits for audit language learning

# Compliance assertions to run during evaluations
assertions:
  - type: pii-detection
    enabled: true
    severity: high

  - type: financial-accuracy
    enabled: true
    severity: critical

  - type: authorization-boundary
    enabled: true
    severity: high

  - type: hallucination-detection
    enabled: true
    severity: high

  - type: bias-fairness
    enabled: true
    severity: medium
`;

export const initCommand = new Command("init")
  .description("Initialize a Workpapr configuration in the current directory")
  .option("-f, --force", "Overwrite existing config file")
  .option(
    "-d, --dir <path>",
    "Directory to initialize in",
    process.cwd()
  )
  .action(async (options: { force?: boolean; dir: string }) => {
    const configPath = path.join(options.dir, "workpapr.yaml");

    if (fs.existsSync(configPath) && !options.force) {
      console.log(
        chalk.yellow("⚠") +
          " workpapr.yaml already exists. Use " +
          chalk.bold("--force") +
          " to overwrite."
      );
      process.exit(1);
    }

    fs.writeFileSync(configPath, DEFAULT_CONFIG, "utf-8");

    // Create output directory
    const outputDir = path.join(options.dir, ".workpapr", "reports");
    fs.mkdirSync(outputDir, { recursive: true });

    console.log(chalk.green("✓") + " Created workpapr.yaml");
    console.log(
      chalk.green("✓") + " Created .workpapr/reports directory"
    );
    console.log();
    console.log("Next steps:");
    console.log(
      `  ${chalk.cyan("workpapr scan")}      Discover AI/LLM usage in your codebase`
    );
    console.log(
      `  ${chalk.cyan("workpapr eval")}      Run compliance evaluations`
    );
    console.log(
      `  ${chalk.cyan("workpapr providers")} List supported LLM providers`
    );
  });
