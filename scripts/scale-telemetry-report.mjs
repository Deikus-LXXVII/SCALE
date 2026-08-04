#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const result = args[index + 1];
  if (!result || result.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return result;
};

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: scale-telemetry-report.mjs --input <scale-telemetry.jsonl> [--json]");
  process.exit(0);
}

let input;
try {
  input = path.resolve(value("--input"));
} catch (error) {
  console.error(`S.C.A.L.E.: ${error.message}`);
  process.exit(2);
}

let events;
try {
  events = fs.readFileSync(input, "utf8").split("\n").filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`invalid JSONL at line ${index + 1}: ${error.message}`);
    }
  });
} catch (error) {
  console.error(`S.C.A.L.E.: cannot read telemetry ${input}: ${error.message}`);
  process.exit(1);
}

const tasks = new Map();
for (const event of events) {
  const taskId = event.task_id ?? `unknown-${tasks.size + 1}`;
  const task = tasks.get(taskId) ?? { events: [], profiles: new Set(), models: new Set(), outcome: null, acceptance: null };
  task.events.push(event.event);
  if (event.profile) task.profiles.add(event.profile);
  if (event.model) task.models.add(event.model);
  if (event.task_outcome_metadata?.task_outcome) task.outcome = event.task_outcome_metadata.task_outcome;
  if (event.task_outcome_metadata?.acceptance_outcome) task.acceptance = event.task_outcome_metadata.acceptance_outcome;
  tasks.set(taskId, task);
}

const counts = Object.fromEntries(["completed", "budget_adjusted", "fallback_required", "rejected"].map((event) => [event, events.filter((entry) => entry.event === event).length]));
const measuredTasks = [...tasks.values()].filter((task) => task.events.includes("completed") || task.events.includes("fallback_required"));
const fallbackTasks = measuredTasks.filter((task) => task.events.includes("fallback_required"));
const byProfile = {};
const byModel = {};
const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, events_reported: 0 };
const outcomeCounts = {};
const acceptanceCounts = {};
for (const event of events) {
  if (event.profile) byProfile[event.profile] = (byProfile[event.profile] ?? 0) + 1;
  if (event.model) byModel[event.model] = (byModel[event.model] ?? 0) + 1;
  if (event.usage && typeof event.usage === "object") {
    const fields = ["input_tokens", "output_tokens", "total_tokens", "cost_usd"];
    const reported = fields.some((field) => Number.isFinite(Number(event.usage[field])));
    if (reported) {
      usage.events_reported += 1;
      for (const field of fields) if (Number.isFinite(Number(event.usage[field]))) usage[field] += Number(event.usage[field]);
    }
  }
  const outcome = event.task_outcome_metadata?.task_outcome;
  const acceptance = event.task_outcome_metadata?.acceptance_outcome;
  if (outcome) outcomeCounts[outcome] = (outcomeCounts[outcome] ?? 0) + 1;
  if (acceptance) acceptanceCounts[acceptance] = (acceptanceCounts[acceptance] ?? 0) + 1;
}
const report = {
  schema_version: 2,
  input,
  events: events.length,
  tasks: measuredTasks.length,
  counts,
  fallback_rate: measuredTasks.length === 0 ? 0 : Number((fallbackTasks.length / measuredTasks.length).toFixed(4)),
  by_profile: byProfile,
  by_model: byModel,
  usage,
  task_outcomes: outcomeCounts,
  acceptance_outcomes: acceptanceCounts,
  elapsed_ms: events.reduce((sum, event) => sum + (Number(event.elapsed_ms) || 0), 0)
};

if (args.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`S.C.A.L.E. telemetry: ${report.tasks} measured task(s), fallback rate ${(report.fallback_rate * 100).toFixed(1)}%, ${report.events} event(s).`);
  console.log(`Completed: ${counts.completed}; budget adjusted: ${counts.budget_adjusted}; fallback required: ${counts.fallback_required}; rejected: ${counts.rejected}.`);
  for (const [profile, count] of Object.entries(byProfile).sort()) console.log(`  ${profile}: ${count} event(s)`);
}
