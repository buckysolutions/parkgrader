import { prisma } from "@/lib/db/prisma";
import type { DashboardSummary } from "./types";

// ── Website Queries ─────────────────────────────────────────────────

export async function getDueWebsites() {
  const now = new Date();

  const allEnabled = await prisma.monitoringWebsite.findMany({
    where: { monitoringEnabled: true },
    include: {
      settings: true,
      checks: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
    },
  });

  // Filter to websites whose last check is older than their frequency.
  return allEnabled.filter((site) => {
    const lastCheck = site.checks[0]?.checkedAt;
    if (!lastCheck) return true; // never checked
    const elapsed = now.getTime() - lastCheck.getTime();
    const frequencyMs = site.monitoringFrequency * 60 * 1000;
    return elapsed >= frequencyMs;
  });
}

export async function getWebsiteById(id: string) {
  return prisma.monitoringWebsite.findUnique({
    where: { id },
    include: { settings: true },
  });
}

export async function getWebsiteByDomain(domain: string) {
  return prisma.monitoringWebsite.findUnique({ where: { domain } });
}

export async function createWebsite(data: {
  businessName: string;
  domain: string;
  homepageUrl: string;
  bookingUrl?: string;
  contactUrl?: string;
  monitoringFrequency?: number;
}) {
  const website = await prisma.monitoringWebsite.create({
    data: {
      businessName: data.businessName,
      domain: data.domain,
      homepageUrl: data.homepageUrl,
      bookingUrl: data.bookingUrl,
      contactUrl: data.contactUrl,
      monitoringFrequency: data.monitoringFrequency ?? 60,
    },
  });

  // Auto-create default monitoring settings.
  await prisma.monitoringSettings.create({
    data: { websiteId: website.id },
  });

  return website;
}

export async function updateWebsite(
  id: string,
  data: {
    businessName?: string;
    homepageUrl?: string;
    bookingUrl?: string;
    contactUrl?: string;
    monitoringEnabled?: boolean;
    monitoringFrequency?: number;
  },
) {
  return prisma.monitoringWebsite.update({ where: { id }, data });
}

