import { FastifyInstance } from "fastify";
import { z } from "zod";
import { q } from "../db.js";
import { parseBody } from "../validation.js";
import { getActiveManualBoostGrant, reconcileBoostBadge } from "../boost.js";

const PLATFORM_ADMIN_BADGE = "PLATFORM_ADMIN";
const PLATFORM_FOUNDER_BADGE = "PLATFORM_FOUNDER";
const BOOST_GRANT_TYPE = z.enum(["permanent", "temporary"]);

type PlatformRole = "user" | "admin" | "owner";

async function getPlatformRole(userId: string): Promise<PlatformRole> {
  const founder = await q<{ founder_user_id: string | null }>(
    `SELECT founder_user_id FROM platform_config WHERE id=1`
  );
  if (founder.length && founder[0].founder_user_id === userId) return "owner";

  const admin = await q<{ user_id: string }>(
    `SELECT user_id FROM platform_admins WHERE user_id=:userId`,
    { userId }
  );
  if (admin.length) return "admin";

  return "user";
}

async function requirePlatformStaff(userId: string) {
  const role = await getPlatformRole(userId);
  if (role !== "admin" && role !== "owner") throw new Error("FORBIDDEN");
  return role;
}

async function setBadge(userId: string, badge: string, enabled: boolean) {
  if (enabled) {
    await q(
      `INSERT INTO user_badges (user_id,badge)
       VALUES (:userId,:badge)
       ON DUPLICATE KEY UPDATE user_id=user_id`,
      { userId, badge }
    );
  } else {
    await q(
      `DELETE FROM user_badges WHERE user_id=:userId AND badge=:badge`,
      { userId, badge }
    );
  }
}

