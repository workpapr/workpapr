import fs from "node:fs";
import path from "node:path";
import type { MonitorEvent } from "./types.js";

export function readMonitorEvents(dir: string): MonitorEvent[] {
  const filePath = path.join(dir, ".workpapr", "monitor.jsonl");
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
  const events: MonitorEvent[] = [];

  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as MonitorEvent);
    } catch {
      // Skip malformed lines
    }
  }

  return events;
}
