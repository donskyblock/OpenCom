#!/usr/bin/env node

import path from "path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

// You will run this from: backend/packages/core
// This resolves to: backend/.env
dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});

const dbUrl = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("❌ No CORE_DATABASE_URL or DATABASE_URL found in backend/.env");
  process.exit(1);
}

(async () => {
  try {
    const connection = await mysql.createConnection(dbUrl);

    console.log("Connected. Wiping Stripe subscription data...");

    await connection.execute(`
      UPDATE user_subscriptions
      SET
        stripe_customer_id = NULL,
        stripe_subscription_id = NULL,
        current_period_end = NULL,
        status = 'canceled'
    `);

    console.log("✅ Stripe data wiped successfully.");
    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err?.message || err);
    process.exit(1);
  }
})();
