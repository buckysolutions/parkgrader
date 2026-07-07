#!/usr/bin/env node

/**
 * Create the unsubscribe table in Supabase PostgreSQL.
 *
 * Usage: node scripts/setup-unsubscribe-db.mjs
 */

import pg from "pg";
import nextEnv from "@next/env";

const { Client } = pg;
const { loadEnvConfig } = nextEnv;

const SQL = `
CREATE TABLE IF NOT EXISTS monitoring_unsubscribed (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function main() {
  loadEnvConfig(process.cwd());

  const connectionString =
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";

  if (!connectionString) throw new Error("Missing SUPABASE_DB_URL in .env.local");

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    await client.query(SQL);
    console.log("✅ Unsubscribe table created.");
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error(`❌ ${error.message}`); process.exit(1); });
