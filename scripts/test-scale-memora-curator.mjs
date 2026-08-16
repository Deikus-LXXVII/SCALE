#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(fs.readFileSync(path.join(root, "integrations/memora/memory-plane.json"), "utf8"));
const policy = contract.curator_policy;
const limits = contract.limits.curator_writes;
const provenanceFields = policy.required_provenance;
const writeTools = contract.capabilities.curator.candidate_write;
const forbiddenTools = contract.capabilities.forbidden;
const forbiddenOperations = policy.forbidden_operations;
const tagMatchers = [
  /^scale:project:[a-z0-9][a-z0-9-]*$/,
  /^scale:scope:(?:global|project|agent|session)$/,
  /^scale:sensitivity:(?:public|internal|confidential|restricted)$/,
  /^scale:status:(?:candidate|curated|deprecated)$/,
  /^scale:validation:(?:unvalidated|passed|failed|stale)$/,
  /^scale:source:(?:git|operator)$/
];
const sensitive = /(?:api[_-]?key|access[_-]?token|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|credential|\bssn\b|social security|email\s*address|phone\s*number|transcript|audio|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;

const bytes = (value) => Buffer.byteLength(JSON.stringify(value), "utf8");
const reject = (message) => { throw new Error(message); };

// This is a deterministic contract exercise, not a Memora client or runtime.
// It proves the declared boundary without opening SQLite, MCP, or an API.
function validateCandidateRequest(request) {
  if (request.role !== policy.role) reject("only the explicit curator role may write candidates");
  if (request.promotion === true || request.git_mutation === true) reject("promotion and Git mutation are forbidden");
  if (forbiddenOperations.includes(request.operation)) reject("operation is outside the curator capability boundary");
  if (!writeTools.includes(request.tool) || forbiddenTools.includes(request.tool)) reject("tool is outside the candidate-write allowlist");
  if (request.task?.status !== policy.task_gate.required_task_status) reject("task must be explicitly successful");
  if (request.task.status === "failed" || request.task.status === "partial" || request.task.status === "unknown") reject("failed, partial, and unknown tasks cannot write");
  if (request.task.durable_observation?.verified !== true) reject("verified durable observation is required");
  if (request.task.evidence?.verified !== true) reject("verified evidence is required");
  if (!Array.isArray(request.candidates) || request.candidates.length < 1 || request.candidates.length > limits.max_candidates) reject("candidate count exceeds contract");

  for (const candidate of request.candidates) {
    if (candidate.status !== policy.candidate_status || candidate.validation !== policy.validation_status) reject("candidate must remain candidate/unvalidated");
    if (typeof candidate.content !== "string" || bytes(candidate.content) > limits.max_content_bytes) reject("candidate content exceeds contract");
    if (!Array.isArray(candidate.tags) || candidate.tags.length > limits.max_tags || candidate.tags.some((tag) => !tagMatchers.some((matcher) => matcher.test(tag)))) reject("unknown or excessive tag");
    if (!candidate.provenance || provenanceFields.some((field) => typeof candidate.provenance[field] !== "string" || candidate.provenance[field].trim() === "")) reject("complete provenance is required");
    if (!policy.provenance_gate.allowed_status.includes(candidate.provenance.status) || candidate.provenance.validation !== policy.provenance_gate.required_validation) reject("provenance must be current and validated");
    const expiresAt = Date.parse(candidate.provenance.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) reject("invalid or expired provenance is rejected");
    if (bytes(candidate.provenance) > limits.max_provenance_bytes) reject("provenance exceeds contract");
    if (sensitive.test(candidate.content) || sensitive.test(JSON.stringify(candidate.provenance))) reject("sensitive content is forbidden");
  }
  if (bytes(request) > limits.max_total_request_bytes) reject("request exceeds contract");
  const telemetry = request.telemetry;
  const expectedTelemetry = ["decision", "reason", "task_id", "candidate_id", "curator_role", "binding"];
  if (!telemetry || Object.keys(telemetry).length !== expectedTelemetry.length || expectedTelemetry.some((field) => typeof telemetry[field] !== "string" || telemetry[field].trim() === "") || Object.keys(telemetry).some((key) => !expectedTelemetry.includes(key)) || telemetry.curator_role !== policy.role || telemetry.binding !== "gpt-5.6-sol/high" || sensitive.test(JSON.stringify(telemetry))) reject("telemetry must contain six typed, credential-free fields");
  return { decision: "candidate_submitted", candidate_ids: request.candidates.map(({ id }) => id), telemetry };
}

const baseProvenance = Object.fromEntries(provenanceFields.map((field) => [field, field === "expires_at" ? "2099-01-01T00:00:00Z" : `fixture-${field}`]));
baseProvenance.status = "candidate";
baseProvenance.validation = policy.provenance_gate.required_validation;
const base = {
  role: "scale_memora_curator",
  tool: "memory_create",
  task: { id: "task-001", status: "success", durable_observation: { verified: true }, evidence: { verified: true } },
  candidates: [{ id: "candidate-001", content: "A bounded, observed fixture fact.", tags: ["scale:project:fixture", "scale:scope:project", "scale:sensitivity:internal", "scale:status:candidate", "scale:validation:unvalidated", "scale:source:operator"], provenance: baseProvenance, status: "candidate", validation: "unvalidated" }],
  telemetry: { decision: "submit", reason: "verified_success", task_id: "task-001", candidate_id: "candidate-001", curator_role: "scale_memora_curator", binding: "gpt-5.6-sol/high" }
};

assert.doesNotThrow(() => validateCandidateRequest(base), "valid successful candidate write contract must pass");
assert.throws(() => validateCandidateRequest({ ...base, task: { ...base.task, status: "failed" } }), /successful|failed/);
assert.throws(() => validateCandidateRequest({ ...base, task: { ...base.task, evidence: { verified: false } } }), /evidence/);
assert.throws(() => validateCandidateRequest({ ...base, candidates: [{ ...base.candidates[0], tags: ["scale:unknown:tag"] }] }), /tag/);
assert.throws(() => validateCandidateRequest({ ...base, candidates: [{ ...base.candidates[0], provenance: { ...baseProvenance, source: undefined } }] }), /provenance/);
assert.throws(() => validateCandidateRequest({ ...base, candidates: [{ ...base.candidates[0], provenance: { ...baseProvenance, validation: "unvalidated" } }] }), /candidate|provenance/);
assert.throws(() => validateCandidateRequest({ ...base, candidates: [{ ...base.candidates[0], content: "credential api_key=not-real" }] }), /sensitive/);
assert.throws(() => validateCandidateRequest({ ...base, candidates: [{ ...base.candidates[0], content: "contact user@example.com" }] }), /sensitive/);
assert.throws(() => validateCandidateRequest({ ...base, candidates: [{ ...base.candidates[0], content: "x".repeat(limits.max_content_bytes + 1) }] }), /content/);
assert.throws(() => validateCandidateRequest({ ...base, padding: "x".repeat(limits.max_total_request_bytes) }), /request/);
assert.throws(() => validateCandidateRequest({ ...base, tool: "memory_delete" }), /allowlist/);
assert.throws(() => validateCandidateRequest({ ...base, operation: "direct_sqlite_write" }), /boundary/);
assert.throws(() => validateCandidateRequest({ ...base, operation: "direct_api_write" }), /boundary/);
assert.throws(() => validateCandidateRequest({ ...base, role: "scale_builder" }), /role/);
assert.throws(() => validateCandidateRequest({ ...base, promotion: true }), /promotion/);
assert.throws(() => validateCandidateRequest({ ...base, telemetry: { ...base.telemetry, content: "must-not-emit" } }), /telemetry/);
assert.throws(() => validateCandidateRequest({ ...base, telemetry: { ...base.telemetry, reason: "api_key=must-not-emit" } }), /telemetry/);
assert.throws(() => validateCandidateRequest({ ...base, telemetry: { ...base.telemetry, candidate_id: 42 } }), /telemetry/);
assert.throws(() => validateCandidateRequest({ ...base, candidates: Array.from({ length: limits.max_candidates + 1 }, (_, index) => ({ ...base.candidates[0], id: `candidate-${index}` })) }), /candidate count/);
assert.throws(() => validateCandidateRequest({ ...base, candidates: [{ ...base.candidates[0], provenance: { ...baseProvenance, expires_at: "not-a-date" } }] }), /invalid/);
assert.throws(() => validateCandidateRequest({ ...base, candidates: [{ ...base.candidates[0], provenance: { ...baseProvenance, expires_at: "2000-01-01T00:00:00Z" } }] }), /expired/);

console.log("Validated Memora curator contract fixtures: success gate, evidence, tags, provenance, privacy, budgets, destructive boundary, role, promotion, and telemetry.");
