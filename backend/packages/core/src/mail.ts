import { env } from "./env.js";
import { sendSmtpEmail } from "./smtp.js";

export async function sendVerificationEmail(to: string, verifyToken: string) {
  const base = env.APP_BASE_URL.replace(/\/$/, "");
  const verifyUrl = `${base}/?verifyEmailToken=${encodeURIComponent(verifyToken)}`;
  await sendSmtpEmail({
    to,
    subject: "Verify your OpenCom account",
    text: `Welcome to OpenCom.\n\nVerify your email by opening this link:\n${verifyUrl}\n\nIf you did not create this account, you can ignore this email.`,
    html: `<p>Welcome to OpenCom.</p><p>Verify your email by opening this link:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>If you did not create this account, you can ignore this email.</p>`
  });
}

export async function sendPasswordResetEmail(to: string, resetToken: string) {
  const base = env.APP_BASE_URL.replace(/\/$/, "");
  const resetUrl = `${base}/?resetPasswordToken=${encodeURIComponent(resetToken)}`;
  await sendSmtpEmail({
    to,
    subject: "Reset your OpenCom password",
    text: `We received a request to reset your OpenCom password.\n\nSet a new password by opening this link:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>We received a request to reset your OpenCom password.</p><p>Set a new password by opening this link:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p>`
  });
}

export async function sendSigninEmail(to: string, ip: string) {
  const base = env.APP_BASE_URL.replace(/\/$/, "");
  const loginUrl = `${base}/login`
  await sendSmtpEmail({
    to,
    subject: "OpenCom Unrecognised Signin Alert",
    text: `There has been a Unrecognised sign in to your account.\nThe ip of this sign in is ${ip}\nIf you do not recognise this sign in please login at ${loginUrl} and reset your paassword.\nIf this was you you can safely ignore this email!`,
  })
}