export async function getAllWebsites(search?: string) {
  const where = search
    ? {
        monitoringEnabled: true as const,
        OR: [
          { businessName: { contains: search, mode: "insensitive" as const } },
          { domain: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  return prisma.monitoringWebsite.findMany({
    where,
    include: {
      checks: { orderBy: { checkedAt: "desc" }, take: 1 },
      incidents: { where: { resolved: false } },
    },
    orderBy: { businessName: "asc" },
  });
}

// ── Check Queries ───────────────────────────────────────────────────

export async function createCheck(data: {
  websiteId: string;
  homepageStatus: number | null;
  bookingStatus: number | null;
  responseTime: number | null;
  sslDaysRemaining: number | null;
  dnsStatus: string | null;
  notes?: string;
}) {
  return prisma.monitoringCheck.create({
    data: {
      websiteId: data.websiteId,
      homepageStatus: data.homepageStatus,
      bookingStatus: data.bookingStatus,
      responseTime: data.responseTime,
      sslDaysRemaining: data.sslDaysRemaining,
      dnsStatus: data.dnsStatus,
      notes: data.notes,
    },
  });
}

export async function getChecksForWebsite(
  websiteId: string,
  limit = 50,
  offset = 0,
) {
  return prisma.monitoringCheck.findMany({
    where: { websiteId },
    orderBy: { checkedAt: "desc" },
    take: limit,
    skip: offset,
  });
}

export async function getLatestCheck(websiteId: string) {
  return prisma.monitoringCheck.findFirst({
    where: { websiteId },
    orderBy: { checkedAt: "desc" },
  });
}

// ── Incident Queries ────────────────────────────────────────────────

export async function createIncident(data: {
  websiteId: string;
  type: string;
  severity: string;
  message: string;
}) {
  return prisma.monitoringIncident.create({ data });
}

export async function getOpenIncidentsForWebsite(websiteId: string) {
  return prisma.monitoringIncident.findMany({
    where: { websiteId, resolved: false },
    orderBy: { startedAt: "desc" },
  });
}

export async function getRecentIncidentsForWebsite(
  websiteId: string,
  limit = 10,
) {
  return prisma.monitoringIncident.findMany({
    where: { websiteId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

export async function getAllIncidents(status?: "open" | "resolved") {
  const where =
    status === "open"
      ? { resolved: false }
      : status === "resolved"
        ? { resolved: true }
        : {};

  return prisma.monitoringIncident.findMany({
    where,
    include: { website: { select: { businessName: true, domain: true } } },
    orderBy: { startedAt: "desc" },
  });
}

export async function resolveIncident(id: string) {
  return prisma.monitoringIncident.update({
    where: { id },
    data: { resolved: true, endedAt: new Date() },
  });
}

export async function getOpenIncidentOfType(websiteId: string, type: string) {
  return prisma.monitoringIncident.findFirst({
    where: { websiteId, type, resolved: false },
  });
}

// ── Notification Queries ────────────────────────────────────────────

export async function createNotification(data: {
  websiteId: string;
  incidentId?: string;
  type: string;
  email?: string;
}) {
  return prisma.monitoringNotification.create({
    data: {
      websiteId: data.websiteId,
      incidentId: data.incidentId,
      type: data.type,
      email: data.email,
      status: "pending",
    },
  });
}

export async function getNotifications(status?: string) {
  const where = status ? { status } : {};
  return prisma.monitoringNotification.findMany({
    where,
    include: { website: { select: { businessName: true, domain: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function updateNotificationStatus(
  id: string,
  status: string,
) {
  const data: Record<string, unknown> = { status };
  if (status === "sent") data.sentAt = new Date();
  return prisma.monitoringNotification.update({ where: { id }, data });
}

export async function getLatestNotificationForWebsite(
  websiteId: string,
  type: string,
  withinMinutes: number,
) {
  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);
  return prisma.monitoringNotification.findFirst({
    where: {
      websiteId,
      type,
      status: "sent",
      sentAt: { gte: cutoff },
    },
    orderBy: { sentAt: "desc" },
  });
}

// ── Settings Queries ────────────────────────────────────────────────

export async function getMonitoringSettings(websiteId: string) {
  return prisma.monitoringSettings.findUnique({ where: { websiteId } });
}

export async function updateMonitoringSettings(
  websiteId: string,
  data: {
    notifyCustomer?: boolean;
    notifyInternal?: boolean;
    emailCooldown?: number;
    verifyFailuresBeforeAlert?: boolean;
    verificationDelayMs?: number;
  },
) {
  return prisma.monitoringSettings.update({ where: { websiteId }, data });
}

// ── Dashboard ───────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [websites, checks, openIncidents] = await Promise.all([
    prisma.monitoringWebsite.findMany({
      where: { monitoringEnabled: true },
      include: {
        checks: { orderBy: { checkedAt: "desc" }, take: 1 },
        incidents: { where: { resolved: false } },
      },
    }),
    prisma.monitoringCheck.findMany({
      orderBy: { checkedAt: "desc" },
      take: 200,
    }),
    prisma.monitoringIncident.count({ where: { resolved: false } }),
  ]);

  let healthyCount = 0;
  let warningCount = 0;
  let criticalCount = 0;
  let unknownCount = 0;
  let totalResponseTime = 0;
  let responseTimeCount = 0;

  for (const site of websites) {
    const latestCheck = site.checks[0];
    const openCount = site.incidents.length;

    if (!latestCheck) {
      unknownCount++;
    } else if (openCount > 0) {
      criticalCount++;
    } else if (
      latestCheck.homepageStatus &&
      latestCheck.homepageStatus >= 500
    ) {
      criticalCount++;
    } else if (
      latestCheck.responseTime &&
      latestCheck.responseTime > 3000
    ) {
      warningCount++;
    } else {
      healthyCount++;
    }

    if (latestCheck?.responseTime) {
      totalResponseTime += latestCheck.responseTime;
      responseTimeCount++;
    }
  }

  return {
    healthyCount,
    warningCount,
    criticalCount,
    unknownCount,
    totalCount: websites.length,
    avgResponseTime:
      responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : null,
    openIncidents,
  };
}
