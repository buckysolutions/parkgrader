#!/usr/bin/env node
import pg from "pg";
import nextEnv from "@next/env";
const { Client } = pg;
const { loadEnvConfig } = nextEnv;
async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.SUPABASE_DB_URL?.trim() || "";
  if (!url) throw new Error("Missing SUPABASE_DB_URL");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query('ALTER TABLE "monitoring_websites" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT');
    console.log("✅ contactEmail column added.");
  } finally { await client.end(); }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
