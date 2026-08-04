#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return value;
};
const libraryRoot = path.resolve(option("--library-root", path.join(repoRoot, "library")));
const asOf = option("--as-of", new Date().toISOString().slice(0, 10));
const failures = [];
const entries = [];
const files = [];
for (const directory of ["rules", "books", "agents"]) {
  const absolute = path.join(libraryRoot, directory);
  for (const name of fs.readdirSync(absolute).filter((entry) => entry.endsWith(".md") && entry !== "README.md").sort()) files.push(path.join(absolute, name));
}

const field = (frontmatter, name) => {
  const match = frontmatter.match(new RegExp(`^\\s*${name}:\\s*(?:"([^"]*)"|'([^']*)'|([^\\n]+))\\s*$`, "m"));
  return (match?.[1] ?? match?.[2] ?? match?.[3])?.trim();
};
const listField = (frontmatter, name) => {
  const value = frontmatter.match(new RegExp(`^${name}:\\s*\\[([^\\]]*)\\]\\s*$`, "m"))?.[1];
  return value === undefined ? [] : value.split(",").map((entry) => entry.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
};
const dateField = (frontmatter, name, file) => {
  const value = field(frontmatter, name);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    failures.push(`${file}: provenance.${name} must be an ISO date`);
    return null;
  }
  return value;
};

for (const file of files) {
  const relative = path.relative(libraryRoot, file);
  const source = fs.readFileSync(file, "utf8");
  const end = source.indexOf("\n---", 4);
  if (!source.startsWith("---\n") || end === -1) {
    failures.push(`${relative}: missing or unclosed YAML frontmatter`);
    continue;
  }
  const frontmatter = source.slice(4, end);
  const description = field(frontmatter, "description");
  const tags = listField(frontmatter, "tags");
  const status = field(frontmatter, "status");
  const sourceName = field(frontmatter, "source");
  const evidence = field(frontmatter, "evidence");
  const compatibility = field(frontmatter, "compatibility");
  if (!description) failures.push(`${relative}: missing description`);
  if (tags.length === 0) failures.push(`${relative}: missing tags`);
  if (!["curated", "candidate", "deprecated"].includes(status)) failures.push(`${relative}: status must be curated, candidate, or deprecated`);
  if (!sourceName) failures.push(`${relative}: provenance.source is required`);
  if (!evidence) failures.push(`${relative}: provenance.evidence is required`);
  if (!compatibility) failures.push(`${relative}: provenance.compatibility is required`);
  const validatedOn = dateField(frontmatter, "validated_on", relative);
  const reviewAfter = dateField(frontmatter, "review_after", relative);
  if (validatedOn && reviewAfter && reviewAfter < validatedOn) failures.push(`${relative}: review_after precedes validated_on`);
  if (reviewAfter && reviewAfter < asOf && status !== "deprecated") failures.push(`${relative}: knowledge is expired as of ${asOf}; review_after=${reviewAfter}`);
  entries.push({ relative, canonicalPath: fs.realpathSync(file), description, conflicts: listField(frontmatter, "conflicts_with"), supersedes: listField(frontmatter, "supersedes"), supersededBy: listField(frontmatter, "superseded_by") });
}

const byDescription = new Map();
const byCanonicalPath = new Map();
for (const entry of entries) {
  const duplicatePath = byCanonicalPath.get(entry.canonicalPath);
  if (duplicatePath) failures.push(`duplicate knowledge path: ${duplicatePath} and ${entry.relative}`);
  else byCanonicalPath.set(entry.canonicalPath, entry.relative);
  if (!entry.description) continue;
  const key = entry.description.toLowerCase().replace(/\s+/g, " ");
  const previous = byDescription.get(key);
  if (previous) failures.push(`duplicate knowledge description: ${previous} and ${entry.relative}`);
  else byDescription.set(key, entry.relative);
}
const known = new Set(entries.map((entry) => entry.relative));
const byPath = new Map(entries.map((entry) => [entry.relative, entry]));
for (const entry of entries) {
  for (const relation of [["conflicts_with", entry.conflicts], ["supersedes", entry.supersedes], ["superseded_by", entry.supersededBy]]) {
    for (const target of relation[1]) {
      if (!known.has(target)) failures.push(`${entry.relative}: ${relation[0]} references missing ${target}`);
      if (target === entry.relative) failures.push(`${entry.relative}: ${relation[0]} cannot reference itself`);
    }
  }
}
for (const entry of entries) {
  for (const target of entry.conflicts) if (byPath.has(target) && !byPath.get(target).conflicts.includes(entry.relative)) failures.push(`${entry.relative}: conflicts_with ${target} must be reciprocal`);
  for (const target of entry.supersedes) if (byPath.has(target) && !byPath.get(target).supersededBy.includes(entry.relative)) failures.push(`${entry.relative}: supersedes ${target} requires ${target}.superseded_by`);
  for (const target of entry.supersededBy) if (byPath.has(target) && !byPath.get(target).supersedes.includes(entry.relative)) failures.push(`${entry.relative}: superseded_by ${target} requires ${target}.supersedes`);
}
const visiting = new Set();
const visited = new Set();
const visit = (entry, ancestry) => {
  if (visiting.has(entry.relative)) { failures.push(`supersession cycle: ${[...ancestry, entry.relative].join(" -> ")}`); return; }
  if (visited.has(entry.relative)) return;
  visiting.add(entry.relative);
  for (const target of entry.supersedes) if (byPath.has(target)) visit(byPath.get(target), [...ancestry, entry.relative]);
  visiting.delete(entry.relative); visited.add(entry.relative);
};
for (const entry of entries) visit(entry, []);

if (failures.length > 0) {
  for (const failure of failures) console.error(`S.C.A.L.E. knowledge: ${failure}`);
  process.exit(1);
}
console.log(`Validated S.C.A.L.E. knowledge governance for ${entries.length} entries as of ${asOf}; provenance, expiry, and conflict references are consistent.`);
