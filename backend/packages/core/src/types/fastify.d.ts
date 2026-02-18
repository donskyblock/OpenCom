import "fastify";
import type { PresenceUpdate } from "@ods/shared/events.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: any;
    pgPresenceUpsert: (userId: string, next: PresenceUpdate) => Promise<void>;
  }
}
