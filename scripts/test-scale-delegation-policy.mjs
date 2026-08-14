#!/usr/bin/env node
/** Focused regression checks for the delegation-first execution contract. */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const failures = [];
const requireValue = (condition, message) => {
  if (!condition) failures.push(message);
};

let registry;
try {
  registry = JSON.parse(read("library/model-registry.json"));
} catch (error) {
  console.error(`Cannot read model registry: ${error.message}`);
  process.exit(1);
}

const policy = registry.runtime_policy?.delegation_policy;
requireValue(policy?.enabled === true, "delegation policy is not enabled");
requireValue(policy?.required_for_compound_tasks === true, "compound tasks are not delegation-first");
requireValue(policy?.coordinator_roles?.join(",") === "session_root,scale_orchestrator", "delegation policy coordinator roles drifted");
requireValue(policy?.minimum_delegated_executors === 1, "compound tasks must require one executor");
requireValue(policy?.default_executor_count === 1, "token-saving default must be one executor");
requireValue(policy?.parallel_only_when_independent === true, "parallel delegation lacks independence guard");
requireValue(policy?.orchestrator_may_implement === false, "orchestrator may implement compound work");
requireValue(policy?.repair_requires_delegation === true, "repairs are not delegated");
requireValue(policy?.direct_route_requires_single_atomic_mutation === true, "direct route is broader than one atomic mutation");
requireValue(policy?.main_agent_pre_dispatch_actions?.join(",") === "classify,read_routing_metadata,write_work_order,dispatch", "pre-dispatch action contract drifted");
requireValue(policy?.main_agent_post_dispatch_actions?.join(",") === "inspect_result,run_batched_validation,report", "post-dispatch action contract drifted");
for (const forbidden of ["self_implement_compound_task", "broad_unbounded_scan_before_dispatch", "per_bullet_test_loop", "silent_self_repair"]) {
  requireValue(policy?.main_agent_forbidden_actions?.includes(forbidden), `missing forbidden main-agent action: ${forbidden}`);
}

const validation = registry.runtime_policy?.validation_policy;
requireValue(!Object.hasOwn(validation ?? {}, "max_repair_cycles"), "fixed repair-cycle limit must be removed");
requireValue(validation?.repair_control?.mode === "delegated_until_stop", "repairs must continue only through delegated stop-controlled work");
requireValue(validation?.repair_control?.unbounded === true, "repair control must not cap passes by count");
requireValue(validation?.repair_control?.requires_delegation === true, "repair control lost delegation requirement");
requireValue(validation?.repair_control?.requires_batch_validation === true, "repair control lost batch-validation requirement");
requireValue(validation?.repair_control?.self_repair === false, "repair control must forbid self-repair");
for (const stop of ["acceptance_satisfied", "operator_cancelled", "budget_exhausted", "repeated_no_progress", "unsafe_boundary", "native_escalation_required"]) {
  requireValue(validation?.repair_control?.stop_conditions?.includes(stop), `missing repair stop condition: ${stop}`);
}
requireValue(validation?.telemetry?.repair_stop_events_required === true, "repair stop telemetry is not required");
requireValue(/repair pass count is not a termination condition/i.test(validation?.repair_control?.stop_semantics ?? ""), "repair stop semantics do not document count-free termination");

const coldContext = registry.runtime_policy?.cold_context_policy;
requireValue(coldContext?.enabled === true, "cold-context Memora gate is not enabled");
requireValue(coldContext?.fail_closed === true, "cold-context retrieval must fail closed");
requireValue(coldContext?.results_untrusted === true, "cold-context retrieval must remain untrusted");
requireValue(coldContext?.normal_agents_may_write === false, "normal agents must not write to Memora");
requireValue(coldContext?.on_unavailable_or_insufficient_provenance === "block_or_escalate_native", "cold-context retrieval must block or escalate on insufficient provenance");
requireValue(coldContext?.retrieval?.read_only === true && coldContext?.retrieval?.bounded_by_contract === true, "cold-context retrieval must use bounded read-only Memora");
requireValue(coldContext?.retrieval?.contract === "integrations/memora/memory-plane.json", "cold-context retrieval must use the existing Memora contract");

const memoraSkill = read("skills/memora-memory-plane/SKILL.md");
for (const phrase of ["cold context", "fail closed", "insufficient provenance", "native Codex", "must not write to Memora"]) {
  requireValue(memoraSkill.toLowerCase().includes(phrase.toLowerCase()), `Memora skill missing cold-context safety phrase: ${phrase}`);
}

const plaintextPolicy = registry.runtime_policy?.plaintext_external_policy;
for (const [field, expected] of [
  ["no_previous_response", true],
  ["plaintext_context_only", true],
  ["context_freshness_required", true],
  ["cold_context_requires_memora_attestation", true],
  ["reject_hidden_context", true],
  ["reject_encrypted_context", true],
  ["native_route_when_hidden_context_essential", true],
  ["automatic_native_fallback", false]
]) {
  requireValue(plaintextPolicy?.[field] === expected, `plaintext policy ${field} drifted`);
}

const agents = read("AGENTS.md");
const orchestratorSkill = read("skills/scale-orchestrator/SKILL.md");
const brief = read("skills/scale-orchestrator/references/task-brief.md");
const twitchSkill = read("integrations/twitchbot/skills/twitchbot-scale-orchestration/SKILL.md");
for (const [label, source] of [
  ["AGENTS.md", agents],
  ["scale-orchestrator skill", orchestratorSkill],
  ["task brief", brief],
  ["TwitchBot orchestration skill", twitchSkill]
]) {
  requireValue(/delegat/i.test(source), `${label} does not describe delegation`);
  requireValue(/one|at least one|одн/i.test(source), `${label} does not preserve the one-executor default`);
  requireValue(/repair|исправ/i.test(source), `${label} does not describe delegated repair`);
}
requireValue(/OpenCode Go|OpenCode/i.test(orchestratorSkill), "orchestrator skill lost OpenCode boundary reference");

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`S.C.A.L.E. delegation policy: ${failure}`));
  process.exit(1);
}

console.log("Validated delegation-first policy, one-executor default, bounded repair, and project orchestration contract.");
