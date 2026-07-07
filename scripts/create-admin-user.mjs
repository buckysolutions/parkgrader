#!/usr/bin/env node

/**
 * Create the first admin user in Supabase Auth.
 *
 * Uses the Supabase service role key to create a user via the Admin API.
 * This is a one-time setup script.
 *
 * Usage: node scripts/create-admin-user.mjs <email> <password>
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

async function main() {
  loadEnvConfig(process.cwd());

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: node scripts/create-admin-user.mjs <email> <password>");
    process.exit(1);
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create user: ${error}`);
  }

  const user = await res.json();
  console.log(`✅ Admin user created: ${user.email} (ID: ${user.id})`);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