function toMySqlDateTime(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/v1/admin/overview", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const actorId = req.user.sub as string;

    try {
      await requirePlatformStaff(actorId);
    } catch {
      return rep.code(403).send({ error: "FORBIDDEN" });
    }

    const founder = await q<any>(
      `SELECT u.id,u.username,u.email
       FROM platform_config pc
       LEFT JOIN users u ON u.id=pc.founder_user_id
       WHERE pc.id=1`
    );

    const admins = await q<any>(
      `SELECT u.id,u.username,u.email,pa.created_at
       FROM platform_admins pa
       JOIN users u ON u.id=pa.user_id
       ORDER BY pa.created_at DESC`
    );

    const activeBoostGrants = await q<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM admin_boost_grants
       WHERE revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())`
    );

    return {
      founder: founder[0]?.id ? founder[0] : null,
      admins,
      activeBoostGrants: Number(activeBoostGrants[0]?.count || 0)
    };
  });

  app.get("/v1/admin/users", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const actorId = req.user.sub as string;

    try {
      await requirePlatformStaff(actorId);
    } catch {
      return rep.code(403).send({ error: "FORBIDDEN" });
    }

    const { query } = z.object({ query: z.string().min(1).max(64) }).parse(req.query);

    const users = await q<any>(
      `SELECT id,username,email
       FROM users
       WHERE username LIKE :likeQ OR email LIKE :likeQ
       ORDER BY created_at DESC
       LIMIT 20`,
      { likeQ: `%${query}%` }
    );

    return { users };
  });

  app.get("/v1/admin/users/:userId/detail", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const actorId = req.user.sub as string;

    try {
      await requirePlatformStaff(actorId);
    } catch {
      return rep.code(403).send({ error: "FORBIDDEN" });
    }

    const { userId } = z.object({ userId: z.string().min(3) }).parse(req.params);
    const userRows = await q<any>(`SELECT id,username,email,created_at FROM users WHERE id=:userId LIMIT 1`, { userId });
    if (!userRows.length) return rep.code(404).send({ error: "USER_NOT_FOUND" });

    const badges = await q<{ badge: string; created_at: string }>(
      `SELECT badge,created_at FROM user_badges WHERE user_id=:userId ORDER BY created_at DESC`,
      { userId }
    );

    return {
      user: userRows[0],
      badges
    };
  });

  app.post("/v1/admin/users/:userId/platform-admin", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const actorId = req.user.sub as string;
    const actorRole = await getPlatformRole(actorId);
    if (actorRole !== "owner") return rep.code(403).send({ error: "ONLY_OWNER" });

    const { userId } = z.object({ userId: z.string().min(3) }).parse(req.params);
    const { enabled } = parseBody(z.object({ enabled: z.boolean() }), req.body);

    const target = await q<{ id: string }>(`SELECT id FROM users WHERE id=:userId`, { userId });
    if (!target.length) return rep.code(404).send({ error: "USER_NOT_FOUND" });

    if (enabled) {
      await q(
        `INSERT INTO platform_admins (user_id,added_by)
         VALUES (:userId,:actorId)
         ON DUPLICATE KEY UPDATE user_id=user_id`,
        { userId, actorId }
      );
      await setBadge(userId, PLATFORM_ADMIN_BADGE, true);
    } else {
      await q(`DELETE FROM platform_admins WHERE user_id=:userId`, { userId });
      await setBadge(userId, PLATFORM_ADMIN_BADGE, false);
    }

    return { ok: true };
  });

  app.post("/v1/admin/founder", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const actorId = req.user.sub as string;
    const actorRole = await getPlatformRole(actorId);
    if (actorRole !== "owner") return rep.code(403).send({ error: "ONLY_OWNER" });

    const { userId } = parseBody(z.object({ userId: z.string().min(3) }), req.body);

    const target = await q<{ id: string }>(`SELECT id FROM users WHERE id=:userId`, { userId });
    if (!target.length) return rep.code(404).send({ error: "USER_NOT_FOUND" });

    const prev = await q<{ founder_user_id: string | null }>(`SELECT founder_user_id FROM platform_config WHERE id=1`);

    await q(
      `INSERT INTO platform_config (id, founder_user_id)
       VALUES (1,:userId)
       ON DUPLICATE KEY UPDATE founder_user_id=VALUES(founder_user_id)`,
      { userId }
    );

    if (prev.length && prev[0].founder_user_id) {
      await setBadge(prev[0].founder_user_id, PLATFORM_FOUNDER_BADGE, false);
    }

    await setBadge(userId, PLATFORM_FOUNDER_BADGE, true);
    await setBadge(userId, PLATFORM_ADMIN_BADGE, true);

    await q(
      `INSERT INTO platform_admins (user_id,added_by)
       VALUES (:userId,:actorId)
       ON DUPLICATE KEY UPDATE user_id=user_id`,
      { userId, actorId }
    );

    return { ok: true };
  });

  app.post("/v1/admin/users/:userId/badges", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const actorId = req.user.sub as string;

    try {
      await requirePlatformStaff(actorId);
    } catch {
      return rep.code(403).send({ error: "FORBIDDEN" });
    }

    const { userId } = z.object({ userId: z.string().min(3) }).parse(req.params);
    const body = parseBody(z.object({ badge: z.string().min(2).max(64), enabled: z.boolean() }), req.body);

    if (body.badge === PLATFORM_FOUNDER_BADGE) {
      const role = await getPlatformRole(actorId);
      if (role !== "owner") return rep.code(403).send({ error: "ONLY_OWNER" });
    }

    await setBadge(userId, body.badge, body.enabled);
    return { ok: true };
  });

  app.get("/v1/admin/users/:userId/boost", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const actorId = req.user.sub as string;
    try {
      await requirePlatformStaff(actorId);
    } catch {
      return rep.code(403).send({ error: "FORBIDDEN" });
    }

    const { userId } = z.object({ userId: z.string().min(3) }).parse(req.params);
    const target = await q<{ id: string }>(`SELECT id FROM users WHERE id=:userId`, { userId });
    if (!target.length) return rep.code(404).send({ error: "USER_NOT_FOUND" });

    const entitlement = await reconcileBoostBadge(userId);
    const activeGrant = await getActiveManualBoostGrant(userId);
    const recentGrants = await q<any>(
      `SELECT id,grant_type,reason,created_at,expires_at,revoked_at,granted_by,revoked_by
       FROM admin_boost_grants
       WHERE user_id=:userId
       ORDER BY created_at DESC
       LIMIT 20`,
      { userId }
    );

    return {
      userId,
      boostActive: entitlement.active,
      boostSource: entitlement.source,
      activeGrant,
      recentGrants
    };
  });

  app.post("/v1/admin/users/:userId/boost/grant", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const actorId = req.user.sub as string;
    try {
      await requirePlatformStaff(actorId);
    } catch {
      return rep.code(403).send({ error: "FORBIDDEN" });
    }

    const { userId } = z.object({ userId: z.string().min(3) }).parse(req.params);
    const target = await q<{ id: string }>(`SELECT id FROM users WHERE id=:userId`, { userId });
    if (!target.length) return rep.code(404).send({ error: "USER_NOT_FOUND" });

    const body = parseBody(
      z.object({
        grantType: BOOST_GRANT_TYPE,
        durationDays: z.number().int().min(1).max(3650).optional(),
        reason: z.string().trim().min(3).max(240).optional()
      }),
      req.body
    );

    if (body.grantType === "temporary" && !body.durationDays) {
      return rep.code(400).send({ error: "TEMPORARY_GRANT_REQUIRES_DURATION" });
    }

    await q(
      `UPDATE admin_boost_grants
       SET revoked_at=NOW(), revoked_by=:actorId
       WHERE user_id=:userId
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())`,
      { userId, actorId }
    );

    const expiresAt = body.grantType === "temporary"
      ? toMySqlDateTime(new Date(Date.now() + Number(body.durationDays || 0) * 24 * 60 * 60 * 1000))
      : null;

    await q(
      `INSERT INTO admin_boost_grants (user_id,granted_by,grant_type,reason,expires_at)
       VALUES (:userId,:actorId,:grantType,:reason,:expiresAt)`,
      {
        userId,
        actorId,
        grantType: body.grantType,
        reason: body.reason || null,
        expiresAt
      }
    );

    const entitlement = await reconcileBoostBadge(userId);
    return {
      ok: true,
      userId,
      grantType: body.grantType,
      expiresAt,
      boostActive: entitlement.active,
      boostSource: entitlement.source
    };
  });

  app.post("/v1/admin/users/:userId/boost/revoke", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const actorId = req.user.sub as string;
    try {
      await requirePlatformStaff(actorId);
    } catch {
      return rep.code(403).send({ error: "FORBIDDEN" });
    }

    const { userId } = z.object({ userId: z.string().min(3) }).parse(req.params);
    await q(
      `UPDATE admin_boost_grants
       SET revoked_at=NOW(), revoked_by=:actorId
       WHERE user_id=:userId
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())`,
      { userId, actorId }
    );
    const entitlement = await reconcileBoostBadge(userId);
    return {
      ok: true,
      boostActive: entitlement.active,
      boostSource: entitlement.source
    };
  });

  app.get("/v1/me/admin-status", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const userId = req.user.sub as string;
    const role = await getPlatformRole(userId);
    return {
      platformRole: role,
      isPlatformAdmin: role === "admin" || role === "owner",
      isPlatformOwner: role === "owner"
    };
  });
}
