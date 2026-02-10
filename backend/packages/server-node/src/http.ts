import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

export function buildHttp() {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: true, credentials: true });
  app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  app.get("/health", async () => ({ ok: true }));
  return app;
}
