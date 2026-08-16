#!/usr/bin/env node
/**
 * The explicit curator-only Memora MCP gateway.
 *
 * This process is intentionally a thin policy/protocol wrapper. It never opens
 * Memora's SQLite file and never makes HTTP calls: all accepted operations are
 * forwarded to the pinned local Memora stdio server.
 */
import fs from "node:fs";
import { spawn } from "node:child_process";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = path.join(ROOT, "integrations", "memora", "memory-plane.json");
const CONTRACT = JSON.parse(fs.readFileSync(CONTRACT_PATH, "utf8"));
const ROLE = "scale_memora_curator";
const SERVER_NAME = "scale_memora_curator";
const UPSTREAM_ENTRY = process.env.SCALE_MEMORA_ENTRY || CONTRACT.entry;
if (UPSTREAM_ENTRY !== CONTRACT.entry) {
  throw new Error("SCALE_MEMORA_ENTRY must equal the pinned contract entry");
}
let UPSTREAM_ARGS = CONTRACT.args;
if (process.env.SCALE_MEMORA_ARGS !== undefined) {
  try {
    UPSTREAM_ARGS = JSON.parse(process.env.SCALE_MEMORA_ARGS);
  } catch {
    throw new Error("SCALE_MEMORA_ARGS must be a JSON array");
  }
  if (!Array.isArray(UPSTREAM_ARGS) || UPSTREAM_ARGS.some((arg) => typeof arg !== "string") || JSON.stringify(UPSTREAM_ARGS) !== JSON.stringify(CONTRACT.args)) {
    throw new Error("SCALE_MEMORA_ARGS must exactly match the pinned contract args");
  }
}
const READ_TOOLS = [
  "memory_digest",
  "memory_semantic_search",
  "memory_hybrid_search",
  "memory_get",
  "memory_stats"
];
const WRITE_TOOLS = ["memory_create", "memory_update", "memory_absorb", "memory_store_document"];
const ADVERTISED_WRITE_TOOLS = ["memory_create", "memory_update"];
const FORBIDDEN_TOOLS = CONTRACT.capabilities.forbidden;
const PROVENANCE_FIELDS = CONTRACT.curator_policy.required_provenance;
const LIMITS = CONTRACT.limits;
const TAG_MATCHERS = [
  /^scale:project:[a-z0-9][a-z0-9-]*$/,
  /^scale:scope:(?:global|project|agent|session)$/,
  /^scale:sensitivity:(?:public|internal|confidential|restricted)$/,
  /^scale:status:(?:candidate|curated|deprecated)$/,
  /^scale:validation:(?:unvalidated|passed|failed|stale)$/,
  /^scale:source:(?:git|operator)$/
];
const SENSITIVE = /(?:api[_-]?key|access[_-]?token|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|credential|\bssn\b|social security|email\s*address|phone\s*number|transcript|audio|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;
const FORBIDDEN_KEYS = /^(?:operation|promotion|git_mutation|direct_sqlite_write|direct_api_write|delete|merge|import|bulk|filesystem)$/i;

const byteLength = (value) => Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value), "utf8");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const reject = (message) => { throw new Error(message); };
const clone = (value) => JSON.parse(JSON.stringify(value));

function scanForbiddenKeys(value) {
  if (Array.isArray(value)) value.forEach(scanForbiddenKeys);
  else if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.test(key)) reject(`forbidden operation field: ${key}`);
      scanForbiddenKeys(child);
    }
  }
}

function validateProvenance(provenance, label, clock = Date.now) {
  if (!isObject(provenance)) reject(`${label} requires complete provenance`);
  for (const field of PROVENANCE_FIELDS) {
    if (typeof provenance[field] !== "string" || provenance[field].trim() === "") {
      reject(`${label} provenance is missing ${field}`);
    }
  }
  if (!CONTRACT.curator_policy.provenance_gate.allowed_status.includes(provenance.status)) {
    reject(`${label} provenance status is not governed`);
  }
  if (provenance.validation !== CONTRACT.curator_policy.provenance_gate.required_validation) {
    reject(`${label} provenance validation must be passed`);
  }
  const expiresAt = Date.parse(provenance.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= clock()) reject(`${label} provenance is invalid or expired`);
  if (byteLength(provenance) > LIMITS.curator_writes.max_provenance_bytes) reject(`${label} provenance exceeds the byte limit`);
  if (SENSITIVE.test(JSON.stringify(provenance))) reject(`${label} provenance is sensitive`);
}

