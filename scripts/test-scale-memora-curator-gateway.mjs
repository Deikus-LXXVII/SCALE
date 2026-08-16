#!/usr/bin/env node
import assert from "node:assert/strict";
import { advertisedToolSchemas, createCuratorGateway, createSerializedQueue } from "./scale-memora-curator-gateway.mjs";

const advertised = advertisedToolSchemas();
assert.deepEqual(advertised.map(({ name }) => name).slice(-2), ["memory_create", "memory_update"]);
assert.equal(advertised.some(({ name }) => name === "memory_absorb" || name === "memory_store_document"), false);
assert.equal(advertised.find(({ name }) => name === "memory_create").inputSchema.properties.candidate.properties.id.type, "integer");
assert.match(advertised.find(({ name }) => name === "memory_create").inputSchema.properties.candidate.description, /UTF-8/);

const queue = createSerializedQueue();
const ordering = [];
let releaseFirst;
const first = queue(async () => {
  ordering.push("initialize:start");
  await new Promise((resolve) => { releaseFirst = resolve; });
  ordering.push("initialize:end");
});
const following = queue(async () => { ordering.push("tools:list"); });
await Promise.resolve();
assert.deepEqual(ordering, ["initialize:start"], "following JSON-RPC work must wait for initialize");
releaseFirst();
await Promise.all([first, following]);
assert.deepEqual(ordering, ["initialize:start", "initialize:end", "tools:list"]);

const now = Date.parse("2026-08-16T00:00:00Z");
const provenanceFields = [
  "source", "evidence", "compatibility", "validated_on", "review_after",
  "source_commit", "source_path", "content_hash", "project", "scope",
  "sensitivity", "status", "validation", "expires_at", "sync_policy"
];
const provenance = Object.fromEntries(provenanceFields.map((field) => [
  field,
  field === "expires_at" ? "2099-01-01T00:00:00Z" : `fixture-${field}`
]));
provenance.status = "candidate";
provenance.validation = "passed";
const candidate = {
  id: 17,
  content: "A bounded, observed fixture fact.",
  tags: [
    "scale:project:fixture",
    "scale:scope:project",
    "scale:sensitivity:internal",
    "scale:status:candidate",
    "scale:validation:unvalidated",
    "scale:source:operator"
  ],
  provenance,
  status: "candidate",
  validation: "unvalidated"
};
const scale_gate = {
  role: "scale_memora_curator",
  task_status: "success",
  durable_observation_verified: true,
  evidence_verified: true,
  task_id: "task-001",
  provenance: { ...provenance }
};
const base = { scale_gate, candidate };

const exactContent = `${"€".repeat(1365)}a`;
assert.equal(Buffer.byteLength(exactContent, "utf8"), 4096);
const boundaryGateway = createCuratorGateway({
  now: () => now,
  upstreamCall: async (name, args) => ({ ok: true, name, args })
});
await assert.doesNotReject(() => boundaryGateway.call("memory_create", {
  scale_gate,
  candidate: { ...candidate, content: exactContent }
}));
const overBoundaryContent = `${exactContent}b`;
assert.equal(Buffer.byteLength(overBoundaryContent, "utf8"), 4097);
await assert.rejects(() => boundaryGateway.call("memory_create", {
  scale_gate,
  candidate: { ...candidate, content: overBoundaryContent }
}), /content/);

const forwarded = [];
const gateway = createCuratorGateway({
  now: () => now,
  upstreamCall: async (name, args) => {
    forwarded.push({ name, args });
    return { ok: true, name, args };
  }
});

const createResult = await gateway.call("memory_create", base);
assert.equal(createResult.ok, true);
assert.equal(forwarded[0].name, "memory_create");
assert.equal(forwarded[0].args.scale_gate, undefined, "scale_gate must never reach upstream");
assert.deepEqual(Object.keys(forwarded[0].args).sort(), ["content", "metadata", "response_mode", "similarity_threshold", "suggest_similar", "tags"]);
assert.equal(forwarded[0].args.metadata.scale_memora_curator.role, "scale_memora_curator");
assert.equal(forwarded[0].args.metadata.scale_memora_curator.task_id, "task-001");
assert.deepEqual(forwarded[0].args.tags, ["note"]);
assert.deepEqual(forwarded[0].args.metadata.scale_memora_curator.tags, candidate.tags);
assert.equal(forwarded[0].args.suggest_similar, false);

