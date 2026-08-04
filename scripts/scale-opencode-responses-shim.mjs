#!/usr/bin/env node

// Loopback-only OpenAI Responses compatibility shim for OpenCode's session API.
// This is an adapter, not a DeepSeek API client: all model calls go through the
// authenticated local OpenCode server (OpenCode Go or another configured provider).

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";

const host = process.env.SCALE_OPENCODE_SHIM_HOST ?? "127.0.0.1";
const port = Number(process.env.SCALE_OPENCODE_SHIM_PORT ?? 8787);
const upstream = String(process.env.SCALE_OPENCODE_API_URL ?? process.env.OPENCODE_SERVER_URL ?? "http://127.0.0.1:4096").replace(/\/$/, "");
const fallbackProjectRoot = process.env.SCALE_OPENCODE_PROJECT_ROOT ?? process.cwd();
const projectRootFile = process.env.SCALE_OPENCODE_PROJECT_ROOT_FILE;
const defaultAgent = process.env.SCALE_OPENCODE_SHIM_AGENT ?? "scale-go-routine";
const timeoutMs = Number(process.env.SCALE_OPENCODE_SHIM_TIMEOUT_MS ?? 900000);
const username = process.env.OPENCODE_SERVER_USERNAME ?? "opencode";
const password = process.env.OPENCODE_SERVER_PASSWORD;
const providerAliases = new Map([
  ["opencode-go-native", "opencode-go"],
  ["opencode-native", "opencode"],
  ...((process.env.SCALE_OPENCODE_PROVIDER_ALIASES ?? "").split(",").map((entry) => entry.split("=")).filter(([from, to]) => from && to))
]);
const allowedProviders = new Set(["opencode-go", "opencode", "opencode-go-native", "opencode-native", ...providerAliases.keys(), ...(process.env.SCALE_OPENCODE_ALLOWED_PROVIDERS ?? "").split(",").map((value) => value.trim()).filter(Boolean)]);

if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") throw new Error("SCALE_OPENCODE_SHIM_HOST must be loopback");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("SCALE_OPENCODE_SHIM_PORT must be 1024..65535");
if (!/^https?:\/\//i.test(upstream)) throw new Error("SCALE_OPENCODE_API_URL must be an http(s) URL");
const upstreamHost = new URL(upstream).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(upstreamHost) && process.env.SCALE_OPENCODE_ALLOW_REMOTE !== "1") {
  throw new Error("OpenCode upstream must be loopback (set SCALE_OPENCODE_ALLOW_REMOTE=1 only with an explicit privacy review)");
}
const activeProjectRoot = () => {
  let candidate = fallbackProjectRoot;
  if (projectRootFile) {
    try { candidate = readFileSync(projectRootFile, "utf8").trim() || candidate; } catch { /* fallback remains authoritative */ }
  }
  if (!existsSync(candidate) || !statSync(candidate).isDirectory()) throw new Error("SCALE_OPENCODE_PROJECT_ROOT must be an existing directory");
  return candidate;
};
activeProjectRoot();

const authHeader = password ? `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` : undefined;
const requestJson = async (path, options = {}, directory = activeProjectRoot()) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(`${upstream}${path}`);
    url.searchParams.set("directory", directory);
    const headers = { accept: "application/json, text/event-stream", ...(options.headers ?? {}) };
    if (authHeader) headers.authorization = authHeader;
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    const body = await response.text();
    let parsed = null;
    try { parsed = body ? JSON.parse(body) : null; } catch { /* OpenCode may return text/SSE. */ }
    return { status: response.status, contentType: response.headers.get("content-type") ?? "", body, parsed };
  } finally {
    clearTimeout(timer);
  }
};

const readBody = async (request) => {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 2_000_000) throw Object.assign(new Error("request body too large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const sendJson = (response, status, payload) => {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(payload));
};

const errorPayload = (message, type = "invalid_request_error", code = undefined) => ({
  error: { type, message, ...(code ? { code } : {}) }
});

const extractText = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  if (typeof value.value === "string") return value.value;
  if (typeof value.content === "string") return value.content;
  if (Array.isArray(value.content)) return extractText(value.content);
  return "";
};

const toPrompt = (body) => {
  const sections = [];
  if (typeof body.instructions === "string" && body.instructions.trim()) sections.push(`Instructions:\n${body.instructions.trim()}`);
  const input = extractText(body.input);
  if (input.trim()) sections.push(input.trim());
  return sections.join("\n\n").trim();
};

const splitModel = (model) => {
  const value = String(model ?? "");
  const separator = value.indexOf("/");
  const providerID = separator > 0 ? value.slice(0, separator) : "opencode-go";
  const modelID = separator > 0 ? value.slice(separator + 1) : value;
  if (!modelID || !allowedProviders.has(providerID)) throw Object.assign(new Error("model must use an approved OpenCode provider prefix"), { statusCode: 400 });
  return { providerID: providerAliases.get(providerID) ?? providerID, modelID };
};

const textFromOpenCode = (payload) => {
  const parts = payload?.parts ?? payload?.message?.parts ?? payload?.data?.parts;
  const text = extractText(parts);
  if (text) return text;
  if (typeof payload?.text === "string") return payload.text;
  if (typeof payload?.output === "string") return payload.output;
  return typeof payload === "string" ? payload : JSON.stringify(payload);
};

