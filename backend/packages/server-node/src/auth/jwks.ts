import { createRemoteJWKSet } from "jose";
import { env } from "../env.js";

export const jwks = createRemoteJWKSet(new URL(env.CORE_JWKS_URL));
