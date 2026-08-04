#!/usr/bin/env node

// SCALE's native Codex gateway. Codex talks to the built-in OpenAI provider
// over /v1/responses; this loopback service routes the namespaced
// opencode-go/<model> slug to the matching OpenCode Go protocol. It keeps
// tool execution in Codex by translating function definitions and tool-call
// history, rather than delegating a whole turn to an OpenCode session.

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";

const host = process.env.SCALE_OPENCODE_GATEWAY_HOST ?? "127.0.0.1";
const port = Number(process.env.SCALE_OPENCODE_GATEWAY_PORT ?? process.env.SCALE_OPENCODE_SHIM_PORT ?? 8787);
const baseUrl = String(process.env.SCALE_OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1").replace(/\/$/, "");
const openaiBaseUrl = String(process.env.SCALE_OPENAI_UPSTREAM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const timeoutMs = Number(process.env.SCALE_OPENCODE_GATEWAY_TIMEOUT_MS ?? 1800000);
const authPath = process.env.SCALE_OPENCODE_AUTH_FILE ?? "/Users/lxxvii/.local/share/opencode/auth.json";
const allowedModels = new Set([
  "deepseek-v4-flash", "deepseek-v4-pro", "glm-5.1", "glm-5.2", "gpt-5.6-luna",
  "grok-4.5", "hy3", "kimi-k2.6", "kimi-k2.7-code", "kimi-k3", "mimo-v2.5",
  "mimo-v2.5-pro", "minimax-m2.7", "minimax-m3", "qwen3.6-plus", "qwen3.7-max",
  "qwen3.7-plus", "qwen3.8-max"
]);
const messagesModels = new Set(["minimax-m2.7", "minimax-m3", "qwen3.6-plus", "qwen3.7-max", "qwen3.7-plus", "qwen3.8-max"]);
const responseModels = new Set(["gpt-5.6-luna"]);

if (!["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error("SCALE_OPENCODE_GATEWAY_HOST must be loopback");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("SCALE_OPENCODE_GATEWAY_PORT must be 1024..65535");
if (!/^https:\/\//i.test(baseUrl) && !(process.env.SCALE_OPENCODE_ALLOW_INSECURE_TEST === "1" && /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):/i.test(baseUrl))) throw new Error("SCALE_OPENCODE_GO_BASE_URL must use https");
if (!existsSync(authPath) && !process.env.OPENCODE_GO_API_KEY) throw new Error(`OpenCode Go auth not found at ${authPath}; set OPENCODE_GO_API_KEY in the process environment`);
if (existsSync(authPath) && !statSync(authPath).isFile()) throw new Error("SCALE_OPENCODE_AUTH_FILE must be a file");

const readApiKey = () => {
  if (process.env.OPENCODE_GO_API_KEY) return String(process.env.OPENCODE_GO_API_KEY);
  const parsed = JSON.parse(readFileSync(authPath, "utf8"));
  const key = parsed?.["opencode-go"]?.key;
  if (typeof key !== "string" || !key.trim()) throw new Error("OpenCode Go auth file has no opencode-go key");
  return key.trim();
};

const responseId = (prefix = "resp_scale") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const readBody = async (request) => {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 4_000_000) throw Object.assign(new Error("request body too large"), { statusCode: 413 });
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
const errorPayload = (message, type = "invalid_request_error", code) => ({ error: { type, message, ...(code ? { code } : {}) } });
const withTimeout = async (url, options) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};
const textOf = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  if (typeof value.value === "string") return value.value;
  if (typeof value.content === "string") return value.content;
  if (Array.isArray(value.content)) return textOf(value.content);
  return "";
};
const contentParts = (value, input = false) => {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return textOf(value);
  return value.map((part) => {
    if (typeof part === "string") return part;
    if (!part || typeof part !== "object") return "";
    if (part.type === "input_text" || part.type === "output_text" || part.type === "text") return { type: input ? "text" : "text", text: part.text ?? "" };
    if (part.type === "input_image" && part.image_url) return { type: "image_url", image_url: { url: part.image_url } };
    return textOf(part);
  }).filter(Boolean);
};
const modelId = (value) => {
  const slug = String(value ?? "");
  const prefix = "opencode-go/";
  const id = slug.startsWith(prefix) ? slug.slice(prefix.length) : slug;
  if (!allowedModels.has(id)) throw Object.assign(new Error(`Unsupported OpenCode Go model: ${slug}`), { statusCode: 400, code: "unsupported_model" });
  return id;
};
const routeFor = (id) => responseModels.has(id) ? "responses" : messagesModels.has(id) ? "messages" : "chat";

const toMessages = (body) => {
  const messages = [];
  if (typeof body.instructions === "string" && body.instructions.trim()) messages.push({ role: "system", content: body.instructions });
  const input = Array.isArray(body.input) ? body.input : [{ type: "message", role: "user", content: body.input ?? "" }];
  for (const item of input) {
    if (typeof item === "string") { messages.push({ role: "user", content: item }); continue; }
    if (!item || typeof item !== "object") continue;
    if (item.type === "message") {
      const role = item.role === "developer" ? "system" : (item.role ?? "user");
      messages.push({ role, content: contentParts(item.content, role === "user") });
    } else if (item.type === "function_call") {
      const last = messages.at(-1);
      const toolCall = { id: item.call_id ?? item.id ?? responseId("call"), type: "function", function: { name: item.name, arguments: item.arguments ?? "{}" } };
      if (last?.role === "assistant") last.tool_calls = [...(last.tool_calls ?? []), toolCall];
      else messages.push({ role: "assistant", content: null, tool_calls: [toolCall] });
    } else if (item.type === "function_call_output") {
      messages.push({ role: "tool", tool_call_id: item.call_id ?? item.id, content: textOf(item.output) });
    } else if (item.type === "reasoning") {
      const text = textOf(item.summary ?? item.content);
      if (text) messages.push({ role: "assistant", content: text });
    }
  }
  return messages;
};

const toTools = (tools = []) => tools.flatMap((tool) => {
  if (!tool || typeof tool !== "object") return [];
  if (tool.type === "function") return [{ type: "function", function: { name: tool.name ?? tool.function?.name, description: tool.description ?? tool.function?.description ?? "", parameters: tool.parameters ?? tool.function?.parameters ?? { type: "object", properties: {} }, ...(tool.strict === undefined ? {} : { strict: tool.strict }) } }];
  if (tool.type === "custom") return [{ type: "function", function: { name: tool.name, description: tool.description ?? "", parameters: tool.format ?? { type: "object", properties: { input: { type: "string" } }, required: ["input"] } } }];
  return [];
});
const effortOf = (body) => typeof body.reasoning === "object" ? body.reasoning?.effort : body.reasoning;
const chatRequest = (body, id) => ({
  model: id,
  messages: toMessages(body),
  ...(toTools(body.tools).length ? { tools: toTools(body.tools) } : {}),
  ...(body.tool_choice ? { tool_choice: body.tool_choice } : {}),
  ...(body.parallel_tool_calls === undefined ? {} : { parallel_tool_calls: body.parallel_tool_calls }),
  ...(effortOf(body) && effortOf(body) !== "none" ? { reasoning_effort: effortOf(body) } : {}),
  ...(Number.isFinite(Number(body.max_output_tokens)) ? { max_tokens: Number(body.max_output_tokens) } : {}),
  stream: true
});
const messagesRequest = (body, id) => ({
  model: id,
  messages: toMessages(body).filter((message) => message.role !== "system"),
  ...(toMessages(body).find((message) => message.role === "system") ? { system: toMessages(body).find((message) => message.role === "system").content } : {}),
  ...(toTools(body.tools).length ? { tools: toTools(body.tools).map((tool) => ({ name: tool.function.name, description: tool.function.description, input_schema: tool.function.parameters })) } : {}),
  max_tokens: Number(body.max_output_tokens ?? 4096),
  ...(effortOf(body) && effortOf(body) !== "none" ? { thinking: { type: "enabled", budget_tokens: Math.max(1024, Math.min(32768, Number(body.max_output_tokens ?? 4096))) } } : {}),
  stream: true
});
const responseRequest = (body, id) => ({ ...body, model: id, stream: true });

const writeEvent = (response, event) => response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
const responseShell = (id, model) => ({ id, object: "response", created_at: Math.floor(Date.now() / 1000), status: "in_progress", model, output: [], usage: null });
const usageFrom = (usage = {}) => ({ input_tokens: Number(usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens ?? 0), output_tokens: Number(usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens ?? 0), total_tokens: Number(usage.total_tokens ?? usage.totalTokens ?? 0) });
const finalResponse = (id, model, output, usage = {}) => ({ id, object: "response", created_at: Math.floor(Date.now() / 1000), status: "completed", model, output, usage: usageFrom(usage) });

const parseSse = async function* (response) {
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += Buffer.from(chunk).toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try { yield JSON.parse(data); } catch { /* ignore provider comments */ }
    }
  }
};

const upstreamHeaders = () => ({ authorization: `Bearer ${readApiKey()}`, "content-type": "application/json", accept: "text/event-stream, application/json" });
const nativeHeaders = (request) => ({ authorization: request.headers.authorization ?? (process.env.OPENAI_API_KEY ? `Bearer ${process.env.OPENAI_API_KEY}` : ""), "content-type": "application/json", accept: "text/event-stream, application/json" });
const upstream = async (path, body) => {
  const result = await withTimeout(`${baseUrl}${path}`, { method: "POST", headers: upstreamHeaders(), body: JSON.stringify(body) });
  if (!result.ok) {
    const message = await result.text();
    const limit = result.status === 429 || /quota|rate.?limit|usage.?limit|credit/i.test(message);
    throw Object.assign(new Error(limit ? "OpenCode Go limit reached" : `OpenCode Go upstream failed (${result.status})`), { statusCode: limit ? 429 : Math.max(502, result.status), code: limit ? "opencode_go_limit" : "opencode_go_upstream" });
  }
  return result;
};

const streamChat = async (response, body, model, upstreamResponse) => {
  const id = responseId(); const shell = responseShell(id, body.model); response.statusCode = 200; response.setHeader("content-type", "text/event-stream"); response.setHeader("cache-control", "no-cache"); response.setHeader("connection", "keep-alive"); writeEvent(response, { type: "response.created", response: shell });
  const text = []; const calls = new Map(); let usage = {};
  for await (const chunk of parseSse(upstreamResponse)) {
    const choice = chunk.choices?.[0]; const delta = choice?.delta ?? {};
    if (delta.content) { text.push(delta.content); writeEvent(response, { type: "response.output_text.delta", item_id: `${id}_msg`, output_index: 0, content_index: 0, delta: delta.content }); }
    for (const part of delta.tool_calls ?? []) {
      const index = Number(part.index ?? calls.size); const current = calls.get(index) ?? { id: part.id ?? responseId("call"), name: "", arguments: "" }; if (part.id) current.id = part.id; if (part.function?.name) current.name += part.function.name; if (part.function?.arguments) { current.arguments += part.function.arguments; writeEvent(response, { type: "response.function_call_arguments.delta", item_id: current.id, output_index: index, delta: part.function.arguments }); } calls.set(index, current);
    }
    if (chunk.usage) usage = chunk.usage;
  }
  const output = []; if (text.length) output.push({ id: `${id}_msg`, type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: text.join(""), annotations: [] }] });
  for (const [index, call] of calls) { const item = { id: call.id, type: "function_call", status: "completed", call_id: call.id, name: call.name, arguments: call.arguments }; output.push(item); writeEvent(response, { type: "response.function_call_arguments.done", item_id: call.id, output_index: index, arguments: call.arguments }); writeEvent(response, { type: "response.output_item.done", output_index: index, item }); }
  const result = finalResponse(id, body.model, output, usage); writeEvent(response, { type: "response.completed", response: result }); response.end("data: [DONE]\n\n");
};

