import nodemailer from "nodemailer";
import { env } from "./env.js";

function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseBool(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function resolveSmtpConfig() {
  const host = firstNonEmpty(env.SMTP_HOST, process.env.ZOHO_SMTP_HOST, "smtp.zoho.com");
  const user = firstNonEmpty(env.SMTP_USER, process.env.ZOHO_SMTP_USER, process.env.ZOHO_EMAIL);
  const pass = firstNonEmpty(env.SMTP_PASS, process.env.ZOHO_SMTP_PASS, process.env.ZOHO_APP_PASSWORD, process.env.ZOHO_PASSWORD);
  const from = firstNonEmpty(env.SMTP_FROM, process.env.ZOHO_SMTP_FROM, user);

  const port = Number(process.env.ZOHO_SMTP_PORT || env.SMTP_PORT || 587);
  const explicitSecure = parseBool(process.env.ZOHO_SMTP_SECURE);
  const secure = explicitSecure == null ? (env.SMTP_SECURE || port === 465) : explicitSecure;

  if (!user || !pass || !from) throw new Error("SMTP_NOT_CONFIGURED");

  return { host, port, secure, user, pass, from };
}

function getTransporter() {
  const cfg = resolveSmtpConfig();
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: !cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass
    }
  });
}

export async function sendVerificationEmail(to: string, verifyToken: string) {
  const transporter = getTransporter();
  const cfg = resolveSmtpConfig();
  const base = env.APP_BASE_URL.replace(/\/$/, "");
  const verifyUrl = `${base}/?verifyEmailToken=${encodeURIComponent(verifyToken)}`;
  try {
    await transporter.sendMail({
      from: cfg.from,
      to,
      subject: "Verify your OpenCom account",
      text: `Welcome to OpenCom.\n\nVerify your email by opening this link:\n${verifyUrl}\n\nIf you did not create this account, you can ignore this email.`,
      html: `<p>Welcome to OpenCom.</p><p>Verify your email by opening this link:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>If you did not create this account, you can ignore this email.</p>`
    });
  } catch (error) {
    const message = String((error as any)?.message || "").toLowerCase();
    const responseCode = Number((error as any)?.responseCode || 0);
    if (responseCode === 535 || responseCode === 534 || message.includes("auth")) {
      throw new Error("SMTP_AUTH_FAILED");
    }
    if (message.includes("connect") || message.includes("timeout") || message.includes("econnrefused")) {
      throw new Error("SMTP_CONNECTION_FAILED");
    }
    throw new Error("EMAIL_SEND_FAILED");
  }
}
