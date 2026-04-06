import type { NextConfig } from "next";

const allowedDevOrigins = Array.from(
  new Set(
    [
      "localhost",
      "127.0.0.1",
      "192.168.4.30",
      ...String(process.env.NEXT_ALLOWED_DEV_ORIGINS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ],
  ),
);

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
