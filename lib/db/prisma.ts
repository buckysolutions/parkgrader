import { PrismaClient } from "../../prisma/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";

  if (!connectionString) {
    throw new Error(
      "Missing SUPABASE_DB_URL (or POSTGRES_URL / DATABASE_URL). " +
        "Add your Supabase direct Postgres connection string to .env.local.",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
