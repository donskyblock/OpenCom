import { FastifyInstance } from "fastify";
import { env } from "../env.js";

export async function jwksRoutes(app: FastifyInstance) {
  app.get("/v1/jwks", async () => {
    const pub = JSON.parse(env.CORE_MEMBERSHIP_PUBLIC_JWK);
    return { keys: [pub] };
  });
}
