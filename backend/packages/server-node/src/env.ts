import { z } from "zod";

const Env = z.object({
  NODE_PORT: z.coerce.number().default(3002),
  NODE_DATABASE_URL: z.string().min(1),
  NODE_ID: z.string().min(1),

  CORE_BASE_URL: z.string().url(),
  CORE_JWKS_URL: z.string().url(),


  ATTACHMENT_MAX_BYTES: z.coerce.number().default(52428800),
  ATTACHMENT_TTL_DAYS: z.coerce.number().default(365),
  ATTACHMENT_STORAGE_DIR: z.string().default("./data/attachments"),
  PUBLIC_BASE_URL: z.string().url(),
  NODE_SERVER_ID: z.string().min(1)

});

export const env = Env.parse(process.env);
