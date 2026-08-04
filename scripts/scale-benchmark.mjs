#!/usr/bin/env node
/**
 * Offline-first direct-vs-SCALE benchmark comparator.
 *
 * Input traces are JSONL objects keyed by task_id.  Runner commands are opt-in:
 * they receive SCALE_BENCHMARK_TASK_JSON for each corpus task and must emit one
 * JSON object for that task on stdout.  No runner is started unless --allow-run
 * is supplied, so using this script never invokes a model by default.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const value = (name, fallback = undefined) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const result = args[index + 1];
  if (!result || result.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return result;
};
const required = (name) => {
  const result = value(name);
  if (!result) throw new Error(`Missing required ${name}`);
  return result;
};
const toNumber = (input, field, taskId) => {
  if (input === undefined || input === null) return 0;
  const number = Number(input);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${taskId}: ${field} must be a non-negative number`);
  return number;
};
const optionalNumber = (input, field, taskId) => {
  if (input === undefined || input === null) return null;
  return toNumber(input, field, taskId);
};
const toBoolean = (input, field, taskId) => {
  if (input === undefined || input === null) return false;
  if (typeof input !== "boolean") throw new Error(`${taskId}: ${field} must be boolean when supplied`);
  return input;
};
const readJsonLines = (file) => fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line, index) => {
  try { return JSON.parse(line); } catch { throw new Error(`${file}:${index + 1}: invalid JSONL`); }
});
const readCorpus = (file) => {
  const source = fs.readFileSync(file, "utf8").trim();
  if (!source) throw new Error(`Corpus is empty: ${file}`);
  let records;
  try {
    const parsed = JSON.parse(source);
    records = Array.isArray(parsed) ? parsed : parsed.tasks;
  } catch { records = readJsonLines(file); }
  if (!Array.isArray(records)) throw new Error(`${file}: corpus must be a JSON array, {tasks: []}, or JSONL`);
  const ids = new Set();
  return records.map((task, index) => {
    if (!task || typeof task !== "object" || typeof task.task_id !== "string" || !task.task_id) throw new Error(`${file}:${index + 1}: task_id is required`);
    if (task.acceptance === undefined || task.acceptance === null || task.acceptance === "") throw new Error(`${task.task_id}: acceptance criteria are required`);
    if (ids.has(task.task_id)) throw new Error(`${file}: duplicate task_id ${task.task_id}`);
    ids.add(task.task_id);
    return { task_id: task.task_id, acceptance: task.acceptance };
  });
};
const safeRecord = (record, lane, task) => {
  if (!record || typeof record !== "object") throw new Error(`${lane}/${task.task_id}: trace record must be an object`);
  if (record.task_id !== task.task_id) throw new Error(`${lane}/${task.task_id}: trace task_id mismatch`);
  const knowledge = record.knowledge_reuse;
  const knowledgeReuse = Array.isArray(knowledge) ? knowledge.length : toNumber(knowledge, "knowledge_reuse", task.task_id);
  return {
    task_id: task.task_id,
    acceptance_present: true,
    success: toBoolean(record.success, "success", task.task_id),
    first_pass: toBoolean(record.first_pass, "first_pass", task.task_id),
    escalation_count: toNumber(record.escalation_count ?? record.escalations, "escalation_count", task.task_id),
    calls: toNumber(record.calls, "calls", task.task_id),
    context_bytes: toNumber(record.context_bytes, "context_bytes", task.task_id),
    context_tokens: toNumber(record.context_tokens, "context_tokens", task.task_id),
    input_tokens: toNumber(record.input_tokens, "input_tokens", task.task_id),
    output_tokens: toNumber(record.output_tokens, "output_tokens", task.task_id),
    tokens: toNumber(record.tokens, "tokens", task.task_id),
    codex_tokens: optionalNumber(record.codex_tokens ?? ((record.codex_input_tokens ?? record.codex_output_tokens) !== undefined
      ? toNumber(record.codex_input_tokens, "codex_input_tokens", task.task_id) + toNumber(record.codex_output_tokens, "codex_output_tokens", task.task_id)
      : undefined), "codex_tokens", task.task_id),
    cost_usd: toNumber(record.cost_usd, "cost_usd", task.task_id),
    wall_time_ms: toNumber(record.wall_time_ms, "wall_time_ms", task.task_id),
    human_intervention: toBoolean(record.human_intervention, "human_intervention", task.task_id),
    regression: toBoolean(record.regression, "regression", task.task_id),
    knowledge_reuse: knowledgeReuse,
  };
};
const collectTrace = (lane, tracePath, command, corpus) => {
  let records;
  if (tracePath) records = readJsonLines(tracePath);
  else {
    if (!args.includes("--allow-run")) throw new Error(`${lane}: runner commands require --allow-run; recorded traces are the default`);
    records = corpus.map((task) => {
      const result = spawnSync(command, { shell: true, encoding: "utf8", env: { ...process.env, SCALE_BENCHMARK_TASK_JSON: JSON.stringify(task) } });
      if (result.error || result.status !== 0) throw new Error(`${lane}/${task.task_id}: runner failed (${result.error?.message ?? result.stderr.trim() ?? result.status})`);
      const lines = result.stdout.split(/\r?\n/).filter(Boolean);
      if (lines.length !== 1) throw new Error(`${lane}/${task.task_id}: runner must emit exactly one JSON object`);
      try { return JSON.parse(lines[0]); } catch { throw new Error(`${lane}/${task.task_id}: runner output is not JSON`); }
    });
  }
  const byId = new Map();
  for (const record of records) {
    if (!record || typeof record.task_id !== "string") throw new Error(`${lane}: every trace record needs task_id`);
    if (byId.has(record.task_id)) throw new Error(`${lane}: duplicate trace task_id ${record.task_id}`);
    byId.set(record.task_id, record);
  }
  if (byId.size !== corpus.length) throw new Error(`${lane}: trace has ${byId.size} records but corpus has ${corpus.length}`);
  return corpus.map((task) => {
    const record = byId.get(task.task_id);
    if (!record) throw new Error(`${lane}: missing task ${task.task_id}`);
    return safeRecord(record, lane, task);
  });
};
const sum = (records, key) => records.reduce((total, record) => total + record[key], 0);
const summary = (records) => {
  const count = records.length;
  const yes = (key) => sum(records, key) / count;
  const totalTokens = sum(records, "tokens") || sum(records, "input_tokens") + sum(records, "output_tokens");
  const codexTokenValues = records.map((record) => record.codex_tokens).filter((value) => value !== null);
  return {
    tasks: count,
    success_rate: yes("success"),
    first_pass_rate: yes("first_pass"),
    human_intervention_rate: yes("human_intervention"),
    regression_rate: yes("regression"),
    total_escalations: sum(records, "escalation_count"),
    total_calls: sum(records, "calls"),
    total_context_bytes: sum(records, "context_bytes"),
    total_context_tokens: sum(records, "context_tokens"),
    total_input_tokens: sum(records, "input_tokens"),
    total_output_tokens: sum(records, "output_tokens"),
    total_tokens: totalTokens,
    total_codex_tokens: codexTokenValues.length === records.length ? codexTokenValues.reduce((total, value) => total + value, 0) : null,
    codex_tokens_reported: codexTokenValues.length === records.length,
    total_cost_usd: sum(records, "cost_usd"),
    total_wall_time_ms: sum(records, "wall_time_ms"),
    total_knowledge_reuse: sum(records, "knowledge_reuse"),
    escalation_rate: sum(records, "escalation_count") / count,
  };
};
const numericOption = (name, fallback, minimum = 0) => {
  const raw = value(name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < minimum) throw new Error(`${name} must be a number >= ${minimum}`);
  return parsed;
};
const compare = (direct, scale) => {
  const maxSuccessDrop = numericOption("--max-success-drop", 0.05);
  const maxFirstPassDrop = numericOption("--max-first-pass-drop", 0.05);
  const maxWallTimeRatio = numericOption("--max-wall-time-ratio", 1.15, 1);
  const maxCostRatio = numericOption("--max-cost-ratio", 1.15, 1);
  const maxCallRatio = numericOption("--max-call-ratio", 1.25, 1);
  const maxEscalationRate = numericOption("--max-escalation-rate", 0.20);
  const minCodexTokenReduction = numericOption("--min-codex-token-reduction", 0.25);
  const ratio = (numerator, denominator) => denominator === 0 ? null : numerator / denominator;
  const reductionCheck = direct.total_codex_tokens === null || direct.total_codex_tokens === 0 || scale.total_codex_tokens === null
    ? { metric: "codex_tokens", pass: true, applicable: false, delta_or_ratio: null, threshold: `reported on both lanes; reduction >= ${minCodexTokenReduction}` }
    : { metric: "codex_tokens", pass: scale.total_codex_tokens <= direct.total_codex_tokens * (1 - minCodexTokenReduction), applicable: true, delta_or_ratio: 1 - (scale.total_codex_tokens / direct.total_codex_tokens), threshold: `reduction >= ${minCodexTokenReduction}` };
  const checks = [
    ["success", scale.success_rate >= direct.success_rate - maxSuccessDrop, scale.success_rate - direct.success_rate, `>= direct - ${maxSuccessDrop}`],
    ["first_pass", scale.first_pass_rate >= direct.first_pass_rate - maxFirstPassDrop, scale.first_pass_rate - direct.first_pass_rate, `>= direct - ${maxFirstPassDrop}`],
    ["regression", scale.regression_rate <= direct.regression_rate, scale.regression_rate - direct.regression_rate, "<= direct"],
    ["human_intervention", scale.human_intervention_rate <= direct.human_intervention_rate, scale.human_intervention_rate - direct.human_intervention_rate, "<= direct"],
    ["wall_time", ratio(scale.total_wall_time_ms, direct.total_wall_time_ms) === null || ratio(scale.total_wall_time_ms, direct.total_wall_time_ms) <= maxWallTimeRatio, ratio(scale.total_wall_time_ms, direct.total_wall_time_ms), `<= ${maxWallTimeRatio}x direct`],
    ["cost", ratio(scale.total_cost_usd, direct.total_cost_usd) === null || ratio(scale.total_cost_usd, direct.total_cost_usd) <= maxCostRatio, ratio(scale.total_cost_usd, direct.total_cost_usd), `<= ${maxCostRatio}x direct`],
    ["calls", ratio(scale.total_calls, direct.total_calls) === null || ratio(scale.total_calls, direct.total_calls) <= maxCallRatio, ratio(scale.total_calls, direct.total_calls), `<= ${maxCallRatio}x direct`],
    ["escalation_rate", scale.escalation_rate <= maxEscalationRate, scale.escalation_rate, `<= ${maxEscalationRate}`],
  ].map(([metric, pass, delta, threshold]) => ({ metric, pass, applicable: true, delta_or_ratio: delta, threshold }));
  checks.push(reductionCheck);
  return { passed: checks.every((check) => check.pass), checks };
};
const writeNew = (file, contents) => {
  if (!file) return;
  const destination = path.resolve(file);
  if (fs.existsSync(destination)) throw new Error(`Refusing to overwrite existing benchmark output: ${destination}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, contents);
};

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: scale-benchmark.mjs --corpus tasks.json|jsonl (--direct-trace direct.jsonl --scale-trace scale.jsonl | --direct-command '...' --scale-command '...' --allow-run) [--json-out report.json] [--jsonl-out metrics.jsonl] [--max-escalation-rate 0.20] [--min-codex-token-reduction 0.25]");
  process.exit(0);
}
const corpus = readCorpus(path.resolve(required("--corpus")));
if ((!value("--direct-trace") && !value("--direct-command")) || (!value("--scale-trace") && !value("--scale-command"))) throw new Error("Provide a trace or runner command for both direct and SCALE lanes");
const direct = collectTrace("direct", value("--direct-trace") && path.resolve(value("--direct-trace")), value("--direct-command"), corpus);
const scale = collectTrace("scale", value("--scale-trace") && path.resolve(value("--scale-trace")), value("--scale-command"), corpus);
const taskMetrics = corpus.map((task, index) => ({ task_id: task.task_id, direct: direct[index], scale: scale[index] }));
const report = { schema_version: 1, mode: value("--direct-trace") ? "recorded-traces" : "runner-commands", corpus_tasks: corpus.length, direct: summary(direct), scale: summary(scale) };
report.threshold_comparison = compare(report.direct, report.scale);
writeNew(value("--json-out"), `${JSON.stringify(report, null, 2)}\n`);
writeNew(value("--jsonl-out"), `${taskMetrics.map((metric) => JSON.stringify(metric)).join("\n")}\n`);
console.log(JSON.stringify(report, null, 2));