function validateCandidate(candidate, label = "candidate", clock = Date.now) {
  if (!isObject(candidate)) reject(`${label} must be an object`);
  const allowedFields = ["id", "content", "tags", "provenance", "status", "validation"];
  if (Object.keys(candidate).some((key) => !allowedFields.includes(key))) reject(`${label} has unknown fields`);
  if (candidate.id !== undefined && (!Number.isInteger(candidate.id) || candidate.id < 1)) reject(`${label} id must be a positive integer`);
  if (candidate.status !== CONTRACT.curator_policy.candidate_status || candidate.validation !== CONTRACT.curator_policy.validation_status) {
    reject(`${label} must remain candidate/unvalidated`);
  }
  if (typeof candidate.content !== "string" || byteLength(candidate.content) > LIMITS.curator_writes.max_content_bytes) {
    reject(`${label} content exceeds the byte limit`);
  }
  if (!Array.isArray(candidate.tags) || candidate.tags.length > LIMITS.curator_writes.max_tags || candidate.tags.some((tag) => typeof tag !== "string" || !TAG_MATCHERS.some((matcher) => matcher.test(tag)))) {
    reject(`${label} has unknown or excessive SCALE tags`);
  }
  validateProvenance(candidate.provenance, label, clock);
  if (SENSITIVE.test(candidate.content)) reject(`${label} content is sensitive`);
  return candidate;
}

function validateScaleGate(args, clock = Date.now) {
  if (!isObject(args) || !isObject(args.scale_gate)) reject("an explicit scale_gate is required");
  const gate = args.scale_gate;
  const allowedFields = ["role", "task_status", "durable_observation_verified", "evidence_verified", "task_id", "provenance"];
  if (Object.keys(gate).some((key) => !allowedFields.includes(key))) reject("scale_gate has unknown fields");
  if (gate.role !== ROLE) reject("scale_gate role is invalid");
  if (gate.task_status !== CONTRACT.curator_policy.task_gate.required_task_status) reject("scale_gate task_status must be success");
  if (gate.durable_observation_verified !== true) reject("verified durable observation is required");
  if (gate.evidence_verified !== true) reject("verified evidence is required");
  if (typeof gate.task_id !== "string" || gate.task_id.trim() === "") reject("scale_gate task_id is required");
  validateProvenance(gate.provenance, "scale_gate", clock);
  return gate;
}

function validateRequestSize(args) {
  if (byteLength(args) > LIMITS.curator_writes.max_total_request_bytes) reject("request exceeds the curator byte limit");
  if (SENSITIVE.test(JSON.stringify(args))) reject("sensitive input is forbidden");
  scanForbiddenKeys(args);
}

function boundedReadArgs(name, args) {
  if (!isObject(args)) reject(`${name} arguments must be an object`);
  if (byteLength(args) > LIMITS.retrieval.max_payload_bytes) reject("read request exceeds the payload limit");
  if (SENSITIVE.test(JSON.stringify(args))) reject("sensitive input is forbidden");
  const query = args.query ?? args.q;
  if (query !== undefined && (typeof query !== "string" || query.length > LIMITS.retrieval.max_query_chars)) {
    reject("read query exceeds the character limit");
  }
  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > LIMITS.retrieval.max_results)) {
    reject("read result limit exceeds the contract");
  }
  return args;
}

function upstreamCandidateFromGet(result) {
  let root = result?.structuredContent ?? result?.data ?? result;
  if (Array.isArray(root?.content)) {
    const text = root.content.find((item) => item?.type === "text")?.text;
    if (typeof text === "string") {
      try { root = JSON.parse(text); } catch { /* retain the unparsed MCP result */ }
    }
  }
  const candidate = root?.candidate ?? root?.memory ?? root;
  if (!isObject(candidate)) return null;
  return { ...candidate, id: candidate.id ?? candidate.memory_id };
}

function curatorMarker(candidate) {
  return candidate?.metadata?.scale_memora_curator;
}

function reservedMetadata(gate, candidate) {
  return {
    scale_memora_curator: {
      role: ROLE,
      task_id: gate.task_id,
      status: candidate.status,
      validation: candidate.validation,
      provenance: clone(candidate.provenance)
    }
  };
}

function translateCreate(gate, candidate) {
  // Pinned Memora memory_create schema: no internal candidate/id/scale_gate
  // fields are forwarded. The reserved metadata marker is the candidate proof.
  return {
    content: candidate.content,
    metadata: reservedMetadata(gate, candidate),
    tags: [...candidate.tags],
    suggest_similar: false,
    similarity_threshold: 0,
    response_mode: "full"
  };
}

function translateUpdate(gate, target, patch) {
  // Pinned Memora memory_update schema uses numeric memory_id. Only content and
  // tags are mutable here; metadata is replaced with the complete gate marker.
  const translated = { memory_id: target.id };
  if (patch.content !== undefined) translated.content = patch.content;
  if (patch.tags !== undefined) translated.tags = [...patch.tags];
  translated.metadata = reservedMetadata(gate, {
    status: "candidate",
    validation: "unvalidated",
    provenance: gate.provenance
  });
  translated.replace_metadata = true;
  return translated;
}

