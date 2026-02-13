#!/usr/bin/env node
/**
 * Adds missing env vars to .env from .env.example without overwriting existing values.
 * Usage: node scripts/add-missing-env.mjs [--backend] [--frontend] [--node] [--dry-run]
 * Default: process all targets that have an .env.example.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function parseEnvLines(content) {
  const lines = (content || "").split(/\r?\n/);
  const map = new Map();
  const parsed = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      parsed.push({ type: "raw", line });
      continue;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, rest] = match;
      let value = rest;
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/''/g, "'");
      else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
      map.set(key, value);
      parsed.push({ type: "key", key, value, raw: line });
    } else {
      parsed.push({ type: "raw", line });
    }
  }
  return { map, parsed };
}

function parseExampleForMissing(content) {
  const lines = (content || "").split(/\r?\n/);
  const toAdd = [];
  let lastComment = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      lastComment = [];
      continue;
    }
    if (trimmed.startsWith("#")) {
      lastComment.push(line);
      continue;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      toAdd.push({ comments: lastComment.slice(), key: match[1], raw: line });
      lastComment = [];
    } else {
      lastComment = [];
    }
  }
  return toAdd;
}

function addMissing(envPath, examplePath, dryRun) {
  const exampleFull = path.join(ROOT, examplePath);
  const envFull = path.join(ROOT, envPath);
  if (!fs.existsSync(exampleFull)) {
    console.warn(`[add-missing-env] No ${examplePath}, skipping`);
    return 0;
  }
  const exampleContent = fs.readFileSync(exampleFull, "utf8");
  const existingContent = fs.existsSync(envFull) ? fs.readFileSync(envFull, "utf8") : "";
  const { map: existing } = parseEnvLines(existingContent);
  const toAdd = parseExampleForMissing(exampleContent).filter((e) => !existing.has(e.key));
  if (toAdd.length === 0) {
    console.log(`[add-missing-env] ${envPath}: no missing keys`);
    return 0;
  }
  const lines = [];
  const trimmed = existingContent.trim();
  if (trimmed) {
    lines.push(trimmed);
    lines.push("");
  }
  lines.push("# Added missing from " + path.basename(examplePath) + " by add-missing-env.mjs");
  for (const e of toAdd) {
    for (const c of e.comments) lines.push(c);
    lines.push(e.raw);
    console.log(`[add-missing-env] ${envPath}: + ${e.key}`);
  }
  const out = lines.join("\n") + "\n";
  if (!dryRun) fs.writeFileSync(envFull, out, "utf8");
  return toAdd.length;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const onlyBackend = args.includes("--backend");
  const onlyFrontend = args.includes("--frontend");
  const onlyNode = args.includes("--node");

  const run = (name, envPath, examplePath) => {
    if (onlyBackend && name !== "backend") return 0;
    if (onlyFrontend && name !== "frontend") return 0;
    if (onlyNode && name !== "node") return 0;
    return addMissing(envPath, examplePath, dryRun);
  };

  let n = 0;
  n += run("backend", "backend/.env", "backend/.env.example");
  n += run("frontend", "frontend/.env", "frontend/.env.development");
  n += run("node", "backend/packages/server-node/.env", "backend/packages/server-node/.env.example");

  if (dryRun && n > 0) console.log("[add-missing-env] Dry run: no files written.");
  else if (n > 0) console.log("[add-missing-env] Done. Added", n, "missing key(s).");
}

main();
