#!/usr/bin/env node

/**
 * Create monitoring tables in Supabase PostgreSQL.
 *
 * Uses the same pg client + .env.local loading pattern as
 * scripts/setup-supabase-db.mjs.
 *
 * Tables created (all prefixed with "monitoring_"):
 *   monitoring_websites, monitoring_checks, monitoring_incidents,
 *   monitoring_notifications, monitoring_settings
 *
 * Usage: node scripts/setup-monitoring-db.mjs
 */

import pg from "pg";
import nextEnv from "@next/env";

const { Client } = pg;
const { loadEnvConfig } = nextEnv;

const CREATE_TABLES_SQL = `
-- Monitoring Websites
CREATE TABLE IF NOT EXISTS monitoring_websites (
  id                  TEXT PRIMARY KEY,
  "businessName"      TEXT NOT NULL,
  domain              TEXT NOT NULL UNIQUE,
  "homepageUrl"       TEXT NOT NULL,
  "bookingUrl"        TEXT,
  "contactUrl"        TEXT,
  "monitoringEnabled" BOOLEAN NOT NULL DEFAULT true,
  "monitoringFrequency" INTEGER NOT NULL DEFAULT 60,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_websites_enabled
  ON monitoring_websites ("monitoringEnabled");

-- Monitoring Checks
CREATE TABLE IF NOT EXISTS monitoring_checks (
  id                TEXT PRIMARY KEY,
  "websiteId"       TEXT NOT NULL REFERENCES monitoring_websites(id) ON DELETE CASCADE,
  "checkedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "homepageStatus"  INTEGER,
  "bookingStatus"   INTEGER,
  "responseTime"    INTEGER,
  "sslDaysRemaining" INTEGER,
  "dnsStatus"       TEXT,
  "screenshotPath"  TEXT,
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_monitoring_checks_website_checked
  ON monitoring_checks ("websiteId", "checkedAt");

-- Monitoring Incidents
CREATE TABLE IF NOT EXISTS monitoring_incidents (
  id          TEXT PRIMARY KEY,
  "websiteId" TEXT NOT NULL REFERENCES monitoring_websites(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  severity    TEXT NOT NULL,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "endedAt"   TIMESTAMPTZ,
  resolved    BOOLEAN NOT NULL DEFAULT false,
  message     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monitoring_incidents_website_resolved
  ON monitoring_incidents ("websiteId", resolved);

CREATE INDEX IF NOT EXISTS idx_monitoring_incidents_resolved
  ON monitoring_incidents (resolved);

-- Monitoring Notifications
CREATE TABLE IF NOT EXISTS monitoring_notifications (
  id           TEXT PRIMARY KEY,
  "websiteId"  TEXT NOT NULL REFERENCES monitoring_websites(id) ON DELETE CASCADE,
  "incidentId" TEXT,
  type         TEXT NOT NULL,
  "sentAt"     TIMESTAMPTZ,
  email        TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_notifications_status
  ON monitoring_notifications (status);

-- Monitoring Settings
CREATE TABLE IF NOT EXISTS monitoring_settings (
  id                          TEXT PRIMARY KEY,
  "websiteId"                 TEXT NOT NULL UNIQUE REFERENCES monitoring_websites(id) ON DELETE CASCADE,
  "notifyCustomer"            BOOLEAN NOT NULL DEFAULT true,
  "notifyInternal"            BOOLEAN NOT NULL DEFAULT true,
  "emailCooldown"             INTEGER NOT NULL DEFAULT 60,
  "verifyFailuresBeforeAlert" BOOLEAN NOT NULL DEFAULT true,
  "verificationDelayMs"       INTEGER NOT NULL DEFAULT 30000
);

-- Prisma migrations tracking (so Prisma knows the state)
CREATE TABLE IF NOT EXISTS _prisma_migrations (
  id                      VARCHAR(36) PRIMARY KEY,
  checksum                VARCHAR(64) NOT NULL,
  finished_at             TIMESTAMPTZ,
  migration_name          VARCHAR(255) NOT NULL,
  logs                    TEXT,
  rolled_back_at          TIMESTAMPTZ,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_steps_count     INTEGER NOT NULL DEFAULT 0
);
`;

async function main() {
  loadEnvConfig(process.cwd());

  const connectionString =
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";

  if (!connectionString) {
    throw new Error(
      "Missing SUPABASE_DB_URL (or POSTGRES_URL / DATABASE_URL) in .env.local.",
    );
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to database.");

    await client.query("BEGIN");
    await client.query(CREATE_TABLES_SQL);
    await client.query("COMMIT");

    console.log("Monitoring tables created successfully.");
    console.log("");
    console.log("Tables:");
    console.log("  ✓ monitoring_websites");
    console.log("  ✓ monitoring_checks");
    console.log("  ✓ monitoring_incidents");
    console.log("  ✓ monitoring_notifications");
    console.log("  ✓ monitoring_settings");
    console.log("");
    console.log("Next: run 'npx prisma generate' if you haven't already.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to create monitoring tables: ${message}`);
  process.exit(1);
});
