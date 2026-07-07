-- CreateTable
CREATE TABLE IF NOT EXISTS "monitoring_unsubscribed" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitoring_unsubscribed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_unsubscribed_email_key" ON "monitoring_unsubscribed"("email");
