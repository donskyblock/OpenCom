import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { env } from "./env.js";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB for raw image uploads

export function buildHttp() {
  const app = Fastify({ logger: true, bodyLimit: MAX_IMAGE_BYTES });

  app.register(cors, { origin: true, credentials: true });
  app.register(rateLimit, { max: 240, timeWindow: "1 minute" });
  app.register(multipart, { limits: { fileSize: MAX_IMAGE_BYTES } });

  app.register(jwt, { secret: env.CORE_JWT_ACCESS_SECRET });

  app.setErrorHandler((error, req, rep) => {
    if (error instanceof ZodError) {
      return rep.code(400).send({ error: "VALIDATION_ERROR", issues: error.issues });
    }
    if (error.message === "INVALID_JSON_BODY") {
      return rep.code(400).send({ error: "INVALID_JSON_BODY" });
    }

    req.log.error({ err: error }, "Unhandled request error");
    return rep.code(500).send({ error: "INTERNAL_SERVER_ERROR" });
  });

  // Note: refresh tokens use separate secret manually (not via plugin)
  app.get("/health", async () => ({ ok: true }));

  return app;
}