/**
 * Policy gateway. `upstreamCall` receives (toolName, translatedArguments) and
 * returns the upstream result. Injecting it makes policy tests deterministic.
 */
export function createCuratorGateway({ upstreamCall, now = () => Date.now() } = {}) {
  if (typeof upstreamCall !== "function") reject("an upstream Memora call function is required");
  const call = async (name, args = {}) => {
    if (FORBIDDEN_TOOLS.includes(name)) reject(`${name} is forbidden`);
    if (READ_TOOLS.includes(name)) return upstreamCall(name, boundedReadArgs(name, args));
    if (!WRITE_TOOLS.includes(name)) reject(`tool is outside the curator allowlist: ${name}`);

    validateRequestSize(args);
    const gate = validateScaleGate(args, now);
    if (name === "memory_update") {
        if (Object.keys(args).some((key) => !["scale_gate", "memory_id", "patch"].includes(key))) reject("memory_update wrapper has unknown fields");
        if (!Number.isInteger(args.memory_id) || args.memory_id < 1) reject("memory_update requires numeric memory_id");
        if (!isObject(args.patch)) reject("memory_update requires a patch object");
        if (Object.keys(args.patch).some((key) => !["content", "tags"].includes(key))) reject("memory_update patch has unknown fields");
        const existing = upstreamCandidateFromGet(await upstreamCall("memory_get", { memory_id: args.memory_id }));
        const existingMarker = curatorMarker(existing);
        if (!existing || !Number.isInteger(existing.id) || existing.id !== args.memory_id || existingMarker?.role !== ROLE || existingMarker?.status !== "candidate" || existingMarker?.validation !== "unvalidated") {
          reject("memory_update target is not a proven curator candidate");
        }
        try { validateProvenance(existingMarker.provenance, "existing curator candidate", now); } catch { reject("memory_update target is not a proven curator candidate"); }
        const candidate = validateCandidate({
          id: args.memory_id,
          content: args.patch.content ?? existing.content,
          tags: args.patch.tags ?? existing.tags,
          provenance: gate.provenance,
          status: "candidate",
          validation: "unvalidated"
        }, "memory_update patch", now);
        return upstreamCall(name, translateUpdate(gate, { id: args.memory_id }, candidate));
      }
    if (name === "memory_absorb" || name === "memory_store_document") {
      reject(`${name} is closed until candidate-only upstream semantics are proven`);
    }
    if (Object.keys(args).some((key) => !["scale_gate", "candidate", "candidates"].includes(key))) reject(`${name} wrapper has unknown fields`);
    if (args.candidate !== undefined && args.candidates !== undefined) reject(`${name} must use candidate or candidates, not both`);
    const candidates = args.candidates ?? (args.candidate === undefined ? undefined : [args.candidate]);
    if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > LIMITS.curator_writes.max_candidates) {
      reject(`candidate count must be between 1 and ${LIMITS.curator_writes.max_candidates}`);
    }
    const translated = candidates.map((value) => {
      const candidate = validateCandidate(value, name, now);
      return translateCreate(gate, candidate);
    });
    const results = [];
    for (const payload of translated) results.push(await upstreamCall(name, payload));
    return results.length === 1 ? results[0] : results;
  };
  return { call };
}

export { ADVERTISED_WRITE_TOOLS };

export class StdioJsonRpcClient {
  constructor(command, args, env) {
    this.child = spawn(command, args, { stdio: ["pipe", "pipe", "inherit"], env });
    this.nextId = 1;
    this.pending = new Map();
    this.lines = readline.createInterface({ input: this.child.stdout });
    this.lines.on("line", (line) => this.#receive(line));
    this.child.on("error", (error) => this.#rejectAll(error));
    this.child.on("exit", (code, signal) => this.#rejectAll(new Error(`Memora server exited (${code ?? signal})`)));
  }

  #rejectAll(error) {
    for (const { reject: fail, timer } of this.pending.values()) { clearTimeout(timer); fail(error); }
    this.pending.clear();
  }

  #receive(line) {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message.id === undefined || !this.pending.has(message.id)) return;
    const pending = this.pending.get(message.id);
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(message.error.message || "upstream MCP error"));
    else pending.resolve(message.result);
  }