const collectChat = async (body, model, upstreamResponse) => {
  const text = []; const calls = new Map(); let usage = {};
  for await (const chunk of parseSse(upstreamResponse)) { const delta = chunk.choices?.[0]?.delta ?? {}; if (delta.content) text.push(delta.content); for (const part of delta.tool_calls ?? []) { const i = Number(part.index ?? calls.size); const call = calls.get(i) ?? { id: part.id ?? responseId("call"), name: "", arguments: "" }; if (part.function?.name) call.name += part.function.name; if (part.function?.arguments) call.arguments += part.function.arguments; calls.set(i, call); } if (chunk.usage) usage = chunk.usage; }
  const id = responseId(); const output = []; if (text.length) output.push({ id: `${id}_msg`, type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: text.join(""), annotations: [] }] }); for (const call of calls.values()) output.push({ id: call.id, type: "function_call", status: "completed", call_id: call.id, name: call.name, arguments: call.arguments }); return finalResponse(id, body.model, output, usage);
};

const collectAnthropic = async (body, upstreamResponse) => {
  const text = []; const calls = [];
  for await (const event of parseSse(upstreamResponse)) {
    if (event.type === "content_block_start" && event.content_block?.type === "tool_use") calls.push({ id: event.content_block.id, name: event.content_block.name, arguments: "" });
    if (event.type !== "content_block_delta") continue;
    const delta = event.delta ?? {};
    if (delta.type === "text_delta") text.push(delta.text ?? "");
    if (delta.type === "input_json_delta" && calls.length) calls.at(-1).arguments += delta.partial_json ?? "";
  }
  const id = responseId(); const output = [];
  if (text.length) output.push({ id: `${id}_msg`, type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: text.join(""), annotations: [] }] });
  for (const call of calls) output.push({ id: call.id, type: "function_call", status: "completed", call_id: call.id, name: call.name, arguments: call.arguments });
  return finalResponse(id, body.model, output);
};

