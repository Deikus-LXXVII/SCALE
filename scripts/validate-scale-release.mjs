#!/usr/bin/env node
/** Validate deterministic release metadata. Live OpenCode discovery is opt-in. */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return value;
};
const root = path.resolve(option("--root", path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")));
const failures = [];
const checks = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const exists = (relative) => {
  const result = fs.existsSync(path.join(root, relative));
  checks.push({ path: relative, present: result });
  requireValue(result, `missing required release path: ${relative}`);
  return result;
};
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: validate-scale-release.mjs [--root <scale-root>] [--require-tracked] [--json]");
  process.exit(0);
}

const manifestPath = path.join(root, ".codex-plugin", "plugin.json");
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch (error) { failures.push(`cannot read plugin manifest: ${error.message}`); }
const version = manifest.version;
const versionMatch = typeof version === "string" && version.match(/^(\d+)\.(\d+)\.(\d+)\+codex\.(\d{14})$/);
requireValue(Boolean(versionMatch), "plugin version must be semver plus a 14-digit +codex cachebuster");
if (versionMatch) {
  const stamp = versionMatch[4];
  const date = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
  const changelogPath = path.join(root, "CHANGELOG.md");
  let changelog = "";
  try { changelog = fs.readFileSync(changelogPath, "utf8"); } catch (error) { failures.push(`cannot read CHANGELOG.md: ${error.message}`); }
  requireValue(changelog.includes(`## [${version}] - ${date}`), `CHANGELOG.md must contain the current version and cachebuster date (${version})`);
}
requireValue(manifest.name === "scale", "plugin manifest name must be scale");
requireValue(typeof manifest.skills === "string" && manifest.skills.length > 0, "plugin manifest must declare skills");

const registryPath = path.join(root, "library", "model-registry.json");
try {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  requireValue(Number.isInteger(registry.schema_version) && registry.schema_version >= 1, "model registry must have an integer schema_version");
} catch (error) { failures.push(`cannot parse model registry: ${error.message}`); }

const requiredPaths = [
  ".codex-plugin/plugin.json", ".github/workflows/scale-validation.yml", "CHANGELOG.md", "library/model-registry.json", "library/find-by-tag.sh",
  "scripts/validate-scale-agents.sh", "scripts/validate-scale-library.sh", "scripts/validate-scale-knowledge.mjs", "scripts/validate-scale-knowledge.sh",
  "scripts/validate-scale-model-registry.mjs", "scripts/validate-scale-install.sh",
  "scripts/scale-library-refresh.sh", "scripts/scale-telemetry-report.mjs", "scripts/scale-benchmark.mjs", "scripts/test-scale-benchmark.mjs", "scripts/scale-knowledge-shadow.mjs", "scripts/test-scale-knowledge-shadow.mjs", "scripts/validate-scale-release.mjs",
  "scripts/scale-plaintext-runner.mjs", "scripts/test-scale-plaintext-runner.mjs", "scripts/schemas/scale-plaintext-work-order.schema.json", "scripts/schemas/scale-fallback-request.schema.json"
];
for (const requiredPath of requiredPaths) exists(requiredPath);
let gitAvailable = false;
try { execFileSync("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], { stdio: "pipe" }); gitAvailable = true; } catch { checks.push({ git_tracking: "unavailable" }); }
if (gitAvailable) {
  for (const check of checks.filter((item) => item.path && item.present)) {
    let tracked = false;
    try { execFileSync("git", ["-C", root, "ls-files", "--error-unmatch", "--", check.path], { stdio: "pipe" }); tracked = true; } catch { /* newly created files are checked by CI after checkout */ }
    check.tracked = tracked;
    if (args.includes("--require-tracked")) requireValue(tracked, `required release path is not Git-tracked: ${check.path}`);
  }
}
const report = { schema_version: 1, root, version: version ?? null, checks, failures };
if (failures.length > 0) {
  if (args.includes("--json")) console.error(JSON.stringify(report, null, 2));
  else failures.forEach((failure) => console.error(`S.C.A.L.E. release: ${failure}`));
  process.exit(1);
}
if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
else console.log(`Validated S.C.A.L.E. release metadata (${version}); live OpenCodex discovery is a separate acceptance check.`);
