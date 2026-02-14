import { z } from "zod";

const Env = z.object({
  CORE_PORT: z.coerce.number().default(3001),
  CORE_HOST: z.string().default("127.0.0.1"),
  /** Host for WebSocket gateway only. Use 0.0.0.0 so it's reachable externally; main API stays on CORE_HOST. */
  CORE_GATEWAY_HOST: z.string().default("0.0.0.0"),
  /** Port for WebSocket gateway only. Point ws.opencom.online A record at this server; separate port so it won't conflict with API or nginx. Default 443. */
  CORE_GATEWAY_PORT: z.coerce.number().default(443),
  CORE_DATABASE_URL: z.string().min(1),
  CORE_JWT_ACCESS_SECRET: z.string().min(16),
  CORE_JWT_REFRESH_SECRET: z.string().min(16),

  CORE_MEMBERSHIP_PRIVATE_JWK: z.string().min(1),
  CORE_MEMBERSHIP_PUBLIC_JWK: z.string().min(1),
  CORE_ISSUER: z.string().min(1),
  ADMIN_PANEL_PASSWORD: z.string().min(8),
  REDIS_URL: z.string().url().optional(),
  
  // Profile image storage
  PROFILE_IMAGE_STORAGE_DIR: z.string().default("./storage/profiles"),
  PROFILE_IMAGE_BASE_URL: z.string().default("/v1/profile-images"),

  // Official server node (one server per user hosted by the platform)
  OFFICIAL_NODE_BASE_URL: z.string().url().optional(),
  /** Must match NODE_SERVER_ID on that node so the node accepts the membership token */
  OFFICIAL_NODE_SERVER_ID: z.string().min(1).optional()
});

export const env = Env.parse(process.env);
