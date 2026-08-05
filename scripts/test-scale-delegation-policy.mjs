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
