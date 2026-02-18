import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function randomId(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function buildPath(root: string, parts: string[]) {
  const p = path.join(root, ...parts);
  // prevent path traversal
  const normRoot = path.resolve(root);
  const normP = path.resolve(p);
  if (!normP.startsWith(normRoot)) throw new Error("INVALID_PATH");
  return normP;
}

export function streamToFile(readable: NodeJS.ReadableStream, filePath: string, maxBytes: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let written = 0;
    const out = fs.createWriteStream(filePath, { flags: "wx" });

    readable.on("data", (chunk: Buffer) => {
      written += chunk.length;
      if (written > maxBytes) {
        const destroy = (readable as { destroy?: (error?: Error) => void }).destroy;
        if (typeof destroy === "function") destroy(new Error("TOO_LARGE"));
      }
    });

    readable.on("error", (err) => {
      out.destroy();
      reject(err);
    });

    out.on("error", reject);
    out.on("finish", () => resolve(written));

    readable.pipe(out);
  });
}

export function unlinkIfExists(filePath: string) {
  try { fs.unlinkSync(filePath); } catch {}
}
