import { q } from "./db.js";

export const BOOST_BADGE = "boost";

type ActiveGrantRow = {
  id: number;
  grant_type: "permanent" | "temporary";
  expires_at: string | null;
  created_at: string;
  granted_by: string;
  reason: string | null;
};

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function hasActiveStripeBoost(userId: string): Promise<boolean> {
  const rows = await q<{ has_active: number }>(
    `SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END AS has_active
     FROM user_subscriptions
     WHERE user_id=:userId
       AND status IN ('active','trialing','past_due')`,
    { userId }
  );
  return rows[0]?.has_active === 1;
}

export async function getActiveManualBoostGrant(userId: string): Promise<ActiveGrantRow | null> {
  const rows = await q<ActiveGrantRow>(
    `SELECT id,grant_type,expires_at,created_at,granted_by,reason
     FROM admin_boost_grants
     WHERE user_id=:userId
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC
     LIMIT 1`,
    { userId }
  );
  return rows[0] ?? null;
}

export async function reconcileBoostBadge(userId: string): Promise<{ active: boolean; source: "none" | "stripe" | "manual" | "both"; expiresAt: string | null }> {
  const [manualGrant, stripeActive] = await Promise.all([
    getActiveManualBoostGrant(userId),
    hasActiveStripeBoost(userId)
  ]);

  const manualActive = Boolean(manualGrant);
  const shouldHaveBoost = manualActive || stripeActive;

  if (shouldHaveBoost) {
    await q(
      `INSERT INTO user_badges (user_id,badge)
       VALUES (:userId,:badge)
       ON DUPLICATE KEY UPDATE user_id=user_id`,
      { userId, badge: BOOST_BADGE }
    );
  } else {
    await q(`DELETE FROM user_badges WHERE user_id=:userId AND badge=:badge`, { userId, badge: BOOST_BADGE });
  }

  let source: "none" | "stripe" | "manual" | "both" = "none";
  if (stripeActive && manualActive) source = "both";
  else if (stripeActive) source = "stripe";
  else if (manualActive) source = "manual";

  const expiresAt = parseDate(manualGrant?.expires_at ?? null)?.toISOString() ?? null;
  return { active: shouldHaveBoost, source, expiresAt };
}
