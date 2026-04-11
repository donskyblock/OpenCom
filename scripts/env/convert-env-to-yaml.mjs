#!/usr/bin/env node
import fs from "node:fs";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: node scripts/env/convert-env-to-yaml.mjs <env-file>");
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
const lines = raw.split(/\r?\n/);
const entries = new Map();

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;

  const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : line;
  const idx = normalized.indexOf("=");
  if (idx === -1) continue;

  const key = normalized.slice(0, idx).trim();
  if (!key) continue;

  let value = normalized.slice(idx + 1).replace(/\r$/, "");
  const hasDoubleQuotes = value.startsWith("\"") && value.endsWith("\"");
  const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");

  if (hasDoubleQuotes) {
    value = value.slice(1, -1);
    value = value
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\");
  } else if (hasSingleQuotes) {
    value = value.slice(1, -1);
  } else {
    value = value.trim();
  }

  entries.set(key, value);
}

const yamlEscape = (value) => {
  if (value === "") return "\"\"";
  if (value.includes("\n")) {
    const indented = value.split("\n").map((line) => `  ${line}`).join("\n");
    return `|-\n${indented}`;
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
};

for (const [key, value] of entries.entries()) {
  process.stdout.write(`${key}: ${yamlEscape(value)}\n`);
}
