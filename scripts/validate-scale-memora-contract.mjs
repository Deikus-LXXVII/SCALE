#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = path.join(ROOT, "integrations", "memora", "memory-plane.json");
const SKILL_PATH = path.join(ROOT, "skills", "memora-memory-plane", "SKILL.md");
const CONFIG_PATH = path.join(ROOT, ".codex", "config.toml");

const failures = [];
const fail = (message) => failures.push(message);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isPlainString = (value) => typeof value === "string" && value.trim().length > 0;
const sameArray = (actual, expected) => Array.isArray(actual)
  && actual.length === expected.length
  && actual.every((value, index) => value === expected[index]);
const hasOwn = (value, key) => isObject(value) && Object.prototype.hasOwnProperty.call(value, key);

const EXPECTED = {
  read: [
    "memory_digest",
    "memory_semantic_search",
    "memory_hybrid_search",
    "memory_get",
    "memory_stats"
  ],
  write: ["memory_create", "memory_update", "memory_absorb", "memory_store_document"],
  forbidden: ["memory_delete", "memory_delete_batch", "memory_merge", "memory_import", "memory_create_batch"],
  destructiveBoundary: {
    delete: "forbidden",
    merge: "forbidden",
    import: "forbidden",
    bulk: "forbidden",
    filesystem: "forbidden"
  },
  provenance: [
    "source",
    "evidence",
    "compatibility",
    "validated_on",
    "review_after",
    "source_commit",
    "source_path",
    "content_hash",
    "project",
    "scope",
    "sensitivity",
    "status",
    "validation",
    "expires_at",
    "sync_policy"
  ],
  tags: [
    "scale:project:<slug>",
    "scale:scope:global|project|agent|session",
    "scale:sensitivity:public|internal|confidential|restricted",
    "scale:status:candidate|curated|deprecated",
    "scale:validation:unvalidated|passed|failed|stale",
    "scale:source:git|operator"
  ]
};

let contract;
try {
  contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, "utf8"));
} catch (error) {
  fail(`cannot parse contract JSON: ${error.message}`);
}

