import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import nextEnv from "@next/env";
import pg from "pg";

const { Client } = pg;
const { loadEnvConfig } = nextEnv;

async function main() {
  loadEnvConfig(process.cwd());

  const connectionString =
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";

  if (!connectionString) {
    throw new Error(
      "Missing SUPABASE_DB_URL (or POSTGRES_URL / DATABASE_URL) in .env.local. Add your Supabase direct Postgres connection string.",
    );
  }

  if (!connectionString.startsWith("postgresql://") && !connectionString.startsWith("postgres://")) {
    throw new Error(
      "SUPABASE_DB_URL must be a Postgres connection string (postgresql://...). Do not use the project HTTPS URL.",
    );
  }

  const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");
  const sql = await fs.readFile(schemaPath, "utf8");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log("Supabase schema applied successfully.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to apply Supabase schema: ${message}`);
  process.exit(1);
});