await gateway.call("memory_create", {
  scale_gate,
  candidates: [1, 2, 3].map((index) => ({ ...candidate, id: index }))
});
assert.deepEqual(forwarded.slice(1).map(({ name }) => name), ["memory_create", "memory_create", "memory_create"], "bounded multi-candidate wrapper must use individual upstream calls");

const updateCalls = [];
const updateGateway = createCuratorGateway({
  now: () => now,
  upstreamCall: async (name, args) => {
    updateCalls.push({ name, args });
    if (name === "memory_get") return { structuredContent: { memory: { id: candidate.id, content: candidate.content, tags: ["note"], metadata: { scale_memora_curator: { role: "scale_memora_curator", task_id: "task-001", status: "candidate", validation: "unvalidated", tags: candidate.tags, provenance } } } } };
    return { ok: true };
  }
});
await updateGateway.call("memory_update", {
  scale_gate,
  memory_id: candidate.id,
  patch: { content: "Updated bounded fixture fact." }
});
assert.deepEqual(updateCalls.map(({ name }) => name), ["memory_get", "memory_update"]);
assert.equal(updateCalls[1].args.scale_gate, undefined);
assert.deepEqual(updateCalls[0].args, { memory_id: candidate.id });
assert.deepEqual(Object.keys(updateCalls[1].args).sort(), ["content", "memory_id", "metadata", "replace_metadata", "tags"]);
assert.deepEqual(updateCalls[1].args.tags, ["note"]);
assert.deepEqual(updateCalls[1].args.metadata.scale_memora_curator.tags, candidate.tags);

const rejects = [
  [{ ...base, scale_gate: undefined }, /scale_gate/],
  [{ ...base, scale_gate: { ...scale_gate, task_status: "partial" } }, /success/],
  [{ ...base, scale_gate: { ...scale_gate, evidence_verified: false } }, /evidence/],
  [{ ...base, candidate: { ...candidate, tags: ["scale:unknown:tag"] } }, /tags/],
  [{ ...base, candidate: { ...candidate, content: "api_key=not-real" } }, /sensitive/],
  [{ ...base, candidate: { ...candidate, provenance: { ...provenance, expires_at: "2000-01-01T00:00:00Z" } } }, /expired|invalid/],
  [{ ...base, candidate: { ...candidate, status: "curated" } }, /candidate\/unvalidated/],
  [{ ...base, operation: "direct_sqlite_write" }, /forbidden operation/],
  [{ ...base, promotion: true }, /forbidden operation/],
  [{ ...base, candidate: { ...candidate, content: "x".repeat(4097) } }, /content/],
  [{ scale_gate, candidates: [candidate, candidate, candidate, candidate] }, /candidate count/],
  [{ ...base, padding: "x".repeat(8192) }, /request/],
  [{ ...base, memory_id: 17, patch: { content: "x" } }, /unknown fields/]
];
for (const [request, pattern] of rejects) {
  await assert.rejects(() => gateway.call("memory_create", request), pattern);
}

await assert.rejects(
  () => gateway.call("memory_delete", {}),
  /forbidden/
);
await assert.rejects(
  () => gateway.call("memory_semantic_search", { query: "x".repeat(513) }),
  /query/
);
await assert.rejects(
  () => gateway.call("memory_absorb", base),
  /candidate-only upstream semantics/
);
await assert.rejects(
  () => gateway.call("memory_store_document", base),
  /candidate-only upstream semantics/
);
const closedUpdateGateway = createCuratorGateway({
  now: () => now,
  upstreamCall: async (name) => name === "memory_get" ? { structuredContent: { memory: { id: candidate.id, content: candidate.content, tags: candidate.tags, metadata: { scale_memora_curator: { role: "other", status: "candidate", validation: "unvalidated" } } } } } : { ok: true }
});
await assert.rejects(
  () => closedUpdateGateway.call("memory_update", { scale_gate, memory_id: candidate.id, patch: { content: "x" } }),
  /proven curator candidate/
);

console.log("Validated curator gateway: gate enforcement, bounded reads, translation/stripping, candidate-only update verification, privacy, budgets, and closed destructive boundaries.");
