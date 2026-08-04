#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "scale-benchmark-"));
try {
  const corpus = path.join(fixture, "tasks.json");
  const direct = path.join(fixture, "direct.jsonl");
  const scale = path.join(fixture, "scale.jsonl");
  const report = path.join(fixture, "report.json");
  const metrics = path.join(fixture, "metrics.jsonl");
  fs.writeFileSync(corpus, JSON.stringify([{ task_id: "one", acceptance: "tests pass" }, { task_id: "two", acceptance: { exit_code: 0 } }]));
  fs.writeFileSync(direct, '{"task_id":"one","success":true,"first_pass":true,"calls":1,"tokens":10,"codex_tokens":10,"wall_time_ms":10}\n{"task_id":"two","success":true,"first_pass":false,"calls":2,"tokens":20,"codex_tokens":20,"wall_time_ms":10}\n');
  fs.writeFileSync(scale, '{"task_id":"one","success":true,"first_pass":true,"calls":1,"tokens":8,"codex_tokens":7,"wall_time_ms":11,"knowledge_reuse":["safe-reference"]}\n{"task_id":"two","success":true,"first_pass":true,"calls":2,"tokens":16,"codex_tokens":14,"wall_time_ms":11,"knowledge_reuse":["safe-reference"]}\n');
  execFileSync(process.execPath, [path.join(root, "scripts", "scale-benchmark.mjs"), "--corpus", corpus, "--direct-trace", direct, "--scale-trace", scale, "--json-out", report, "--jsonl-out", metrics], { stdio: "pipe" });
  const parsed = JSON.parse(fs.readFileSync(report, "utf8"));
  if (!parsed.threshold_comparison.passed || parsed.scale.total_knowledge_reuse !== 2 || parsed.threshold_comparison.checks.find((check) => check.metric === "codex_tokens")?.applicable !== true) throw new Error("benchmark report did not preserve expected metrics");
  if (fs.readFileSync(metrics, "utf8").trim().split("\n").length !== 2) throw new Error("benchmark did not emit one credential-free metrics line per task");
  let overwriteRejected = false;
  try { execFileSync(process.execPath, [path.join(root, "scripts", "scale-benchmark.mjs"), "--corpus", corpus, "--direct-trace", direct, "--scale-trace", scale, "--json-out", report], { stdio: "pipe" }); } catch { overwriteRejected = true; }
  if (!overwriteRejected) throw new Error("benchmark overwrote an existing report");
  console.log("Validated offline SCALE benchmark fixture and overwrite protection.");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
