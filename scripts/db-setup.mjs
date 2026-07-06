#!/usr/bin/env node

/**
 * Apply Prisma migrations to the Supabase database.
 *
 * Usage: node scripts/db-setup.mjs
 *
 * Reads SUPABASE_DB_URL from .env.local (same pattern as scripts/setup-supabase-db.mjs).
 * Runs `npx prisma migrate deploy` to apply any pending migrations.
 */

import { execSync } from "node:child_process";
import nextEnv from "@next/env";

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
      "Missing SUPABASE_DB_URL (or POSTGRES_URL / DATABASE_URL) in .env.local. " +
        "Add your Supabase direct Postgres connection string.",
    );
  }

  console.log("Generating Prisma client...");
  execSync("npx prisma generate", { stdio: "inherit", cwd: process.cwd() });

  console.log("Running migrations...");
  execSync("npx prisma migrate deploy", { stdio: "inherit", cwd: process.cwd() });

  console.log("Database setup complete.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Database setup failed: ${message}`);
  process.exit(1);
});