const usageFromOpenCode = (payload) => {
  const usage = payload?.usage ?? payload?.message?.usage ?? payload?.data?.usage ?? {};
  const input = Number(usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens ?? 0);
  const output = Number(usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens ?? 0);
  const total = Number(usage.total_tokens ?? usage.totalTokens ?? input + output);
  return { input_tokens: Number.isFinite(input) ? input : 0, output_tokens: Number.isFinite(output) ? output : 0, total_tokens: Number.isFinite(total) ? total : input + output };
};

const responseId = () => `resp_scale_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const makeResponse = (id, model, text, usage) => ({
  id,
  object: "response",
  created_at: Math.floor(Date.now() / 1000),
  status: "completed",
  model,
  output: [{ id: `${id}_msg`, type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] }],
  usage
});

const streamResponse = (response, result) => {
  response.statusCode = 200;
  response.setHeader("content-type", "text/event-stream");
  response.setHeader("cache-control", "no-cache");
  response.setHeader("connection", "keep-alive");
  const itemId = result.output[0].id;
  const events = [
    { type: "response.created", response: { ...result, status: "in_progress", output: [] } },
    { type: "response.output_item.added", output_index: 0, item: { id: itemId, type: "message", status: "in_progress", role: "assistant", content: [] } },
    { type: "response.content_part.added", item_id: itemId, output_index: 0, content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", item_id: itemId, output_index: 0, content_index: 0, delta: result.output[0].content[0].text },
    { type: "response.output_text.done", item_id: itemId, output_index: 0, content_index: 0, text: result.output[0].content[0].text },
    { type: "response.content_part.done", item_id: itemId, output_index: 0, content_index: 0, part: result.output[0].content[0] },
    { type: "response.output_item.done", output_index: 0, item: result.output[0] },
    { type: "response.completed", response: result }
  ];
  for (const event of events) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  response.end("data: [DONE]\n\n");
};

const runCompletion = async (body) => {
  const directory = activeProjectRoot();
  const model = String(body.model ?? "");
  const selectedModel = splitModel(model);
  const prompt = toPrompt(body);
  if (!prompt) throw Object.assign(new Error("input or instructions is required"), { statusCode: 400 });
  const effort = typeof body.reasoning === "object" ? body.reasoning?.effort : body.reasoning;
  const variant = typeof effort === "string" && effort !== "none" ? effort : undefined;
  const session = await requestJson("/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: `SCALE native ${model}` }) }, directory);
  const sessionId = session.parsed?.id ?? session.parsed?.session?.id;
  if (session.status < 200 || session.status >= 300 || typeof sessionId !== "string" || !sessionId) {
    throw Object.assign(new Error("OpenCode session creation failed"), { statusCode: session.status >= 400 ? session.status : 502, upstreamStatus: session.status });
  }
  const cleanup = () => requestJson(`/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" }, directory).catch(() => undefined);
  try {
    const message = await requestJson(`/session/${encodeURIComponent(sessionId)}/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: selectedModel, agent: process.env.SCALE_OPENCODE_SHIM_AGENT ?? defaultAgent, ...(variant ? { variant } : {}), parts: [{ type: "text", text: prompt }] })
    }, directory);
    if (message.status < 200 || message.status >= 300) {
      const limit = /(?:quota|rate\s*limit|usage\s*limit|credit|limit\s*reached|429)/i.test(message.body);
      throw Object.assign(new Error(limit ? "OpenCode Go limit reached" : "OpenCode message failed"), { statusCode: limit ? 429 : (message.status >= 400 ? message.status : 502), upstreamStatus: message.status, code: limit ? "opencode_go_limit" : "opencode_message_failed" });
    }
    const id = responseId();
    return makeResponse(id, model, textFromOpenCode(message.parsed ?? message.body), usageFromOpenCode(message.parsed ?? {}));
  } finally {
    await cleanup();
  }
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    if (request.method === "GET" && url.pathname === "/healthz") return sendJson(response, 200, { ok: true, transport: "opencode-openapi", upstream: upstreamHost, project_root: activeProjectRoot(), project_root_file: projectRootFile ?? null });
    if (request.method === "GET" && url.pathname === "/v1/models") return sendJson(response, 200, { object: "list", data: Array.from(allowedProviders).map((provider) => ({ id: `${provider}/*`, object: "model", owned_by: provider })) });
    if (request.method !== "POST" || url.pathname !== "/v1/responses") return sendJson(response, 404, errorPayload("Not found", "invalid_request_error"));
    const body = JSON.parse(await readBody(request));
    const result = await runCompletion(body);
    if (body.stream === true) return streamResponse(response, result);
    return sendJson(response, 200, result);
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
    const type = status === 429 ? "rate_limit_error" : status >= 500 ? "server_error" : "invalid_request_error";
    return sendJson(response, status, errorPayload(error?.message ?? "OpenCode shim request failed", type, error?.code));
  }
});

server.listen(port, host, () => {
  process.stdout.write(`${JSON.stringify({ ok: true, transport: "opencode-openapi", host, port, upstream: upstreamHost, project_root: activeProjectRoot(), project_root_file: projectRootFile ?? null })}\n`);
});

const stop = () => server.close(() => process.exit(0));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
