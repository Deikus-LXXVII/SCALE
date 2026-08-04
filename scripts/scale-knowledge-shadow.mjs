#!/usr/bin/env node
/** Emit a metadata-only, deterministic retrieval manifest. Never prints knowledge bodies or evidence text. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const option = (name, fallback = undefined) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const item = args[index + 1];
  if (!item || item.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return item;
};
const field = (frontmatter, name) => (frontmatter.match(new RegExp(`^\\s*${name}:\\s*(?:"([^"]*)"|'([^']*)'|([^\\n]+))\\s*$`, "m"))?.slice(1).find((value) => value !== undefined) ?? "").trim();
const list = (frontmatter, name) => (frontmatter.match(new RegExp(`^\\s*${name}:\\s*\\[([^\\]]*)\\]\\s*$`, "m"))?.[1] ?? "").split(",").map((entry) => entry.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
const libraryRoot = path.resolve(option("--library-root", path.join(repoRoot, "library")));
const candidateReplay = args.includes("--candidate-replay");
const maxTokensInput = option("--max-tokens");
const maxTokens = maxTokensInput === undefined ? null : Number(maxTokensInput);
if (maxTokens !== null && (!Number.isInteger(maxTokens) || maxTokens <= 0)) throw new Error("--max-tokens must be a positive integer");
const suppliedTags = args.flatMap((argument, index) => argument === "--tag" ? [args[index + 1]] : []).filter(Boolean);
const positionalTags = args.filter((argument, index) => !argument.startsWith("-") && !["--tag", "--library-root", "--manifest", "--max-tokens"].includes(args[index - 1]));
const requestedTags = [...new Set([...suppliedTags, ...positionalTags])].sort();
if (requestedTags.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log("Usage: scale-knowledge-shadow.mjs [--candidate-replay] [--library-root <dir>] [--manifest <new-file>] [--max-tokens <n>] --tag <tag> [--tag <tag> ...]");
  process.exit(requestedTags.length === 0 && !args.includes("--help") && !args.includes("-h") ? 2 : 0);
}
const entries = [];
for (const directory of ["rules", "books", "agents"]) {
  const absolute = path.join(libraryRoot, directory);
  for (const name of fs.readdirSync(absolute).filter((item) => item.endsWith(".md") && item !== "README.md").sort()) {
    const file = path.join(absolute, name);
    const source = fs.readFileSync(file, "utf8");
    const end = source.indexOf("\n---", 4);
    if (!source.startsWith("---\n") || end === -1) throw new Error(`Missing frontmatter: ${file}`);
    const frontmatter = source.slice(4, end);
    entries.push({
      path: path.relative(libraryRoot, file), status: field(frontmatter, "status") || "curated", tags: list(frontmatter, "tags"),
      conflicts_with: list(frontmatter, "conflicts_with"), supersedes: list(frontmatter, "supersedes"), superseded_by: list(frontmatter, "superseded_by"),
      evidence_declared: Boolean(field(frontmatter, "evidence")), bytes: Buffer.byteLength(source), sha256: crypto.createHash("sha256").update(source).digest("hex"),
    });
  }
}
const known = new Map(entries.map((entry) => [entry.path, entry]));
const selected = entries.filter((entry) => entry.status !== "deprecated" && (candidateReplay || entry.status === "curated") && entry.tags.some((tag) => requestedTags.includes(tag))).map((entry) => ({
  path: entry.path, status: entry.status, tags: entry.tags, matched_tags: entry.tags.filter((tag) => requestedTags.includes(tag)), sha256: entry.sha256,
  byte_estimate: entry.bytes, token_estimate: Math.ceil(entry.bytes / 4), evidence: entry.evidence_declared ? "declared" : "missing",
  conflicts_with: entry.conflicts_with.map((target) => ({ path: target, status: known.has(target) ? "known" : "missing" })),
  supersedes: entry.supersedes.map((target) => ({ path: target, status: known.has(target) ? "known" : "missing" })),
  superseded_by: entry.superseded_by.map((target) => ({ path: target, status: known.has(target) ? "known" : "missing" })),
})).sort((left, right) => left.path.localeCompare(right.path));
const seen = new Set();
for (const entry of selected) {
  if (seen.has(entry.path)) throw new Error(`Duplicate selected path: ${entry.path}`);
  seen.add(entry.path);
}
const coveredTags = requestedTags.filter((tag) => selected.some((entry) => entry.matched_tags.includes(tag)));
const selectedTokenEstimate = selected.reduce((total, entry) => total + entry.token_estimate, 0);
if (maxTokens !== null && selectedTokenEstimate > maxTokens) throw new Error(`retrieval manifest exceeds --max-tokens (${selectedTokenEstimate} > ${maxTokens})`);
const manifest = {
  schema_version: 1, mode: candidateReplay ? "candidate-shadow-replay" : "curated-only", requested_tags: requestedTags,
  selected, relevance: { matched_entries: selected.length, matched_tag_pairs: selected.reduce((total, entry) => total + entry.matched_tags.length, 0), average_matching_tags_per_entry: selected.length ? selected.reduce((total, entry) => total + entry.matched_tags.length, 0) / selected.length : 0 },
  coverage: { requested_tags: requestedTags.length, covered_tags: coveredTags, uncovered_tags: requestedTags.filter((tag) => !coveredTags.includes(tag)), coverage_ratio: coveredTags.length / requestedTags.length },
  budget: { max_tokens: maxTokens, selected_token_estimate: selectedTokenEstimate, within_limit: maxTokens === null || selectedTokenEstimate <= maxTokens },
  statuses: { curated: selected.filter((entry) => entry.status === "curated").length, candidate: selected.filter((entry) => entry.status === "candidate").length, missing_evidence: selected.filter((entry) => entry.evidence === "missing").length },
};
const output = `${JSON.stringify(manifest, null, 2)}\n`;
const destination = option("--manifest");
if (destination) {
  const resolved = path.resolve(destination);
  if (fs.existsSync(resolved)) throw new Error(`Refusing to overwrite existing manifest: ${resolved}`);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, output);
}
console.log(output);
