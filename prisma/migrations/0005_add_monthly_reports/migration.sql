ALTER TABLE "monitoring_websites" ADD COLUMN IF NOT EXISTS "monthlyReportsEnabled" BOOLEAN NOT NULL DEFAULT false;
