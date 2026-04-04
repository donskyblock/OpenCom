import { FastifyInstance  } from "fastify";
import { q } from "../db";
import { parseBody } from "../validation";
import { z } from 'zod';
import crypto from "crypto";


const AppRegistration = z.object({
  app_id: z.string().trim().email(),
  app_name: z.string().trim().min(2).max(32),
  secret_code: z.string().trim().max(64).min(32),
  user_id: z.string(),
  redirect_url: z.string()
});

function hashSecret(secret: string): string {
  return crypto
    .createHash("sha256")
    .update(secret, "utf8")
    .digest("hex");
}

function generateClientSecret(): string {
  return crypto.randomBytes(32).toString("hex"); // 64 hex chars = 256 bits
}


async function registerApp(app_id: String, appname: String, owner_id: String, redirect_url: String) {
    const secret = generateClientSecret()
    const secret_hash = hashSecret(secret)

     // Split Redirect URLs
    const redirect_urls = {
        redirect_urls: redirect_url.split(",")
    };

    
    await q(
      `INSERT INTO oauth_apps (account_id,app_id, app_name, client_secret_hash, redirect_uris) VALUES (:userId,:app_id,:app_name, :client_secret_hash, :redirect_uris)`,
      { userId: owner_id, app_id, appname, secret_hash, redirect_urls}
    ); // To be honest probably should improve this but if it works it works

    return {
        success: true,
        client_secret: secret,
        timestamp: Date.now()
    }
}

export function OauthRoutes(app: FastifyInstance) { 

    app.post('/v1/create-app', async (req, rep) =>  { 
        const body = parseBody(AppRegistration, req.body)

        // General Params
        const app_id = body.app_id
        const app_name = body.app_name
        const redirect_url = body.redirect_url


        // Secure Creds ig
        const secret_code = body.secret_code
        const user_id = body.user_id


        const a = await registerApp(app_id, app_name, user_id, redirect_url)
        
        return a
    });
}