const streamAnthropic = async (response, body, upstreamResponse) => {
  const id = responseId(); const shell = responseShell(id, body.model); response.statusCode = 200; response.setHeader("content-type", "text/event-stream"); response.setHeader("cache-control", "no-cache"); response.setHeader("connection", "keep-alive"); writeEvent(response, { type: "response.created", response: shell }); const text = []; const calls = []; let active;
  for await (const event of parseSse(upstreamResponse)) {
    if (event.type === "content_block_start") { active = event.content_block; if (active?.type === "tool_use") calls.push({ id: active.id, name: active.name, arguments: "" }); }
    if (event.type === "content_block_delta") { const d = event.delta ?? {}; if (d.type === "text_delta") { text.push(d.text); writeEvent(response, { type: "response.output_text.delta", item_id: `${id}_msg`, output_index: 0, content_index: 0, delta: d.text }); } if (d.type === "input_json_delta") { const call = calls.at(-1); if (call) { call.arguments += d.partial_json ?? ""; writeEvent(response, { type: "response.function_call_arguments.delta", item_id: call.id, output_index: calls.length - 1, delta: d.partial_json ?? "" }); } } }
  }
  const output = []; if (text.length) output.push({ id: `${id}_msg`, type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: text.join(""), annotations: [] }] }); for (const [index, call] of calls.entries()) { const item = { id: call.id, type: "function_call", status: "completed", call_id: call.id, name: call.name, arguments: call.arguments }; output.push(item); writeEvent(response, { type: "response.function_call_arguments.done", item_id: call.id, output_index: index, arguments: call.arguments }); writeEvent(response, { type: "response.output_item.done", output_index: index, item }); } const result = finalResponse(id, body.model, output); writeEvent(response, { type: "response.completed", response: result }); response.end("data: [DONE]\n\n");
};

