import { loadEnvConfig } from "@next/env";
import { defineConfig, env } from "prisma/config";

// Prisma 7 does not auto-load .env files. Use @next/env (already a project
// dependency) to load .env.local silently before Prisma reads SUPABASE_DB_URL.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("SUPABASE_DB_URL"),
  },
});
