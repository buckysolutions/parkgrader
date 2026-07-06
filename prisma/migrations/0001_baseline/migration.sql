-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "parkgrader_audits" (
    "id" BIGSERIAL NOT NULL,
    "report_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "website_url" TEXT NOT NULL,
    "email" TEXT,
    "score" INTEGER NOT NULL,
    "scan_date" TIMESTAMPTZ(6) NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "report_snapshot" JSONB,
    "contact_name" TEXT,
    "phone" TEXT,
    "grade" TEXT,
    "top_issue" TEXT,
    "lead_intent" TEXT,
    "loom_requested" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_sent" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_sent_at" TIMESTAMPTZ(6),
    "hubspot_contact_id" TEXT,
    "utm_source" TEXT,

    CONSTRAINT "parkgrader_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parkgrader_audits_report_id_key" ON "parkgrader_audits"("report_id");

-- CreateIndex
CREATE INDEX "parkgrader_audits_domain_idx" ON "parkgrader_audits"("domain");

-- CreateIndex
CREATE INDEX "parkgrader_audits_is_test_idx" ON "parkgrader_audits"("is_test");

-- CreateIndex
CREATE INDEX "parkgrader_audits_scan_date_idx" ON "parkgrader_audits"("scan_date" DESC);
