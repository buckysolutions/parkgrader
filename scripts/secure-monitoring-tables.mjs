#!/usr/bin/env node

/**
 * Enable RLS on all monitoring tables.
 *
 * Matches the existing parkgrader_audits pattern: revoke all from anon/authenticated,
 * grant full access to service_role only. All data access goes through server-side
 * API routes — never directly from the browser.
 *
 * Usage: node scripts/secure-monitoring-tables.mjs
 */

import pg from "pg";
import nextEnv from "@next/env";

const { Client } = pg;
const { loadEnvConfig } = nextEnv;

const TABLES = [
  "monitoring_websites",
  "monitoring_checks",
  "monitoring_incidents",
  "monitoring_notifications",
  "monitoring_settings",
  "monitoring_unsubscribed",
];

function rlsSql(table: string): string {
  return [
    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`,
    `REVOKE ALL ON TABLE ${table} FROM anon, authenticated;`,
    `DROP POLICY IF EXISTS "service role full access" ON ${table};`,
    `CREATE POLICY "service role full access" ON ${table} AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  ].join("\n");
}

async function main() {
  loadEnvConfig(process.cwd());

  const url = process.env.SUPABASE_DB_URL?.trim() || "";
  if (!url) throw new Error("Missing SUPABASE_DB_URL");

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  for (const table of TABLES) {
    try {
      await client.query("BEGIN");
      await client.query(rlsSql(table));
      await client.query("COMMIT");
      console.log(`✅ ${table} — RLS enabled, locked to service_role`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`❌ ${table} — ${error.message}`);
    }
  }

  await client.end();
  console.log("\nAll monitoring tables secured.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