const run = async (body) => {
  const id = modelId(body.model); const route = routeFor(id); const result = route === "responses" ? await upstream("/responses", responseRequest(body, id)) : route === "messages" ? await upstream("/messages", messagesRequest(body, id)) : await upstream("/chat/completions", chatRequest(body, id)); return { route, upstream: result };
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    if (request.method === "GET" && url.pathname === "/healthz") return sendJson(response, 200, { ok: true, transport: "codex-responses-to-opencode-go", base_url: baseUrl, native_passthrough: openaiBaseUrl, models: allowedModels.size, loopback: true });
    if (request.method === "GET" && url.pathname === "/v1/models") return sendJson(response, 200, { object: "list", data: [...allowedModels].map((id) => ({ id: `opencode-go/${id}`, object: "model", owned_by: "opencode-go" })) });
    if (request.method !== "POST" || url.pathname !== "/v1/responses") return sendJson(response, 404, errorPayload("Not found"));
    const body = JSON.parse(await readBody(request));
    if (!String(body.model ?? "").startsWith("opencode-go/")) {
      const passthrough = await withTimeout(`${openaiBaseUrl}/responses`, { method: "POST", headers: nativeHeaders(request), body: JSON.stringify(body) });
      if (!passthrough.ok) return sendJson(response, 502, errorPayload("Native Codex upstream rejected the request", "server_error", "native_upstream_failed"));
      response.statusCode = passthrough.status; for (const [key, value] of passthrough.headers) if (["content-type", "cache-control", "connection"].includes(key)) response.setHeader(key, value); for await (const chunk of passthrough.body) response.write(Buffer.from(chunk)); response.end(); return;
    }
    const { route, upstream: upstreamResponse } = await run(body);
    if (body.stream === true) { if (route === "responses") { response.statusCode = 200; response.setHeader("content-type", "text/event-stream"); response.setHeader("cache-control", "no-cache"); for await (const chunk of upstreamResponse.body) response.write(Buffer.from(chunk)); response.end(); return; } if (route === "messages") return streamAnthropic(response, body, upstreamResponse); return streamChat(response, body, modelId(body.model), upstreamResponse); }
    if (route === "chat") return sendJson(response, 200, await collectChat(body, modelId(body.model), upstreamResponse));
    if (route === "messages") return sendJson(response, 200, await collectAnthropic(body, upstreamResponse));
    const payload = await upstreamResponse.json(); payload.model = body.model; return sendJson(response, 200, payload);
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 502; const type = status === 429 ? "rate_limit_error" : status >= 500 ? "server_error" : "invalid_request_error"; sendJson(response, status, errorPayload(error?.message ?? "SCALE OpenCode gateway failed", type, error?.code));
  }
});
server.listen(port, host, () => process.stdout.write(`${JSON.stringify({ ok: true, transport: "codex-responses-to-opencode-go", host, port, base_url: baseUrl, models: allowedModels.size })}\n`));
const stop = () => server.close(() => process.exit(0)); process.on("SIGTERM", stop); process.on("SIGINT", stop);
