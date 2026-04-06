import type { FastifyInstance } from "fastify";
import { q } from "../db.js"

function toSqlTimestamp(msFromEpoch: number): string {
  return new Date(msFromEpoch).toISOString().slice(0, 19).replace("T", " ");
}

async function fetchOauthAppCount() {
    const result = await q<{ count: number }>(
        "SELECT COUNT(*) as count FROM oauth_apps"
    );

    const count = result[0]?.count ?? 0;

    return count
}
async function fetchOauthActiveAppCount() {
    const result = await q<{ count: number }>(
        "SELECT COUNT(*) as count FROM oauth_apps WHERE is_active = 1"
    );

    const count = result[0]?.count ?? 0;

    return count
}

export function StatsRoutes(app: FastifyInstance) {
  app.get('/stats/counts', async (request, reply) => {
    return {
      success: true,
      count: await fetchOauthAppCount(),
      active_count: await fetchOauthActiveAppCount(),
      timestamp: toSqlTimestamp(Date.now()) 
    };
  });


}
