import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env.js";

export function buildHttp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true, credentials: true });
  app.register(rateLimit, { max: 240, timeWindow: "1 minute" });

  app.register(jwt, { secret: env.CORE_JWT_ACCESS_SECRET });

  // Note: refresh tokens use separate secret manually (not via plugin)
  app.get("/health", async () => ({ ok: true }));

  return app;
}
