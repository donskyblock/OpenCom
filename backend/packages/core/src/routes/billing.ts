import { FastifyInstance } from "fastify";
import { q } from "../db.js";
import { env } from "../env.js";

const BOOST_BADGE = "boost";
const OPENCOM_BOOST_MONTHLY_GBP = 10;
const OPENCOM_BOOST_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;

function stripeConfigured() {
  return Boolean(env.STRIPE_SECRET_KEY);
}

async function stripeRequest(path: string, params: Record<string, string> = {}, method: "GET" | "POST" = "POST") {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_NOT_CONFIGURED");

  const query = method === "GET" ? `?${new URLSearchParams(params).toString()}` : "";
  const response = await fetch(`https://api.stripe.com/v1${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: method === "POST" ? new URLSearchParams(params).toString() : undefined
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`STRIPE_${response.status}${text ? `:${text}` : ""}`);
  }

  return response.json() as Promise<any>;
}

async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const existing = await q<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM user_subscriptions WHERE user_id=:userId LIMIT 1`,
    { userId }
  );

  const existingId = existing[0]?.stripe_customer_id;
  if (existingId) return existingId;

  const user = await q<{ email: string; username: string }>(`SELECT email,username FROM users WHERE id=:userId LIMIT 1`, { userId });

  const created = await stripeRequest("/customers", {
    email: user[0]?.email || "",
    name: user[0]?.username || "",
    "metadata[userId]": userId
  });

  await q(
    `INSERT INTO user_subscriptions (user_id, stripe_customer_id, plan, status)
     VALUES (:userId, :stripeCustomerId, 'opencom_boost', 'incomplete')
     ON DUPLICATE KEY UPDATE stripe_customer_id=VALUES(stripe_customer_id)`,
    { userId, stripeCustomerId: created.id }
  );

  return created.id as string;
}

async function syncBoostBadgeFromStripe(userId: string) {
  const rows = await q<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM user_subscriptions WHERE user_id=:userId LIMIT 1`,
    { userId }
  );
  const stripeCustomerId = rows[0]?.stripe_customer_id;

  if (!stripeCustomerId) {
    return { active: false, status: "not_configured", currentPeriodEnd: null as string | null };
  }

  const subs = await stripeRequest("/subscriptions", {
    customer: stripeCustomerId,
    status: "all",
    limit: "5"
  }, "GET");

  const activeSub = (subs.data || []).find((s: any) => ["active", "trialing", "past_due"].includes(s.status));

  if (activeSub) {
    const currentPeriodEndIso = activeSub.current_period_end
      ? new Date(Number(activeSub.current_period_end) * 1000).toISOString()
      : null;

    await q(
      `INSERT INTO user_badges (user_id,badge) VALUES (:userId,:badge)
       ON DUPLICATE KEY UPDATE user_id=user_id`,
      { userId, badge: BOOST_BADGE }
    );

    await q(
      `INSERT INTO user_subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
       VALUES (:userId, :stripeCustomerId, :stripeSubscriptionId, 'opencom_boost', :status, :currentPeriodEnd)
       ON DUPLICATE KEY UPDATE
         stripe_customer_id=VALUES(stripe_customer_id),
         stripe_subscription_id=VALUES(stripe_subscription_id),
         status=VALUES(status),
         current_period_end=VALUES(current_period_end)`,
      {
        userId,
        stripeCustomerId,
        stripeSubscriptionId: activeSub.id,
        status: activeSub.status,
        currentPeriodEnd: currentPeriodEndIso ? currentPeriodEndIso.slice(0, 19).replace("T", " ") : null
      }
    );

    return { active: true, status: activeSub.status, currentPeriodEnd: currentPeriodEndIso };
  }

  await q(`DELETE FROM user_badges WHERE user_id=:userId AND badge=:badge`, { userId, badge: BOOST_BADGE });
  await q(`UPDATE user_subscriptions SET status='canceled', stripe_subscription_id=NULL, current_period_end=NULL WHERE user_id=:userId`, { userId });

  return { active: false, status: "canceled", currentPeriodEnd: null as string | null };
}

export async function billingRoutes(app: FastifyInstance) {
  app.get("/v1/billing/boost", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const userId = req.user.sub as string;

    if (!stripeConfigured()) {
      const hasBoost = await q<{ badge: string }>(`SELECT badge FROM user_badges WHERE user_id=:userId AND badge=:badge LIMIT 1`, { userId, badge: BOOST_BADGE });
      return {
        plan: "opencom_boost",
        priceGbpMonthly: OPENCOM_BOOST_MONTHLY_GBP,
        uploadLimitBytes: OPENCOM_BOOST_UPLOAD_LIMIT_BYTES,
        unlimitedServers: true,
        active: hasBoost.length > 0,
        stripeConfigured: false
      };
    }

    const sync = await syncBoostBadgeFromStripe(userId);
    return {
      plan: "opencom_boost",
      priceGbpMonthly: OPENCOM_BOOST_MONTHLY_GBP,
      uploadLimitBytes: OPENCOM_BOOST_UPLOAD_LIMIT_BYTES,
      unlimitedServers: true,
      active: sync.active,
      status: sync.status,
      currentPeriodEnd: sync.currentPeriodEnd,
      stripeConfigured: true
    };
  });

  app.post("/v1/billing/boost/checkout", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    if (!stripeConfigured() || !env.STRIPE_PRICE_ID_BOOST_GBP_10 || !env.STRIPE_SUCCESS_URL || !env.STRIPE_CANCEL_URL) {
      return rep.code(503).send({ error: "STRIPE_NOT_CONFIGURED" });
    }

    const customerId = await getOrCreateStripeCustomer(userId);

    const session = await stripeRequest("/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": env.STRIPE_PRICE_ID_BOOST_GBP_10,
      "line_items[0][quantity]": "1",
      success_url: env.STRIPE_SUCCESS_URL,
      cancel_url: env.STRIPE_CANCEL_URL,
      "metadata[userId]": userId,
      "metadata[plan]": "opencom_boost"
    });

    return rep.send({ url: session.url });
  });

  app.post("/v1/billing/boost/portal", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    if (!stripeConfigured() || !env.STRIPE_CUSTOMER_PORTAL_RETURN_URL) {
      return rep.code(503).send({ error: "STRIPE_NOT_CONFIGURED" });
    }

    const customerId = await getOrCreateStripeCustomer(userId);
    const session = await stripeRequest("/billing_portal/sessions", {
      customer: customerId,
      return_url: env.STRIPE_CUSTOMER_PORTAL_RETURN_URL
    });

    return rep.send({ url: session.url });
  });

  app.post("/v1/billing/boost/sync", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    if (!stripeConfigured()) return rep.code(503).send({ error: "STRIPE_NOT_CONFIGURED" });

    const sync = await syncBoostBadgeFromStripe(userId);
    return rep.send(sync);
  });

  app.post("/v1/billing/boost/cancel", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    if (!stripeConfigured()) return rep.code(503).send({ error: "STRIPE_NOT_CONFIGURED" });

    const row = await q<{ stripe_subscription_id: string | null }>(
      `SELECT stripe_subscription_id FROM user_subscriptions WHERE user_id=:userId LIMIT 1`,
      { userId }
    );

    const subscriptionId = row[0]?.stripe_subscription_id;
    if (!subscriptionId) return rep.code(404).send({ error: "NO_ACTIVE_SUBSCRIPTION" });

    await stripeRequest(`/subscriptions/${subscriptionId}`, { cancel_at_period_end: "true" });
    await syncBoostBadgeFromStripe(userId);

    return rep.send({ ok: true });
  });
}
