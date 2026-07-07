#!/usr/bin/env node

/**
 * Import websites from parkgrader_audits into monitoring_websites.
 *
 * Reads existing audits from Supabase via the pooler, extracts unique
 * domains/business names/emails, and adds them to the monitoring system.
 *
 * Usage (on droplet): cd /opt/parkgrader && node scripts/import-audit-websites.mjs
 */

import pg from "pg";
import nextEnv from "@next/env";

const { Client } = pg;
const { loadEnvConfig } = nextEnv;

async function main() {
  loadEnvConfig(process.cwd());

  const url = process.env.SUPABASE_DB_URL?.trim() || "";
  if (!url) throw new Error("Missing SUPABASE_DB_URL");

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Get all unique domains with their business names, emails, and URLs.
  const { rows } = await client.query(`
    SELECT DISTINCT ON (domain)
      domain,
      company_name,
      website_url,
      email
    FROM parkgrader_audits
    WHERE domain IS NOT NULL
      AND company_name IS NOT NULL
      AND website_url IS NOT NULL
    ORDER BY domain, scan_date DESC
  `);

  console.log(`Found ${rows.length} unique domains in parkgrader_audits.`);

  let added = 0;
  let skipped = 0;

  for (const row of rows) {
    const domain = row.domain.toLowerCase().trim();
    const name = row.company_name.trim();
    const homepageUrl = row.website_url.trim();
    const email = (row.email || "").toLowerCase().trim();

    // Check if already in monitoring.
    const existing = await client.query(
      `SELECT id FROM monitoring_websites WHERE domain = $1`,
      [domain],
    );

    if (existing.rows.length > 0) {
      skipped++;
      // Update contact email if not set.
      if (email) {
        await client.query(
          `UPDATE monitoring_websites SET "contactEmail" = $1 WHERE domain = $2 AND "contactEmail" IS NULL`,
          [email, domain],
        );
      }
      continue;
    }

    // Insert the website.
    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO monitoring_websites (id, "businessName", domain, "homepageUrl", "contactEmail", "monthlyReportsEnabled")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, name, domain, homepageUrl, email || null, !!email],
    );

    // Create default monitoring settings.
    const settingsId = crypto.randomUUID();
    await client.query(
      `INSERT INTO monitoring_settings (id, "websiteId") VALUES ($1, $2)`,
      [settingsId, id],
    );

    added++;
    console.log(`  + ${name} (${domain})${email ? ` — ${email}` : ""}`);
  }

  console.log(`\nDone: ${added} added, ${skipped} already existed.`);
  await client.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
