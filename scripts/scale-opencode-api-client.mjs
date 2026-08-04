#!/usr/bin/env node

// Minimal OpenCode OpenAPI transport used by the SCALE dispatcher.
// It deliberately speaks OpenCode's session API, not the OpenAI Responses API.
// Credentials are read from the environment and are never included in output.

import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const baseUrl = String(input.base_url ?? process.env.SCALE_OPENCODE_API_URL ?? process.env.OPENCODE_SERVER_URL ?? "").replace(/\/$/, "");
const target = String(input.target ?? "");
const timeoutMs = Number.isInteger(input.timeout_ms) && input.timeout_ms > 0 ? input.timeout_ms : 600000;
const username = process.env.OPENCODE_SERVER_USERNAME ?? "opencode";
const password = process.env.OPENCODE_SERVER_PASSWORD;

if (!/^https?:\/\//i.test(baseUrl)) {
  console.log(JSON.stringify({ ok: false, reason: "api-url-missing" }));
  process.exit(2);
}
const apiHost = new URL(baseUrl).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(apiHost) && process.env.SCALE_OPENCODE_ALLOW_REMOTE !== "1") {
  console.log(JSON.stringify({ ok: false, reason: "api-url-not-local" }));
  process.exit(2);
}

const headers = { accept: "application/json, text/event-stream" };
if (password) headers.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

const withDirectory = (path) => {
  const url = new URL(`${baseUrl}${path}`);
  if (target) url.searchParams.set("directory", target);
  return url;
};

const request = async (path, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const requestHeaders = { ...headers, ...(options.headers ?? {}) };
    if (target) requestHeaders["x-opencode-directory"] = target;
    const response = await fetch(withDirectory(path), {
      ...options,
      headers: requestHeaders,
      signal: controller.signal
    });
    const body = await response.text();
    return { status: response.status, contentType: response.headers.get("content-type") ?? "", body };
  } finally {
    clearTimeout(timer);
  }
};

const parseJson = (body) => {
  try { return JSON.parse(body); } catch { return null; }
};

const modelMatches = (catalog, model) => {
  const separator = String(model ?? "").indexOf("/");
  const providerID = separator > 0 ? String(model).slice(0, separator) : "";
  const modelID = separator > 0 ? String(model).slice(separator + 1) : String(model ?? "");
  const providers = Array.isArray(catalog?.providers) ? catalog.providers : [];
  return providers.some((provider) => {
    if (provider?.id !== providerID) return false;
    const models = provider.models;
    if (models && typeof models === "object" && Object.prototype.hasOwnProperty.call(models, modelID)) return true;
    if (Array.isArray(models)) return models.some((entry) => entry?.id === modelID || entry?.modelID === modelID);
    return false;
  });
};

const probe = async () => {
  let health;
  try {
    health = await request("/global/health", { method: "GET" });
  } catch (error) {
    return { ok: false, reason: error?.name === "AbortError" ? "api-timeout" : "api-unreachable" };
  }
  if (health.status < 200 || health.status >= 300) {
    return { ok: false, reason: "api-health-failed", status: health.status };
  }
  let providers;
  try {
    providers = await request("/config/providers", { method: "GET" });
  } catch (error) {
    return { ok: false, reason: error?.name === "AbortError" ? "api-timeout" : "api-unreachable" };
  }
  const catalog = parseJson(providers.body) ?? providers.body;
  if (providers.status < 200 || providers.status >= 300) {
    return { ok: false, reason: "api-provider-catalog-failed", status: providers.status };
  }
  const model = input.model;
  const matched = modelMatches(catalog, model);
  return {
    ok: matched,
    reason: matched ? "api-catalog-passed" : "api-model-not-found",
    provider_ids: Array.isArray(catalog?.providers) ? catalog.providers.map((provider) => provider?.id).filter(Boolean) : [],
    model: model ?? null,
    status: providers.status
  };
};

const run = async () => {
  const separator = String(input.model ?? "").indexOf("/");
  const providerID = separator > 0 ? String(input.model).slice(0, separator) : "opencode-go";
  const modelID = separator > 0 ? String(input.model).slice(separator + 1) : String(input.model ?? "");
  const model = { providerID, modelID };
  if (input.reasoning_effort && input.reasoning_effort !== "provider-default") model.variant = input.reasoning_effort;
  // Keep creation compatible with older OpenCode servers. Agent/model/variant
  // are sent on the message endpoint, whose schema is stable across versions.
  const sessionPayload = { title: `SCALE ${input.task_id ?? "dispatch"}` };
  let session;
  try {
    session = await request("/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sessionPayload)
    });
  } catch (error) {
    return { ok: false, reason: error?.name === "AbortError" ? "api-timeout" : "api-unreachable" };
  }
  const sessionBody = parseJson(session.body);
  const sessionId = sessionBody?.id ?? sessionBody?.session?.id;
  if (session.status < 200 || session.status >= 300 || typeof sessionId !== "string" || !sessionId) {
    return { ok: false, reason: "api-session-create-failed", status: session.status };
  }

  const message = {
    model,
    agent: input.agent,
    ...(input.reasoning_effort && input.reasoning_effort !== "provider-default" ? { variant: input.reasoning_effort } : {}),
    parts: [{ type: "text", text: String(input.prompt ?? "") }]
  };
  const cleanupSession = async () => {
    try { await request(`/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" }); } catch { /* best effort */ }
  };
  let response;
  try {
    response = await request(`/session/${encodeURIComponent(sessionId)}/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message)
    });
  } catch (error) {
    await cleanupSession();
    return { ok: false, reason: error?.name === "AbortError" ? "api-timeout" : "api-unreachable" };
  }
  const body = response.body;
  if (response.status < 200 || response.status >= 300) {
    await cleanupSession();
    return {
      ok: false,
      reason: /(?:quota|rate\s*limit|usage\s*limit|credit|limit\s*reached|429)/i.test(body) ? "opencode-go-limit" : "api-message-failed",
      status: response.status
    };
  }
  // Keep one task per session. Deletion is best-effort because older OpenCode
  // servers may not expose DELETE /session/:id.
  await cleanupSession();
  return { ok: true, status: response.status, content_type: response.contentType, output: body };
};

const result = input.operation === "probe" ? await probe() : await run();
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.ok ? 0 : 1);
