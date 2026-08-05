#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.SCALE_OPENCODEX_URL ?? "http://127.0.0.1:10100/v1";
const runAll = process.argv.includes("--all-models");
const timeoutMs = 90000;

const catalogResponse = await fetch(`${baseUrl}/models`);
if (!catalogResponse.ok) throw new Error(`Catalog failed: HTTP ${catalogResponse.status}`);
const catalog = await catalogResponse.json();
const modelIds = catalog.data.map((entry) => entry.id).filter((id) => id.startsWith("opencode-go/")).sort();
const registry = JSON.parse(fs.readFileSync(path.join(root, "library", "model-registry.json"), "utf8"));
const registryIds = registry.models.filter((entry) => entry.active && entry.provider === "opencode-go").map((entry) => entry.id).sort();
const missingFromRegistry = modelIds.filter((id) => !registryIds.includes(id));
const absentFromCatalog = registryIds.filter((id) => !modelIds.includes(id));

const results = [];
if (runAll) {
  for (const model of modelIds) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, input: "Reply only OK.", max_output_tokens: 24, stream: false }),
        signal: controller.signal
      });
      const body = await response.text();
      results.push({ model, ok: response.ok, status: response.status, response_bytes: body.length, error: response.ok ? undefined : body.slice(0, 240) });
    } catch (error) {
      results.push({ model, ok: false, status: 0, response_bytes: 0, error: error.name === "AbortError" ? `timeout after ${timeoutMs}ms` : error.message });
    } finally {
      clearTimeout(timeout);
    }
    console.error(`${results.at(-1).ok ? "PASS" : "FAIL"} ${model} HTTP ${results.at(-1).status}`);
  }
}

const report = {
  ok: missingFromRegistry.length === 0 && absentFromCatalog.length === 0 && results.every((entry) => entry.ok),
  base_url: baseUrl,
  catalog_models: modelIds.length,
  registry_models: registryIds.length,
  missing_from_registry: missingFromRegistry,
  absent_from_catalog: absentFromCatalog,
  tested: results.length,
  passed: results.filter((entry) => entry.ok).length,
  failed: results.filter((entry) => !entry.ok)
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
