import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import { readMonitorEvents } from "../monitor/reader.js";
import { aggregateEvents } from "../monitor/aggregator.js";

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const monitorCommand = new Command("monitor")
  .description("Runtime AI usage monitoring and cost tracking");

monitorCommand
  .command("summary")
  .description("Show AI usage overview")
  .option("-d, --dir <path>", "Directory with monitor data", process.cwd())
  .option("--json", "Output as JSON")
  .action((options: { dir: string; json?: boolean }) => {
    const rootDir = path.resolve(options.dir);
    const events = readMonitorEvents(rootDir);

    if (events.length === 0) {
      console.log(chalk.dim("\nNo monitor data found. Expected .workpapr/monitor.jsonl\n"));
      return;
    }

    const summary = aggregateEvents(events);

    if (options.json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    console.log();
    console.log(chalk.bold("Monitor Summary") + chalk.dim(` — ${rootDir}`));
    console.log();

    if (summary.timeRange) {
      console.log(
        `  Period: ${chalk.dim(summary.timeRange.first)} → ${chalk.dim(summary.timeRange.last)}`
      );
    }

    console.log(`  Total calls:   ${chalk.bold(String(summary.totalCalls))}`);
    console.log(`  Total tokens:  ${chalk.bold(formatTokens(summary.totalTokens))} (${formatTokens(summary.totalPromptTokens)} in / ${formatTokens(summary.totalCompletionTokens)} out)`);
    console.log(`  Total cost:    ${chalk.bold(formatCost(summary.totalCostUsd))}`);
    console.log(`  Avg latency:   ${chalk.bold(summary.averageLatencyMs + "ms")}`);

    const errorColor = summary.errorRate > 0.05 ? chalk.red : summary.errorRate > 0 ? chalk.yellow : chalk.green;
    console.log(`  Error rate:    ${errorColor(`${(summary.errorRate * 100).toFixed(1)}%`)} (${summary.errorCount} errors)`);

    console.log();
    console.log(chalk.bold("  By Provider:"));
    for (const [provider, data] of Object.entries(summary.byProvider)) {
      console.log(
        `    ${chalk.cyan("\u25CF")} ${provider}: ${data.calls} calls, ${formatTokens(data.promptTokens + data.completionTokens)} tokens, ${formatCost(data.costUsd)}`
      );
      for (const [model, modelData] of Object.entries(data.models)) {
        console.log(
          `      ${chalk.dim(model)}: ${modelData.calls} calls, ${formatCost(modelData.costUsd)}, avg ${modelData.averageLatencyMs}ms`
        );
      }
    }
    console.log();
  });

monitorCommand
  .command("events")
  .description("Show recent AI API events")
  .option("-d, --dir <path>", "Directory with monitor data", process.cwd())
  .option("-n, --limit <count>", "Number of events to show", "20")
  .option("--json", "Output as JSON")
  .action((options: { dir: string; limit: string; json?: boolean }) => {
    const rootDir = path.resolve(options.dir);
    const events = readMonitorEvents(rootDir);

    if (events.length === 0) {
      console.log(chalk.dim("\nNo monitor data found. Expected .workpapr/monitor.jsonl\n"));
      return;
    }

    const limit = parseInt(options.limit, 10) || 20;
    const recent = events.slice(-limit);

    if (options.json) {
      console.log(JSON.stringify(recent, null, 2));
      return;
    }

    console.log();
    console.log(
      chalk.bold("Recent Events") +
        chalk.dim(` — showing last ${recent.length} of ${events.length}`)
    );
    console.log();

    for (const event of recent) {
      const time = event.timestamp.replace("T", " ").replace(/\.\d+Z$/, "Z");
      const status =
        event.statusCode >= 400
          ? chalk.red(String(event.statusCode))
          : chalk.green(String(event.statusCode));
      const tokens = event.promptTokens + event.completionTokens;
      const pii = event.hasPersonalData ? chalk.red(" PII") : "";

      console.log(
        `  ${chalk.dim(time)} ${status} ${chalk.cyan(event.provider)}/${event.model} ` +
          `${formatTokens(tokens)} ${formatCost(event.estimatedCostUsd)} ${event.latencyMs}ms${pii}`
      );
      if (event.file) {
        console.log(`    ${chalk.dim(event.file)}`);
      }
    }
    console.log();
  });

monitorCommand
  .command("costs")
  .description("Show cost breakdown by provider and model")
  .option("-d, --dir <path>", "Directory with monitor data", process.cwd())
  .option("--json", "Output as JSON")
  .action((options: { dir: string; json?: boolean }) => {
    const rootDir = path.resolve(options.dir);
    const events = readMonitorEvents(rootDir);

    if (events.length === 0) {
      console.log(chalk.dim("\nNo monitor data found. Expected .workpapr/monitor.jsonl\n"));
      return;
    }

    const summary = aggregateEvents(events);

    if (options.json) {
      const costData = Object.fromEntries(
        Object.entries(summary.byProvider).map(([provider, data]) => [
          provider,
          {
            totalCost: data.costUsd,
            calls: data.calls,
            models: Object.fromEntries(
              Object.entries(data.models).map(([model, m]) => [
                model,
                { cost: m.costUsd, calls: m.calls },
              ])
            ),
          },
        ])
      );
      console.log(JSON.stringify({ totalCost: summary.totalCostUsd, providers: costData }, null, 2));
      return;
    }

    console.log();
    console.log(chalk.bold("Cost Breakdown") + chalk.dim(` — ${rootDir}`));
    console.log();
    console.log(`  Total: ${chalk.bold(formatCost(summary.totalCostUsd))} across ${summary.totalCalls} calls`);
    console.log();

    // Sort providers by cost (descending)
    const sorted = Object.entries(summary.byProvider).sort(
      (a, b) => b[1].costUsd - a[1].costUsd
    );

    for (const [provider, data] of sorted) {
      const pct = summary.totalCostUsd > 0
        ? ((data.costUsd / summary.totalCostUsd) * 100).toFixed(0)
        : "0";
      console.log(
        `  ${chalk.cyan(provider)}  ${formatCost(data.costUsd)} (${pct}%)`
      );

      // Sort models by cost within provider
      const models = Object.entries(data.models).sort(
        (a, b) => b[1].costUsd - a[1].costUsd
      );
      for (const [model, modelData] of models) {
        const bar = "\u2588".repeat(
          Math.max(1, Math.round((modelData.costUsd / summary.totalCostUsd) * 30))
        );
        console.log(
          `    ${chalk.dim(model.padEnd(30))} ${formatCost(modelData.costUsd)}  ${chalk.dim(bar)}  ${modelData.calls} calls`
        );
      }
      console.log();
    }
  });