  notify(method, params) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) })}\n`);
  }

  call(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, fail) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        fail(new Error("upstream Memora call timed out"));
      }, CONTRACT.limits.call_timeout_ms);
      this.pending.set(id, { resolve, reject: fail, timer });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  close() { this.child.kill(); }
}

const candidateSchema = {
  type: "object",
  description: "Candidate content is limited to 4096 UTF-8 bytes; provenance is limited to 2048 UTF-8 bytes.",
  required: ["content", "tags", "provenance", "status", "validation"],
  properties: {
    id: { type: "integer", minimum: 1 },
    content: { type: "string", description: "UTF-8 encoded byte length must be at most 4096." },
    tags: { type: "array", maxItems: 8, items: { type: "string" } },
    provenance: { type: "object" },
    status: { const: "candidate" },
    validation: { const: "unvalidated" }
  },
  additionalProperties: false
};
const gateSchema = {
  type: "object",
  required: ["role", "task_status", "durable_observation_verified", "evidence_verified", "task_id", "provenance"],
  properties: {
    role: { const: ROLE },
    task_status: { const: "success" },
    durable_observation_verified: { const: true },
    evidence_verified: { const: true },
    task_id: { type: "string" },
    provenance: { type: "object" }
  },
  additionalProperties: false
};
const updatePatchSchema = {
  type: "object",
  properties: {
    content: { type: "string", description: "UTF-8 encoded byte length must be at most 4096." },
    tags: { type: "array", maxItems: 8, items: { type: "string" } }
  },
  additionalProperties: false
};
const toolSchema = (name) => ({
  name,
  description: READ_TOOLS.includes(name)
    ? "Bounded read forwarded to the pinned local Memora server."
    : "Candidate-only write; requires an explicit successful scale_gate.",
  inputSchema: READ_TOOLS.includes(name)
    ? { type: "object", additionalProperties: true }
    : name === "memory_update"
      ? { type: "object", required: ["scale_gate", "memory_id", "patch"], properties: { scale_gate: gateSchema, memory_id: { type: "integer", minimum: 1 }, patch: updatePatchSchema }, additionalProperties: false }
      : { type: "object", required: ["scale_gate"], properties: { scale_gate: gateSchema, candidate: candidateSchema, candidates: { type: "array", minItems: 1, maxItems: 3, items: candidateSchema } }, additionalProperties: false }
});
export const advertisedToolSchemas = () => [...READ_TOOLS, ...ADVERTISED_WRITE_TOOLS].map(toolSchema);

async function runStdioServer() {
  if (CONTRACT.source_revision === null || process.env.SCALE_MEMORA_SOURCE_REVISION !== CONTRACT.source_revision || process.env.SCALE_MEMORA_CURATOR_ENABLE !== "1") {
    throw new Error("Memora curator gateway is fail-closed: pin the contract source revision, match SCALE_MEMORA_SOURCE_REVISION, and set explicit enablement");
  }
  const home = process.env.HOME || "/tmp";
  const databasePath = CONTRACT.storage.path.replace(/^~(?=\/)/, home);
  const env = {
    HOME: home,
    PATH: process.env.PATH || "/usr/bin:/bin",
    MEMORA_DB_PATH: databasePath,
    MEMORA_LLM_ENABLED: "false",
    MEMORA_EMBEDDING_MODEL: "tfidf",
    MEMORA_EMBEDDING_STRICT: "1",
    MEMORA_TRANSPORT: "stdio"
  };
  const client = new StdioJsonRpcClient(UPSTREAM_ENTRY, UPSTREAM_ARGS, env);
  let initialized = false;
  const gateway = createCuratorGateway({ upstreamCall: (name, args) => client.call("tools/call", { name, arguments: args }) });
  const respond = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let request;
    try { request = JSON.parse(line); } catch { return; }
    if (request.method === "notifications/initialized") return;
    if (request.method === "initialize") {
      try {
        await client.call("initialize", { protocolVersion: request.params?.protocolVersion ?? "2024-11-05", capabilities: {}, clientInfo: { name: SERVER_NAME, version: "1.0.0" } });
        client.notify("notifications/initialized");
        initialized = true;
        respond({ jsonrpc: "2.0", id: request.id, result: { protocolVersion: request.params?.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: SERVER_NAME, version: "1.0.0" } } });
      } catch (error) {
        respond({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message: error.message } });
      }
      return;
    }
    if (request.method === "ping") { respond({ jsonrpc: "2.0", id: request.id, result: {} }); return; }
    if (request.method === "tools/list") { if (!initialized) { respond({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message: "initialize is required" } }); return; } respond({ jsonrpc: "2.0", id: request.id, result: { tools: advertisedToolSchemas() } }); return; }
    if (request.method !== "tools/call") return;
    if (!initialized) { respond({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message: "initialize is required" } }); return; }
    try {
      const result = await gateway.call(request.params?.name, request.params?.arguments ?? {});
      respond({ jsonrpc: "2.0", id: request.id, result: { structuredContent: result, content: [{ type: "text", text: JSON.stringify(result) }] } });
    } catch (error) {
      respond({ jsonrpc: "2.0", id: request.id, result: { isError: true, content: [{ type: "text", text: error.message }] } });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStdioServer().catch((error) => { console.error(`scale_memora_curator: ${error.message}`); process.exit(1); });
}
