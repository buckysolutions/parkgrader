-- CreateTable
CREATE TABLE "monitoring_websites" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "homepageUrl" TEXT NOT NULL,
    "bookingUrl" TEXT,
    "contactUrl" TEXT,
    "monitoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "monitoringFrequency" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoring_websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_checks" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "homepageStatus" INTEGER,
    "bookingStatus" INTEGER,
    "responseTime" INTEGER,
    "sslDaysRemaining" INTEGER,
    "dnsStatus" TEXT,
    "screenshotPath" TEXT,
    "notes" TEXT,

    CONSTRAINT "monitoring_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_incidents" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL,

    CONSTRAINT "monitoring_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_notifications" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "incidentId" TEXT,
    "type" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitoring_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_settings" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "notifyCustomer" BOOLEAN NOT NULL DEFAULT true,
    "notifyInternal" BOOLEAN NOT NULL DEFAULT true,
    "emailCooldown" INTEGER NOT NULL DEFAULT 60,
    "verifyFailuresBeforeAlert" BOOLEAN NOT NULL DEFAULT true,
    "verificationDelayMs" INTEGER NOT NULL DEFAULT 30000,

    CONSTRAINT "monitoring_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_websites_domain_key" ON "monitoring_websites"("domain");

-- CreateIndex
CREATE INDEX "monitoring_websites_monitoringEnabled_idx" ON "monitoring_websites"("monitoringEnabled");

-- CreateIndex
CREATE INDEX "monitoring_checks_websiteId_checkedAt_idx" ON "monitoring_checks"("websiteId", "checkedAt");

-- CreateIndex
CREATE INDEX "monitoring_incidents_websiteId_resolved_idx" ON "monitoring_incidents"("websiteId", "resolved");

-- CreateIndex
CREATE INDEX "monitoring_incidents_resolved_idx" ON "monitoring_incidents"("resolved");

-- CreateIndex
CREATE INDEX "monitoring_notifications_status_idx" ON "monitoring_notifications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_settings_websiteId_key" ON "monitoring_settings"("websiteId");

-- AddForeignKey
ALTER TABLE "monitoring_checks" ADD CONSTRAINT "monitoring_checks_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "monitoring_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_incidents" ADD CONSTRAINT "monitoring_incidents_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "monitoring_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_notifications" ADD CONSTRAINT "monitoring_notifications_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "monitoring_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_settings" ADD CONSTRAINT "monitoring_settings_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "monitoring_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
