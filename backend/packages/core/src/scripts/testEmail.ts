import { config } from "dotenv";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { previewSmtpEmail, resolveSmtpConfig, sendSmtpEmail, verifySmtpConnection } from "../smtp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  process.env.CORE_ENV_FILE,
  path.resolve(__dirname, "../../../../core.env"),
  path.resolve(__dirname, "../../../../.env.core"),
  path.resolve(__dirname, "../../../../.env"),
];

for (const candidate of envCandidates) {
  if (!candidate || !fs.existsSync(candidate)) continue;
  config({ path: candidate, override: true });
  break;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function promptRecipientEmail(rl: ReturnType<typeof createInterface>): Promise<string> {
  while (true) {
    const value = (await rl.question("Recipient email address: ")).trim();
    if (!value) {
      output.write("Recipient email is required.\n");
      continue;
    }
    if (!looksLikeEmail(value)) {
      output.write("Please enter a valid email address.\n");
      continue;
    }
    return value;
  }
}

async function promptOptionalHeader(
  rl: ReturnType<typeof createInterface>,
  label: string,
  defaultValue = ""
): Promise<string | undefined> {
  const suffix = defaultValue ? ` (default: ${defaultValue})` : "";
  const value = (await rl.question(`${label}${suffix}: `)).trim();
  return value || undefined;
}

async function promptMultiline(rl: ReturnType<typeof createInterface>, label: string): Promise<string> {
  output.write(`${label}\n`);
  output.write("End input with a single '.' on its own line.\n");

  const lines: string[] = [];
  while (true) {
    const line = await rl.question("> ");
    if (line.trim() === ".") break;
    lines.push(line);
  }

  if (!lines.some((line) => line.trim().length)) {
    throw new Error("EMAIL_CONTENT_REQUIRED");
  }

  return lines.join("\n");
}

async function main() {
  const rl = createInterface({ input, output });
  try {
    const cfg = resolveSmtpConfig();
    output.write(`Using SMTP ${cfg.host}:${cfg.port} (${cfg.secure ? "secure" : "starttls"}) from ${cfg.from}\n`);
    output.write("Verifying SMTP connection...\n");
    await verifySmtpConnection();
    output.write("SMTP verification succeeded.\n");

    const to = await promptRecipientEmail(rl);
    const from = await promptOptionalHeader(rl, "From header override", cfg.from);
    const replyTo = await promptOptionalHeader(rl, "Reply-To header override");
    const subjectInput = (await rl.question("Subject (default: OpenCom SMTP test): ")).trim();
    const subject = subjectInput || "OpenCom SMTP test";

    const text = await promptMultiline(rl, "Enter plain text content:");
    const includeHtml = (await rl.question("Add HTML content too? (y/N): ")).trim().toLowerCase();
    const html = includeHtml === "y" || includeHtml === "yes"
      ? await promptMultiline(rl, "Enter HTML content:")
      : undefined;

    const emailInput = { to, from, replyTo, subject, text, html };
    const preview = await previewSmtpEmail(emailInput);
    output.write("\nRaw message preview:\n");
    output.write(`${preview.raw}${preview.raw.endsWith("\n") ? "" : "\n"}`);
    output.write(`Envelope from: ${preview.envelope.from || "(none)"}\n`);
    output.write(`Envelope to: ${preview.envelope.to.join(", ") || "(none)"}\n`);
    output.write(`Preview message ID: ${preview.messageId || "(none)"}\n`);

    const shouldSend = (await rl.question("Send this message now? (Y/n): ")).trim().toLowerCase();
    if (shouldSend === "n" || shouldSend === "no") {
      output.write("Email send cancelled after preview.\n");
      return;
    }

    const result = await sendSmtpEmail(emailInput);
    output.write(`Sent test email to ${to}.\n`);
    output.write(`Accepted: ${result.accepted.join(", ") || "(none)"}\n`);
    output.write(`Rejected: ${result.rejected.join(", ") || "(none)"}\n`);
    output.write(`Envelope from: ${result.envelope.from || "(none)"}\n`);
    output.write(`Envelope to: ${result.envelope.to.join(", ") || "(none)"}\n`);
    output.write(`Message ID: ${result.messageId || "(none)"}\n`);
    output.write(`SMTP response: ${result.response || "(none)"}\n`);
  } catch (error) {
    const message = String((error as any)?.message || error);
    if (message === "SMTP_NOT_CONFIGURED") {
      console.error("[error] SMTP is not fully configured. Set SMTP_USER, SMTP_PASS, and SMTP_FROM.");
    } else if (message === "SMTP_AUTH_FAILED") {
      console.error("[error] SMTP authentication failed. Check SMTP credentials/app password.");
    } else if (message === "SMTP_CONNECTION_FAILED") {
      console.error("[error] SMTP connection failed. Check host/port/security and firewall rules.");
    } else if (message.startsWith("SMTP_INVALID_")) {
      console.error(`[error] SMTP message rejected before send: ${message.replace(/^SMTP_INVALID_/, "").toLowerCase().replace(/_/g, "-")}.`);
    } else if (message === "EMAIL_CONTENT_REQUIRED") {
      console.error("[error] Email content is required.");
    } else {
      console.error(`[error] ${message}`);
    }
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

await main();