if (contract !== undefined) {
  if (!isObject(contract)) fail("contract root must be an object");
  if (contract.schema_version !== 1) fail("schema_version must be 1");
  if (!isPlainString(contract.id)) fail("id must be a non-empty string");
  if (contract.status !== "proposed") fail("status must be proposed");

  if (!isObject(contract.source)) {
    fail("source must contain repository and license");
  } else {
    if (!isPlainString(contract.source.repository)) fail("source.repository must be a non-empty string");
    if (!isPlainString(contract.source.license)) fail("source.license must be a non-empty string");
  }
  if (contract.source_revision !== null) fail("source_revision must be null until pinned");

  if (contract.activation !== "disabled_until_pinned") fail("activation must be disabled_until_pinned");
  if (contract.transport !== "stdio") fail("transport must be stdio");
  if (contract.entry !== "memora-server") fail("entry must be memora-server");
  if (!sameArray(contract.args, ["--no-graph"])) fail("args must be exactly [\"--no-graph\"]");
  if (contract.authority !== "scale-git") fail("authority must be scale-git");
  if (contract.sync_policy !== "manual-export") fail("sync_policy must be manual-export");

  const storage = contract.storage;
  if (!isObject(storage)) {
    fail("storage must default to local SQLite");
  } else {
    if (storage.kind !== "sqlite") fail("storage.kind must be sqlite");
    if (storage.scope !== "local") fail("storage.scope must be local");
    if (storage.default !== true) fail("storage.default must be true");
    if (storage.network_access !== false) fail("storage.network_access must be false");
    if (!isPlainString(storage.path)) fail("storage.path must be a non-empty local path");
    if (/^https?:\/\//i.test(storage.path)) fail("storage.path must not be a public URL");
  }

  if (!isObject(contract.network)) {
    fail("network policy must explicitly disable public HTTP and cloud");
  } else {
    if (contract.network.public_http !== false) fail("network.public_http must be false");
    if (contract.network.cloud !== false) fail("network.cloud must be false");
  }

  const llm = contract.llm;
  if (!isObject(llm)) {
    fail("llm policy must explicitly disable embeddings, deduplication, and chat");
  } else {
    for (const key of ["enabled", "embeddings", "deduplication", "chat"]) {
      if (llm[key] !== false) fail(`llm.${key} must be false`);
    }
  }

  const policy = contract.policy;
  if (!isObject(policy)) {
    fail("policy must fail closed for tags, untrusted memory, and destructive tools");
  } else {
    if (policy.allow_any_tag !== false) fail("policy.allow_any_tag must be false");
    if (!sameArray(policy.forbidden_environment, ["MEMORA_ALLOW_ANY_TAG"])) {
      fail("policy.forbidden_environment must contain only MEMORA_ALLOW_ANY_TAG");
    }
    if (policy.destructive_tools !== "forbidden_by_default") fail("destructive tools must be forbidden_by_default");
    if (policy.memory_is_untrusted !== true) fail("policy.memory_is_untrusted must be true");
    if (policy.normal_agents !== "read_only") fail("policy.normal_agents must be read_only");
  }

  const coldContext = contract.cold_context;
  if (!isObject(coldContext)) {
    fail("cold_context gate must be present");
  } else {
    if (coldContext.required_before_inactive_context_action !== true) fail("cold_context must be required before inactive-context action");
    if (coldContext.fail_closed !== true) fail("cold_context must fail closed");
    if (coldContext.results_untrusted !== true) fail("cold_context results must remain untrusted");
    if (coldContext.normal_agents !== "read_only") fail("cold_context.normal_agents must be read_only");
    if (coldContext.on_unavailable_or_insufficient_provenance !== "block_or_escalate_native") fail("cold_context must block or escalate on unavailable or insufficient provenance");
    if (!sameArray(coldContext.retrieval_tools, EXPECTED.read)) fail("cold_context.retrieval_tools must be exactly the normal-agent read tools");
    if (!sameArray(coldContext.required_provenance, EXPECTED.provenance)) fail("cold_context.required_provenance must be the exact SCALE provenance envelope");
  }

  const limits = contract.limits;
  if (!isObject(limits) || !isObject(limits.retrieval) || !isObject(limits.curator_writes)) {
    fail("limits must define retrieval and curator_writes budgets");
  } else {
    const positive = [
      ["limits.retrieval.max_results", limits.retrieval.max_results, 100],
      ["limits.retrieval.max_query_chars", limits.retrieval.max_query_chars, 4096],
      ["limits.retrieval.max_payload_bytes", limits.retrieval.max_payload_bytes, 1048576],
      ["limits.curator_writes.max_candidates", limits.curator_writes.max_candidates, 50],
      ["limits.curator_writes.max_content_bytes", limits.curator_writes.max_content_bytes, 1048576],
      ["limits.curator_writes.max_tags", limits.curator_writes.max_tags, 32],
      ["limits.call_timeout_ms", limits.call_timeout_ms, 30000]
    ];
    for (const [name, value, ceiling] of positive) {
      if (!Number.isInteger(value) || value < 1 || value > ceiling) {
        fail(`${name} must be an integer from 1 to ${ceiling}`);
      }
    }
  }

  const capabilities = contract.capabilities;
  if (!isObject(capabilities)) {
    fail("capabilities must separate normal reads, curator candidate writes, validator reads, and forbidden tools");
  } else {
    if (!isObject(capabilities.normal_agents) || !sameArray(capabilities.normal_agents.read, EXPECTED.read)) {
      fail("normal_agents.read must be exactly the published memory_* read tools");
    }
    if (!isObject(capabilities.curator) || !sameArray(capabilities.curator.candidate_write, EXPECTED.write)) {
      fail("curator.candidate_write must be exactly the published memory_* candidate-write tools");
    }
    if (!isObject(capabilities.validators) || !sameArray(capabilities.validators.read, EXPECTED.read)) {
      fail("validators.read must be exactly the published memory_* read tools");
    }
    if (!sameArray(capabilities.forbidden, EXPECTED.forbidden)) {
      fail("capabilities.forbidden must be exactly the published destructive memory_* tools");
    }
    const normal = capabilities.normal_agents?.read ?? [];
    const validator = capabilities.validators?.read ?? [];
    const writes = capabilities.curator?.candidate_write ?? [];
    if (normal.some((name) => EXPECTED.write.includes(name)) || validator.some((name) => EXPECTED.write.includes(name))) {
      fail("read capabilities must not include candidate-write methods");
    }
    if (writes.some((name) => EXPECTED.read.includes(name))) fail("candidate writes must not include read methods");
    if (!isObject(capabilities.destructive_boundary)
      || JSON.stringify(capabilities.destructive_boundary) !== JSON.stringify(EXPECTED.destructiveBoundary)) {
      fail("capabilities.destructive_boundary must forbid delete/merge/import/bulk/filesystem conceptually");
    }
  }

  if (!isObject(contract.provenance) || !sameArray(contract.provenance.required_fields, EXPECTED.provenance)) {
    fail("provenance.required_fields must contain the exact SCALE provenance envelope");
  }
  if (!isObject(contract.tags) || !sameArray(contract.tags.allowlist, EXPECTED.tags)) {
    fail("tags.allowlist does not match the exact SCALE allowlist");
  } else if (contract.tags.allowlist.some((tag) => !tag.startsWith("scale:") || /[*?]/.test(tag))) {
    fail("tags.allowlist must contain only explicit SCALE namespace patterns without wildcards");
  }

  if (!isObject(contract.model_policy)) {
    fail("model_policy must route any model call through the SCALE/OpenCode dispatcher");
  } else {
    if (contract.model_policy.direct_api !== false) fail("model_policy.direct_api must be false");
    if (contract.model_policy.route !== "scale-opencode-dispatcher") fail("model_policy.route must be scale-opencode-dispatcher");
    if (contract.model_policy.native_fallback !== "scale-orchestrator") fail("model_policy.native_fallback must be scale-orchestrator");
  }

  const credentialKey = /(?:api[_-]?key|access[_-]?token|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret)/i;
  const directApiPattern = /(?:deepseek\s*(?:api|endpoint)|(?:api|endpoint)\s*deepseek|deepseek\.com|\/v\d+\/(?:chat|responses))/i;
  const visit = (value, key = "") => {
    if (credentialKey.test(key)) fail(`credential-like field is forbidden: ${key}`);
    if (typeof value === "string" && directApiPattern.test(value)) fail("direct DeepSeek/API endpoint reference is forbidden");
    if (Array.isArray(value)) value.forEach((item) => visit(item, key));
    else if (isObject(value)) Object.entries(value).forEach(([childKey, childValue]) => visit(childValue, childKey));
  };
  visit(contract);
}

let skill;
try {
  skill = fs.readFileSync(SKILL_PATH, "utf8");
} catch (error) {
  fail(`cannot read Memora skill: ${error.message}`);
}

if (skill !== undefined) {
  const frontmatter = skill.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!frontmatter) {
    fail("Memora skill must have YAML frontmatter");
  } else {
    const header = frontmatter[1];
    const name = header.match(/^name:\s*(\S+)\s*$/m)?.[1];
    const description = header.match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if (name !== "memora-memory-plane") fail("Memora skill frontmatter name must be memora-memory-plane");
    if (!isPlainString(description)) fail("Memora skill frontmatter description must be non-empty");
  }
  const requiredPhrases = [
    "runtime memory/index",
    "not the S.C.A.L.E. rules",
    "local stdio",
    "local SQLite",
    "public HTTP",
    "untrusted data",
    "read-only retrieval",
    "bounded curator",
    "scale_knowledge_eval",
    "scale_qa",
    "scale_git",
    "source, evidence, compatibility, validated_on, review_after, source_commit",
    "source_path",
    "content_hash",
    "project",
    "scope",
    "sensitivity",
    "status",
    "validation",
    "expires_at",
    "sync_policy",
    "bounded retrieval",
    "cold context",
    "fail-closed",
    "insufficient provenance",
    "native Codex",
    "must not write to Memora",
    "allowlist",
    "MEMORA_ALLOW_ANY_TAG",
    "LLM embeddings",
    "deduplication",
    "chat",
    "No direct DeepSeek API",
    "S.C.A.L.E./OpenCode dispatcher",
    "Destructive tools are forbidden"
  ];
  const lower = skill.toLowerCase();
  for (const phrase of requiredPhrases) {
    if (!lower.includes(phrase.toLowerCase())) fail(`Memora skill is missing safety phrase: ${phrase}`);
  }
}

let config;
try {
  config = fs.readFileSync(CONFIG_PATH, "utf8");
} catch (error) {
  fail(`cannot read Codex config: ${error.message}`);
}
if (config !== undefined) {
  const entries = [...config.matchAll(/\[\[skills\.config\]\]([\s\S]*?)(?=\n\[\[|$)/g)]
    .map((match) => match[1]);
  const memoraEntries = entries.filter((entry) => /path\s*=\s*["']\.\/skills\/memora-memory-plane["']/.test(entry));
  if (memoraEntries.length !== 1 || !/enabled\s*=\s*true/.test(memoraEntries[0] ?? "")) {
    fail(".codex/config.toml must enable exactly one Memora skill entry");
  }
}

if (failures.length) {
  for (const finding of failures) console.error(`S.C.A.L.E. Memora contract: ${finding}`);
  process.exit(1);
}

console.log("Validated SCALE Memora contract: fail-closed local stdio/SQLite proposal, bounded capabilities, provenance, skill, and config.");
