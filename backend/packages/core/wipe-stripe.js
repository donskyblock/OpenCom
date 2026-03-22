#!/usr/bin/env node

import path from "path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

// You will run this from: backend/packages/core
// This resolves to: backend/.env
dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME,
};

const missingDbVars = Object.entries(dbConfig)
  .filter(([_, value]) => value === undefined || value === "")
  .map(([key]) => key.toUpperCase());

if (missingDbVars.length) {
  console.error(`❌ Missing required DB variables in backend/.env: ${missingDbVars.join(", ")}`);
  process.exit(1);
}

(async () => {
  try {
    const connection = await mysql.createConnection(dbConfig);

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
