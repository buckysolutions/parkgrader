"use client";

import Image from "next/image";
import { Faq3 } from "@/components/faq3";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Lottie from "lottie-react";
import starLoaderAnimation from "@/public/star-loader.json";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  DevicePhoneMobileIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";

type IndustryKey = "campground" | "marina" | "glamping" | "cabins";
type AppStep = "landing" | "questions" | "partial" | "report";
type CheckCategory =
  | "Would a Guest Book Here?"
  | "Can a Guest Find Basic Info?"
  | "Will Google Send Guests?";
type CheckStatus = "pass" | "fail";

type ScanCheck = {
  id: string;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  pass: boolean;
  evidence: string;
  finding: string;
  details: string;
  steps: string[];
  weight: number;
  impact: "High" | "Medium" | "Low";
};

type ScanResponse = {
  url: string;
  pageSpeedReportUrl?: string;
  industry: IndustryKey;
  industryLabel: string;
  unitLabel: string;
  score: number;
  status: "Industry Leader" | "Above Average" | "Needs Attention" | "At Risk" | "Critical";
  detectedPlatform: string | null;
  placesError?: string | null;
  pagespeedError?: string | null;
  topFails: string[];
  categories: Array<{
    name: CheckCategory;
    score: number;
    passed: number;
    total: number;
    categoryWeight: number;
  }>;
  checks: ScanCheck[];
  previousScanResult?: ScanResponse | null;
};

type HubSpotContactOption = {
  id: string;
  email: string;
  name: string;
  company: string;
  website: string;
};

type Answers = {
  booking_platform?: string;
  primary_challenge?: string;
};

type ReportSnapshot = {
  reportId: string;
  reportUrl: string;
  scanResult: ScanResponse;
  previousScanResult?: ScanResponse | null;
  answers: Answers;
  name: string;
  propertyName: string;
  email: string;
  emailConfirmation: string;
  savedAt: string;
  demoMode: DemoMode;
};

type SaveAuditSessionOptions = {
  nameOverride?: string;
  phoneOverride?: string;
  leadIntent?: string;
};

type DemoMode = null | "needs-work" | "good";

const PARKGRADER_LOGO = "https://assets.buckysolutions.com/parkgrader_logo.svg";

const BOOKING_PLATFORM_OPTIONS = [
  { value: "campspot", label: "Campspot" },
  { value: "newbook", label: "NewBook" },
  { value: "roverpass", label: "RoverPass" },
  { value: "resnexus", label: "ResNexus" },
  { value: "other", label: "Other" },
  { value: "no-online-booking", label: "We don't have online booking yet" },
];

const CHALLENGE_OPTIONS = [
  { value: "not-enough-bookings", label: "Not enough bookings coming in" },
  { value: "too-many-calls", label: "Too many calls asking basic questions" },
  { value: "bad-reviews", label: "Bad reviews hurting us" },
  { value: "wrong-expectations", label: "Guests showing up with wrong expectations" },
  { value: "website-outdated", label: "Our website feels outdated" },
];

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>;

const CATEGORY_ICON_BY_CHECK_CATEGORY: Record<CheckCategory, HeroIcon> = {
  "Would a Guest Book Here?": CalendarDaysIcon,
  "Can a Guest Find Basic Info?": MagnifyingGlassIcon,
  "Will Google Send Guests?": GlobeAltIcon,
};

const CHECK_ICON_BY_ID: Record<string, HeroIcon> = {
  "online-booking": CalendarDaysIcon,
  "nightly-rates": TagIcon,
  "cancellation": DocumentTextIcon,
  "pagespeed-mobile": DevicePhoneMobileIcon,
  "mobile-viewport": DevicePhoneMobileIcon,
  "tap-to-call": PhoneIcon,
  "google-rating": StarIcon,
  "gbp-reviews": ChatBubbleLeftRightIcon,
  "ssl-https": ShieldCheckIcon,
  "meta-description": DocumentTextIcon,
};


const normalizeUrl = (raw: string): string => {
  const value = raw.trim();
  if (!value) {
    return "";
  }

  try {
    const parsed = value.startsWith("http://") || value.startsWith("https://")
      ? new URL(value)
      : new URL(`https://${value}`);
    const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (!hostname) {
      return "";
    }
    return hostname;
  } catch {
    const fallback = value
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      .split(":")[0]
      .trim()
      .toLowerCase();
    return fallback;
  }
};

const formatDisplayUrl = (raw: string): string => {
  return normalizeUrl(raw);
};

const hasEnabledQueryFlag = (params: URLSearchParams, key: string): boolean => {
  const value = params.get(key);
  if (value === null) {
    return false;
  }

  return value === "" || value === "true" || value === "1";
};

const formatPhoneInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const INTERNAL_TEST_DOMAIN = "buckysolutions.com";

const isInternalTestDomain = (raw: string): boolean => {
  return formatDisplayUrl(raw).toLowerCase() === INTERNAL_TEST_DOMAIN;
};

const isInternalTestEmail = (raw: string): boolean => {
  return raw.trim().toLowerCase().endsWith(`@${INTERNAL_TEST_DOMAIN}`);
};

const makeReportId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const scoreToLetterGrade = (score: number): string => {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "F";
};

const trackEvent = (name: string, params?: Record<string, string | number | boolean>) => {
  if (typeof window !== "undefined" && (window as unknown as { gtag?: Function }).gtag) {
    (window as unknown as { gtag: Function }).gtag("event", name, params ?? {});
  }
};

const getReportIdFromPathname = (pathname: string): string => {
  const match = pathname.match(/^\/r\/([^/]+)$/);
  if (!match) {
    return "";
  }

  try {
    return decodeURIComponent(match[1] ?? "").trim();
  } catch {
    return (match[1] ?? "").trim();
  }
};

function PolicyFooter({ fixed }: { fixed?: boolean }) {
  return (
    <footer
      className={`${fixed ? "fixed" : "relative"} bottom-4 left-1/2 z-20 -translate-x-1/2 text-xs text-[#A7BCCF] print-hidden`}
    >
      <div className="flex items-center gap-2 whitespace-nowrap px-1 py-1">
        <a className="transition-colors hover:text-[#5B6776]" href="/privacy-policy">
          Privacy Policy
        </a>
        <span>·</span>
        <a className="transition-colors hover:text-[#5B6776]" href="/cookie-policy">
          Cookie Policy
        </a>
        <span>·</span>
        <a className="transition-colors hover:text-[#5B6776]" href="/terms">
          Terms of Service
        </a>
        <span>·</span>
        <a className="transition-colors hover:text-[#5B6776]" href="/monitoring-policy">
          Monitoring Policy
        </a>
      </div>
    </footer>
  );
}

function TopographicPanel({ mode = "default" }: { mode?: "default" | "report" }) {
  if (mode === "report") {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fcfc_0%,#e6f5f4_44%,#eef7fb_100%)] sm:hidden" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(180deg,#f8fcfc_0%,#e3f4f2_40%,#eaf4fa_72%,#f6f1ea_100%)] sm:block lg:hidden" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(145deg,#f3fbfa_0%,#ddf3f1_34%,#e4effa_68%,#f7eee2_100%)] lg:block" />

        <div className="absolute -left-32 top-16 h-[360px] w-[360px] rounded-full bg-[#54a2a7]/20 blur-[115px]" />
        <div className="absolute right-[-180px] top-[20%] h-[460px] w-[460px] rounded-full bg-[#00a9ba]/22 blur-[125px]" />
        <div className="absolute bottom-[-180px] left-1/2 h-[460px] w-[680px] -translate-x-1/2 rounded-full bg-[#5abf7e]/20 blur-[135px]" />
        <div className="absolute -right-20 top-[8%] h-[260px] w-[260px] rounded-full bg-[#ff8a44]/14 blur-[110px]" />
        <div className="absolute -left-16 bottom-[12%] h-[240px] w-[240px] rounded-full bg-[#7cc7ff]/12 blur-[105px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.18)_42%,rgba(255,255,255,0.34)_100%)]" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Mobile: subtle gradient */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f7fbfb_0%,#f0f7f6_50%,#f8f9f7_100%)] sm:hidden" />
      <div className="absolute sm:hidden -left-16 top-12 h-[200px] w-[200px] rounded-full bg-[#54a2a7]/8 blur-[80px]" />
      <div className="absolute sm:hidden right-[-80px] top-[30%] h-[200px] w-[200px] rounded-full bg-[#00a9ba]/6 blur-[90px]" />

      {/* Tablet: restrained ambient wash */}
      <div className="absolute inset-0 hidden bg-[linear-gradient(180deg,#f7fbfb_0%,#eef8f6_48%,#f7f8f6_100%)] sm:block lg:hidden" />
      <div className="absolute hidden sm:block lg:hidden -left-24 top-8 h-[260px] w-[260px] rounded-full bg-[#54a2a7]/10 blur-[90px]" />
      <div className="absolute hidden sm:block lg:hidden right-[-120px] top-[22%] h-[280px] w-[280px] rounded-full bg-[#00a9ba]/10 blur-[100px]" />
      <div className="absolute hidden sm:block lg:hidden bottom-[-120px] left-1/2 h-[260px] w-[460px] -translate-x-1/2 rounded-full bg-[#5abf7e]/10 blur-[110px]" />
      <div className="absolute hidden sm:block lg:hidden inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.26)_45%,rgba(255,255,255,0.42)_100%)]" />

      {/* Desktop: richer multi-color gradient */}
      <div className="absolute inset-0 hidden bg-[linear-gradient(135deg,#f0f9f8_0%,#e9fdfe_25%,#e6f4f1_50%,#f5f0e8_75%,#fef8f0_100%)] lg:block" />
      <div className="absolute hidden lg:block -left-24 top-16 h-[380px] w-[380px] rounded-full bg-[#54a2a7]/18 blur-[90px]" />
      <div className="absolute hidden lg:block right-[-140px] top-[22%] h-[460px] w-[460px] rounded-full bg-[#00a9ba]/28 blur-[110px]" />
      <div className="absolute hidden lg:block bottom-[-160px] left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-[#5abf7e]/35 blur-[120px]" />
      <div className="absolute hidden lg:block -top-16 -right-32 h-[320px] w-[320px] rounded-full bg-[#ff8a44]/22 blur-[100px]" />
      <div className="absolute hidden lg:block -bottom-24 -left-32 h-[360px] w-[360px] rounded-full bg-[#005056]/10 blur-[110px]" />
      <div className="absolute hidden lg:block top-1/3 right-1/4 h-[280px] w-[280px] rounded-full bg-[#befcff]/20 blur-[90px]" />
      <div className="absolute hidden lg:block inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.20)_40%,rgba(255,255,255,0.38)_100%)]" />
    </div>
  );
}

const CHECK_DISPLAY_LABEL_BY_ID: Record<string, string> = {
  "online-booking": "Online Booking",
  "nightly-rates": "Rates Upfront",
  "cancellation": "Cancellation Policy",
  "pagespeed-mobile": "Mobile Speed",
  "mobile-viewport": "Mobile Design",
  "tap-to-call": "Tap-to-Call",
  "google-rating": "Google Rating",
  "gbp-reviews": "Google Reviews",
  "ssl-https": "SSL",
  "meta-description": "Meta Description",
};

const getCheckDisplayLabel = (check?: ScanCheck | null): string => {
  if (!check) {
    return "";
  }

  return CHECK_DISPLAY_LABEL_BY_ID[check.id] ?? check.name;
};

const humanizeEvidence = (check: ScanCheck): string | null => {
  const raw = (check.evidence ?? "").trim();
  if (!raw) return null;

  // Already human-readable  -  strip a leading "Found: " / "Score: " prefix and keep it
  const cleaned = raw
    .replace(/^Evidence:\s*/i, "")
    .replace(/^Detected:\s*/i, "")
    .trim();

  if (!cleaned) return null;

  // URLs  -  describe what we found rather than paste the URL
  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const url = new URL(cleaned);
      const host = url.hostname.replace(/^www\./, "");
      return `We found this on ${host}`;
    } catch {
      return "We confirmed this during the scan";
    }
  }

  // Numeric scores
  const mobileMatch = cleaned.match(/mobile\s*(?:performance\s*)?score[:\s]*(\d+)/i);
  if (mobileMatch) {
    return `Mobile performance score is ${mobileMatch[1]} out of 100`;
  }

  const pagespeedMatch = cleaned.match(/pagespeed\s*(?:performance\s*)?score[:\s]*(\d+)/i);
  if (pagespeedMatch) {
    return `PageSpeed performance score is ${pagespeedMatch[1]} out of 100`;
  }

  const scoreMatch = cleaned.match(/^(\d{1,3})(?:\/| out of |\s*of\s*)(\d{1,3})/);
  if (scoreMatch) {
    return `Scored ${scoreMatch[1]} out of ${scoreMatch[2]}`;
  }

  // SSL / certificate
  if (/ssl|https|certificate/i.test(cleaned)) {
    return "Your site has a valid security certificate";
  }

  // Null / empty / "null" string  -  never visible
  if (cleaned.toLowerCase() === "null" || cleaned.toLowerCase() === "undefined" || cleaned.length < 2) {
    return null;
  }

  // Return cleaned string as-is  -  it's already plain enough
  return cleaned;
};

function CheckIconComponent({ check, className = "h-4 w-4" }: { check: ScanCheck; className?: string }) {
  const Icon = CHECK_ICON_BY_ID[check.id] ?? CATEGORY_ICON_BY_CHECK_CATEGORY[check.category] ?? SparklesIcon;

  return <Icon className={className} aria-hidden="true" />;
}

export default function Home() {
  const pathname = usePathname();
  const [step, setStep] = useState<AppStep>("landing");
  const [urlInput, setUrlInput] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStepLabel, setScanStepLabel] = useState("");
  const scanLabelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [questionStep, setQuestionStep] = useState(0); // 0 = platform, 1 = challenge
  const [selectedPulse, setSelectedPulse] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [displayScore, setDisplayScore] = useState(0);
  const [name, setName] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [email, setEmail] = useState("");
  const [leadNotice, setLeadNotice] = useState("");
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [reportId, setReportId] = useState("");
  const [copied, setCopied] = useState(false);
  const [demoMode, setDemoMode] = useState<DemoMode>(null);
  const [isTradeshowMode, setIsTradeshowMode] = useState(false);
  const [isWebsiteMode, setIsWebsiteMode] = useState(false);
  const [loomRequested, setLoomRequested] = useState(false);
  const [isReportUnlocked, setIsReportUnlocked] = useState(true);
  const [urlInputShakeCount, setUrlInputShakeCount] = useState(0);
  const [emailInputShakeCount, setEmailInputShakeCount] = useState(0);
  const [hubspotContactId, setHubspotContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactSearchResults, setContactSearchResults] = useState<HubSpotContactOption[]>([]);
  const [isContactSearchOpen, setIsContactSearchOpen] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [selectedContactWebsite, setSelectedContactWebsite] = useState("");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [previousScanResult, setPreviousScanResult] = useState<ScanResponse | null>(null);
  const [isHydratingSharedReport, setIsHydratingSharedReport] = useState(() => Boolean(getReportIdFromPathname(pathname ?? "")));
  const [engagementIssueClicks, setEngagementIssueClicks] = useState(0);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePromptNotice, setSharePromptNotice] = useState("");
  const [isSubmittingSharePrompt, setIsSubmittingSharePrompt] = useState(false);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [hasTriggeredEmailPrompt, setHasTriggeredEmailPrompt] = useState(false);
  const [reportSavedAt, setReportSavedAt] = useState<string>("");
  const [emailPromptMode, setEmailPromptMode] = useState<"email" | "callback">("email");
  const [engagementEmail, setEngagementEmail] = useState("");
  const [engagementPromptNotice, setEngagementPromptNotice] = useState("");
  const [isSubmittingEngagementPrompt, setIsSubmittingEngagementPrompt] = useState(false);
  const [callbackName, setCallbackName] = useState("");
  const [callbackEmail, setCallbackEmail] = useState("");
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackPromptNotice, setCallbackPromptNotice] = useState("");
  const [isSubmittingCallbackPrompt, setIsSubmittingCallbackPrompt] = useState(false);
  const [hasSubmittedEmailGate, setHasSubmittedEmailGate] = useState(false);
  const [inlineGateEmail, setInlineGateEmail] = useState("");
  const [inlineGateNotice, setInlineGateNotice] = useState("");
  const [isSubmittingInlineGate, setIsSubmittingInlineGate] = useState(false);
  const landingInputRef = useRef<HTMLInputElement | null>(null);
  const scanRequestRef = useRef(0);
  const loadingStartRef = useRef<number | null>(null);
  const reportSectionRef = useRef<HTMLDivElement | null>(null);
  const capturedAuditReportsRef = useRef<Set<string>>(new Set());
  const hydratedFromSavedReportRef = useRef(false);
  const trackedSharedReportRef = useRef<Set<string>>(new Set());
  const inlineGateFiredRef = useRef(false);
  const inlineGateRef = useRef<HTMLDivElement | null>(null);
  const saveAuditSessionRef = useRef<((leadEmail?: string, options?: SaveAuditSessionOptions) => Promise<{ stored: boolean; email: string }>) | null>(null);


  const bookingPlatform = answers.booking_platform ?? "";
  const primaryChallenge = answers.primary_challenge ?? "";
  useEffect(() => {
    if (step !== "landing" || isHydratingSharedReport) {
      return;
    }

    const timer = window.setTimeout(() => {
      landingInputRef.current?.focus();
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isHydratingSharedReport, step, isTradeshowMode]);

  const finalScore = scanResult?.score ?? 0;
  const gaugeTargetProgress = Math.max(0, Math.min(finalScore / 100, 1));
  const gaugeColor = finalScore >= 75 ? "#16A34A" : finalScore >= 50 ? "#D97706" : "#DC2626";
  const letterGrade = scoreToLetterGrade(finalScore);
  const displayReportUrl = useMemo(() => formatDisplayUrl(reportUrl), [reportUrl]);

  const shareLink = useMemo(() => {
    if (typeof window === "undefined" || !reportId) {
      return "";
    }
    return `${window.location.origin}/r/${encodeURIComponent(reportId)}`;
  }, [reportId]);

  const shareMessage = useMemo(() => {
    const scoreText = `Grade ${letterGrade}`;
    const urlText = reportUrl || "your property";
    return `My ParkGrader audit for ${urlText}: ${scoreText}. ${shareLink}`;
  }, [letterGrade, reportUrl, shareLink]);

  const syncReportPath = useCallback((nextReportId: string) => {
    if (typeof window === "undefined") {
      return;
    }
    const pagePath = `/r/${encodeURIComponent(nextReportId)}`;
    window.history.replaceState({}, "", pagePath);
    // GA4 doesn't auto-track replaceState — manually fire a virtual page_view
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
    const gtag = (window as unknown as { gtag?: Function }).gtag;
    if (measurementId && gtag) {
      gtag("config", measurementId, { page_path: pagePath, page_title: document.title });
    }
  }, []);

  const resetToLandingPage = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.history.replaceState({}, "", "/");
    window.location.reload();
  }, []);

  const saveAuditSession = useCallback(
    async (leadEmail?: string, options?: SaveAuditSessionOptions) => {
      if (!reportUrl || !scanResult) {
        throw new Error("Missing report details.");
      }

      const nextReportId = reportId || makeReportId();
      if (!reportId) {
        setReportId(nextReportId);
      }
      syncReportPath(nextReportId);

      const normalizedEmail = (leadEmail ?? email).trim().toLowerCase();
      const normalizedName = (options?.nameOverride ?? name).trim();
      const normalizedPhone = (options?.phoneOverride ?? "").trim();
      const savedAt = new Date().toISOString();
      const reportSnapshotPayload: ReportSnapshot = {
        reportId: nextReportId,
        reportUrl,
        scanResult,
        previousScanResult: previousScanResult || undefined,
        answers,
        name: normalizedName,
        propertyName,
        email: normalizedEmail,
        emailConfirmation,
        savedAt,
        demoMode,
      };

      const payload = {
        email: normalizedEmail || undefined,
        name: normalizedName,
        phone: normalizedPhone || undefined,
        property_name: propertyName,
        url: reportUrl,
        score: scanResult.score ?? 0,
        booking_platform: bookingPlatform,
        primary_challenge: primaryChallenge,
        scan_date: savedAt,
        report_id: nextReportId,
        report_snapshot: reportSnapshotPayload,
        lead_intent: options?.leadIntent || undefined,
        hubspot_contact_id: hubspotContactId || undefined,
        loom_requested: loomRequested || undefined,
      };

      let leadEndpoint = "/api/lead";
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const bypassEnabled = hasEnabledQueryFlag(params, "bypass");
        const key = (params.get("tsk") ?? "").trim();

        if (bypassEnabled && key) {
          leadEndpoint = `/api/lead?bypass=true&key=${encodeURIComponent(key)}`;
        }
      }

      const response = await fetch(leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        stored?: boolean;
        message?: string;
        supabase_error?: string;
      };
      if (!response.ok) {
        throw new Error(result.supabase_error || result.message || "Unable to save lead.");
      }

      return {
        stored: Boolean(result.stored),
        email: normalizedEmail,
      };
    },
    [
      answers,
      demoMode,
      email,
      emailConfirmation,
      hubspotContactId,
      isTradeshowMode,
      name,
      previousScanResult,
      propertyName,
      reportId,
      reportUrl,
      scanResult,
      bookingPlatform,
      primaryChallenge,
      syncReportPath,
      loomRequested,
    ],
  );

  saveAuditSessionRef.current = saveAuditSession;

  const runScan = useCallback(async (site: string, industry: IndustryKey) => {
    scanRequestRef.current += 1;
    const requestId = scanRequestRef.current;
    setIsScanning(true);
    setScanError("");
    setScanStepLabel("Fetching your website…");
    if (scanLabelIntervalRef.current) clearInterval(scanLabelIntervalRef.current);
    const labels = [
      "Fetching your website…",
      "Analyzing your booking flow…",
      "Checking mobile experience…",
      "Scanning for key details…",
      "Looking up Google presence…",
      "Calculating your score…",
    ];
    let labelIndex = 0;
    scanLabelIntervalRef.current = setInterval(() => {
      labelIndex = (labelIndex + 1) % labels.length;
      setScanStepLabel(labels[labelIndex]);
    }, 2200);
    // Clear interval after 60s
    const maxTimeout = setTimeout(() => {
      if (scanLabelIntervalRef.current) {
        clearInterval(scanLabelIntervalRef.current);
        scanLabelIntervalRef.current = null;
        setScanStepLabel("Finishing up…");
      }
    }, 60000);
    try {
      const params = new URLSearchParams({
        url: site,
        industry,
        booking_platform: bookingPlatform,
        primary_challenge: primaryChallenge,
      });
      const response = await fetch(`/api/scan?${params.toString()}`);
      const payload = (await response.json()) as ScanResponse | { message: string };
      if (!response.ok || !("checks" in payload)) {
        throw new Error("message" in payload ? payload.message : "Scan failed");
      }
      if (requestId !== scanRequestRef.current) {
        return;
      }
      setPreviousScanResult(payload.previousScanResult ?? scanResult);
      setScanResult(payload);
      setReportUrl(payload.url);
      trackEvent("audit_completed", { score: payload.score, grade: scoreToLetterGrade(payload.score), url: payload.url });
    } catch (error) {
      if (requestId !== scanRequestRef.current) {
        return;
      }
      setScanError(error instanceof Error ? error.message : "Unable to complete scan.");
      setStep("landing");
    } finally {
      if (requestId === scanRequestRef.current) {
        setIsScanning(false);
        if (scanLabelIntervalRef.current) {
          clearInterval(scanLabelIntervalRef.current);
          scanLabelIntervalRef.current = null;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingPlatform, primaryChallenge, scanResult]);

  const handleRescan = useCallback(() => {
    if (!reportUrl || isScanning || !scanResult) {
      return;
    }
    setStep("partial");
    loadingStartRef.current = Date.now();
    void runScan(reportUrl, scanResult.industry);
  }, [isScanning, reportUrl, runScan, scanResult]);

  useEffect(() => {
    if (!isTradeshowMode || step !== "landing" || !isContactSearchOpen) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoadingContacts(true);
      try {
        const query = contactSearch.trim();
        const response = await fetch(`/api/hubspot-contacts?q=${encodeURIComponent(query)}&limit=20`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setContactSearchResults([]);
          return;
        }
        const payload = (await response.json()) as { contacts?: HubSpotContactOption[] };
        setContactSearchResults(payload.contacts ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setContactSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingContacts(false);
        }
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [contactSearch, isContactSearchOpen, isTradeshowMode, step]);

  const beginAssessment = async () => {
    const normalized = normalizeUrl(isTradeshowMode ? selectedContactWebsite : urlInput);
    if (!normalized) {
      setScanError(isTradeshowMode ? "Select a contact with a website URL." : "Please enter your URL.");
        setUrlInputShakeCount((value) => value + 1);
      return;
    }

    if (isTradeshowMode && !hubspotContactId) {
      setScanError("Select a contact from lookup to continue.");
      setUrlInputShakeCount((value) => value + 1);
      return;
    }

    setAnswers({});
    setQuestionStep(0);
    setScanResult(null);
    setLeadNotice("");
    setEmailConfirmation("");
    setCopied(false);
    setReportId("");
    setDisplayScore(0);
    setContactSearch("");
    setContactSearchResults([]);
    setIsContactSearchOpen(false);
    setSelectedContactWebsite("");
    setExpandedCardId(null);
    setEngagementIssueClicks(0);
    setIsReportUnlocked(true);
    setShowEmailPrompt(false);
    setHasTriggeredEmailPrompt(false);
    setHasSubmittedEmailGate(false);
    setInlineGateEmail("");
    setInlineGateNotice("");
    inlineGateFiredRef.current = false;
    hydratedFromSavedReportRef.current = false;
    loadingStartRef.current = null;
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
    }
    setReportUrl(normalized);
    trackEvent("audit_started", { url: normalized });
    if (isTradeshowMode) {
      setStep("partial");
      void runScan(normalized, "campground");
      return;
    }
    setStep("questions");
  };

  const selectQuestionAnswer = (field: "booking_platform" | "primary_challenge", value: string) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
    setSelectedPulse(`${field}-${value}`);
    window.setTimeout(() => {
      setSelectedPulse("");
      if (field === "booking_platform") {
        setQuestionStep(1);
      } else {
        setStep("partial");
        void runScan(reportUrl, "campground");
      }
    }, 350);
  };

  const hydrateSnapshot = useCallback((snapshot: ReportSnapshot, supabaseEmail?: string | null) => {
    hydratedFromSavedReportRef.current = true;
    setReportId(snapshot.reportId);
    setReportUrl(snapshot.reportUrl);
    setScanResult(snapshot.scanResult);
    setPreviousScanResult(snapshot.previousScanResult ?? null);
    setAnswers(snapshot.answers);
    setName(snapshot.name);
    setPropertyName(snapshot.propertyName);
    setEmail(snapshot.email);
    setEmailConfirmation(snapshot.emailConfirmation);
    setDemoMode(snapshot.demoMode);
    setReportSavedAt(snapshot.savedAt ?? "");
    setIsReportUnlocked(true);
    setShowEmailPrompt(false);
    setHasTriggeredEmailPrompt(Boolean(snapshot.email) || Boolean(snapshot.demoMode));
    setEngagementIssueClicks(0);
    // Supabase email column is the single source of truth for gate state.
    // If email exists in Supabase, this report was previously unlocked.
    // If null, the gate must persist across all reloads until email is submitted.
    setHasSubmittedEmailGate(Boolean(supabaseEmail));
    setInlineGateEmail(supabaseEmail ?? "");
    syncReportPath(snapshot.reportId);
    setStep("report");
    if (!trackedSharedReportRef.current.has(snapshot.reportId)) {
      trackedSharedReportRef.current.add(snapshot.reportId);
      trackEvent("shared_report_viewed", { report_id: snapshot.reportId });
    }
  }, [isTradeshowMode, syncReportPath]);

  useEffect(() => {
    let cancelled = false;

    const validateTradeshowAccess = async () => {
      const params = new URLSearchParams(window.location.search);
      setIsWebsiteMode(hasEnabledQueryFlag(params, "website"));

      if (hasEnabledQueryFlag(params, "loom")) {
        setLoomRequested(true);
      }

      if (!hasEnabledQueryFlag(params, "tradeshow")) {
        return;
      }

      const key = params.get("tsk") ?? "";

      try {
        const response = await fetch(`/api/tradeshow-access?key=${encodeURIComponent(key)}`);
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { enabled?: boolean };
        if (!cancelled && payload.enabled) {
          setIsTradeshowMode(true);
          setIsReportUnlocked(true);
        }
      } catch {
        // Keep default locked behavior when validation fails.
      }
    };

    void validateTradeshowAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const demoParam = params.get("demo");
    const reportIdFromPath = getReportIdFromPathname(pathname ?? "");

    const hydrateFromPath = async () => {
      if (!reportIdFromPath) {
        if (!cancelled) {
          setIsHydratingSharedReport(false);
        }
        return;
      }

      try {
        const response = await fetch(`/api/report/${encodeURIComponent(reportIdFromPath)}`);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { snapshot?: ReportSnapshot; email?: string | null };
        if (!cancelled && payload.snapshot) {
          hydrateSnapshot(payload.snapshot, payload.email ?? null);
        }
      } catch {
        // Keep landing state when shared report lookup fails.
      } finally {
        if (!cancelled) {
          setIsHydratingSharedReport(false);
        }
      }
    };

    void hydrateFromPath();

    if (demoParam === "true" || demoParam === "good") {
      // Demo requires a real scan  -  skip demo mode if no scan result available.
      setIsHydratingSharedReport(false);
    }

    return () => {
      cancelled = true;
    };
  }, [hydrateSnapshot, pathname]);

  useEffect(() => {
    if (step !== "partial") {
      return;
    }

    if (loadingStartRef.current === null) {
      loadingStartRef.current = Date.now();
    }

    if (isScanning || !scanResult) {
      return;
    }

    const elapsed = Date.now() - loadingStartRef.current;
    const minDelay = 2200;
    const timeout = window.setTimeout(
      () => {
        const nextReportId = reportId || makeReportId();
        if (!reportId) {
          setReportId(nextReportId);
        }
        syncReportPath(nextReportId);
        setIsReportUnlocked(true);
        setReportSavedAt(new Date().toISOString());
        setStep("report");
      },
      Math.max(0, minDelay - elapsed),
    );

    return () => window.clearTimeout(timeout);
  }, [demoMode, isScanning, isTradeshowMode, reportId, reportUrl, scanResult, step, syncReportPath]);

  useEffect(() => {
    if (step !== "report" || !reportId || !reportUrl || !scanResult || demoMode) {
      return;
    }

    if (hydratedFromSavedReportRef.current) {
      return;
    }

    if (capturedAuditReportsRef.current.has(reportId)) {
      return;
    }

    capturedAuditReportsRef.current.add(reportId);

    void (async () => {
      try {
        await saveAuditSession(undefined);
      } catch (error) {
        capturedAuditReportsRef.current.delete(reportId);
        console.error("ParkGrader audit capture failed", error);
      }
    })();
  }, [demoMode, reportId, reportUrl, saveAuditSession, scanResult, step]);

  // Fire email_gate_shown when inline gate scrolls into view (Bug 1 fix)
  useEffect(() => {
    if (step !== "report" || isTradeshowMode || hasSubmittedEmailGate) {
      return;
    }
    const gateEl = inlineGateRef.current;
    if (!gateEl || inlineGateFiredRef.current) {
      return;
    }
    // Small delay so the DOM has settled after the step transition
    const timer = window.setTimeout(() => {
      if (inlineGateFiredRef.current) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && !inlineGateFiredRef.current) {
            inlineGateFiredRef.current = true;
            trackEvent("email_gate_shown", { trigger: "scroll", report_id: reportId });
            observer.disconnect();
          }
        },
        { threshold: 0.1 },
      );
      observer.observe(inlineGateRef.current!);
    }, 500);
    return () => {
      clearTimeout(timer);
      // observer.disconnect() is handled inside the callback
    };
  }, [hasSubmittedEmailGate, isTradeshowMode, reportId, step]);

  useEffect(() => {
    if (step !== "report") {
      return;
    }
    const targetScore = scanResult?.score ?? 0;
    const durationMs = 950;
    const startedAt = performance.now();
    let raf = 0;

    setDisplayScore(0);

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(targetScore * eased));

      if (progress < 1) {
        raf = window.requestAnimationFrame(tick);
      } else {
        setDisplayScore(targetScore);
      }
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [scanResult?.score, step]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const toggleChatWidget = () => {
      const hs = (window as unknown as {
        HubSpotConversations?: { widget?: { load?: () => void; remove?: () => void } };
      }).HubSpotConversations;
      const widget = hs?.widget;
      if (!widget) {
        return;
      }

      if (step === "report") {
        widget.load?.();
      } else {
        widget.remove?.();
      }
    };

    // Try immediately and once again shortly after script hydration.
    toggleChatWidget();
    const retry = window.setTimeout(toggleChatWidget, 500);
    return () => window.clearTimeout(retry);
  }, [step]);

  const openSharePrompt = useCallback(() => {
    setShareEmail(email);
    setSharePromptNotice("");
    setShowSharePrompt(true);
  }, [email]);

  const openEngagementPrompt = useCallback(() => {
    setEmailPromptMode("email");
    setEngagementEmail(email);
    setEngagementPromptNotice("");
    setShowEmailPrompt(true);
    trackEvent("email_gate_shown", { trigger: (window as unknown as { __emailGateTrigger?: string }).__emailGateTrigger || "scroll", report_id: reportId });
  }, [email]);

  const openCallbackPromptStep = useCallback(() => {
    setEmailPromptMode("callback");
    setCallbackName(name);
    setCallbackEmail(email || engagementEmail);
    setCallbackPhone("");
    setCallbackPromptNotice("");
  }, [email, engagementEmail, name]);

  const submitSharePrompt = async () => {
    const normalizedEmail = shareEmail.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail) {
      setSharePromptNotice("Please enter an email address.");
      return;
    }

    if (!emailPattern.test(normalizedEmail)) {
      setSharePromptNotice("Please enter a valid email address.");
      return;
    }

    setIsSubmittingSharePrompt(true);
    setSharePromptNotice("");

    try {
      const result = await saveAuditSession(normalizedEmail, { leadIntent: "share-report" });
      setEmail(normalizedEmail);
      setEmailConfirmation(
        isInternalTestEmail(normalizedEmail)
          ? `Test mode is on for ${normalizedEmail}.`
          : `We saved your report for ${normalizedEmail}. Use the share link below.`,
      );
      setShowSharePrompt(false);
      await copyShareLink();
    } catch (error) {
      setSharePromptNotice(error instanceof Error ? error.message : "Unable to send report.");
    } finally {
      setIsSubmittingSharePrompt(false);
    }
  };

  const submitEngagementPrompt = async () => {
    const normalizedEmail = engagementEmail.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail) {
      setEngagementPromptNotice("Please enter your email address.");
      return;
    }

    if (!emailPattern.test(normalizedEmail)) {
      setEngagementPromptNotice("Please enter a valid email address.");
      return;
    }

    setIsSubmittingEngagementPrompt(true);
    setEngagementPromptNotice("");

    try {
      const result = await saveAuditSession(normalizedEmail, { leadIntent: "engagement-email" });
      setEmail(normalizedEmail);
      setEmailConfirmation(
        isInternalTestEmail(normalizedEmail)
          ? `Test mode is on for ${normalizedEmail}.`
          : `We saved your report for ${normalizedEmail}. Use the share link below.`,
      );
      setShowEmailPrompt(false);
      trackEvent("email_submitted", { intent: "email_report", report_id: reportId });
    } catch (error) {
      setEngagementPromptNotice(error instanceof Error ? error.message : "Unable to send report.");
    } finally {
      setIsSubmittingEngagementPrompt(false);
    }
  };

  const submitCallbackPrompt = async () => {
    const normalizedName = callbackName.trim();
    const normalizedEmail = callbackEmail.trim().toLowerCase();
    const normalizedPhone = callbackPhone.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneDigits = normalizedPhone.replace(/\D/g, "");

    if (!normalizedName) {
      setCallbackPromptNotice("Please enter your name.");
      return;
    }

    if (!normalizedEmail) {
      setCallbackPromptNotice("Please enter your email address.");
      return;
    }

    if (!emailPattern.test(normalizedEmail)) {
      setCallbackPromptNotice("Please enter a valid email address.");
      return;
    }

    if (phoneDigits.length < 10) {
      setCallbackPromptNotice("Please enter a valid phone number.");
      return;
    }

    setIsSubmittingCallbackPrompt(true);
    setCallbackPromptNotice("");

    try {
      await saveAuditSession(normalizedEmail, {
        nameOverride: normalizedName,
        phoneOverride: normalizedPhone,
        leadIntent: "callback-request",
      });
      setName(normalizedName);
      setEmail(normalizedEmail);
      setShowEmailPrompt(false);
      setEmailConfirmation("Thanks. We'll pull up your site before we call.");
      trackEvent("callback_requested", {});
    } catch (error) {
      setCallbackPromptNotice(error instanceof Error ? error.message : "Unable to send your request.");
    } finally {
      setIsSubmittingCallbackPrompt(false);
    }
  };

  const submitLead = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail || !reportUrl) {
      setLeadNotice("Please enter your email address.");
      setEmailInputShakeCount((value) => value + 1);
      return;
    }

    if (!emailPattern.test(normalizedEmail)) {
      setLeadNotice("Please enter a valid email address.");
      setEmailInputShakeCount((value) => value + 1);
      return;
    }

    setEmail(normalizedEmail);
    setIsSubmittingLead(true);
    setLeadNotice("");
    const nextReportId = reportId || makeReportId();
    if (!reportId) {
      setReportId(nextReportId);
    }
    syncReportPath(nextReportId);

    try {
      const result = await saveAuditSession(normalizedEmail);
      console.log("ParkGrader report saved for", normalizedEmail);
      setEmailConfirmation(
        isInternalTestEmail(normalizedEmail)
          ? `Test mode is on for ${normalizedEmail}.`
          : `We saved your report for ${normalizedEmail}. Use the share link below.`,
      );
      setLeadNotice(
        result.stored
          ? "Your details were saved successfully."
          : "Lead capture is connected, but HubSpot credentials are not configured yet.",
      );
      setIsReportUnlocked(true);
      setShowEmailPrompt(false);
      setStep("report");
    } catch (error) {
      console.log("ParkGrader report saved for", normalizedEmail);
      setEmailConfirmation(
        isInternalTestEmail(normalizedEmail)
          ? `Test mode is on for ${normalizedEmail}.`
          : `We saved your report for ${normalizedEmail}.`,
      );
      setLeadNotice(error instanceof Error ? error.message : "Lead capture failed.");
      setIsReportUnlocked(true);
      setShowEmailPrompt(false);
      setStep("report");
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const submitInlineGate = async () => {
    const normalizedEmail = inlineGateEmail.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail) {
      setInlineGateNotice("Please enter your email address.");
      return;
    }

    if (!emailPattern.test(normalizedEmail)) {
      setInlineGateNotice("Please enter a valid email address.");
      return;
    }

    setIsSubmittingInlineGate(true);
    setInlineGateNotice("");

    try {
      const result = await saveAuditSession(normalizedEmail, { leadIntent: "inline_gate" });
      setEmail(normalizedEmail);
      setHasSubmittedEmailGate(true);
      trackEvent("email_submitted", { method: "inline_gate", report_id: reportId });
    } catch (error) {
      setInlineGateNotice(error instanceof Error ? error.message : "Unable to save. Please try again.");
    } finally {
      setIsSubmittingInlineGate(false);
    }
  };

  const copyShareLink = useCallback(async () => {
    if (!shareLink) {
      return;
    }
    await navigator.clipboard.writeText(shareLink);
    trackEvent("share_link_copied", {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [shareLink]);

  const toggleCardExpanded = useCallback((checkId: string) => {
    setExpandedCardId((current) => (current === checkId ? null : checkId));
  }, []);

  const isDebug = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return hasEnabledQueryFlag(params, "debug");
  }, []);

  const visibleChecks = useMemo(() => {
    if (!scanResult) return [];
    return [...scanResult.checks].sort((a, b) => b.weight - a.weight);
  }, [scanResult]);

  const failingChecks = useMemo(() => {
    if (!scanResult) return [];
    return visibleChecks.filter((c) => c.status === "fail");
  }, [visibleChecks]);

  const reportSummary = useMemo(() => {
    if (!scanResult) return { total: 0, needWork: 0 };
    const all = scanResult.checks;
    const needWork = all.filter((c) => c.status === "fail").length;
    return { total: all.length, needWork };
  }, [scanResult]);

  return (
    <main className="relative min-h-screen bg-[#F8FAFC] text-[#0A1628]">
      {demoMode ? (
        <div className="print-hidden fixed right-4 top-4 z-30 flex items-center gap-3 rounded-full bg-[#0A1628] px-4 py-2 text-xs text-white">
          <span>DEMO MODE</span>
          <button
            onClick={() => {
              window.location.href = window.location.pathname;
            }}
            className="rounded-full bg-white/10 px-3 py-1"
          >
            Reset Demo
          </button>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {isHydratingSharedReport && step === "landing" && (
            <motion.section
              key="hydrating"
              className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8FAFC] px-6 pb-24 pt-10 sm:px-10 sm:pt-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <TopographicPanel />
              <div className="relative z-10 text-center">
                <p className="text-xs uppercase tracking-[0.12em] text-[#5B6776]">Loading report</p>
                <p className="mt-2 text-base text-[#0A1628]">Please wait a moment...</p>
              </div>
            </motion.section>
        )}

        {step === "landing" && !isHydratingSharedReport && (
          <motion.section
            key="landing"
            className="relative overflow-hidden bg-[#F8FAFC]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <TopographicPanel />

            {!isWebsiteMode ? (
              <div className="pointer-events-none absolute left-0 right-0 top-6 z-20 flex justify-center lg:left-10 lg:right-auto lg:top-8 lg:block">
                <Image
                  src={PARKGRADER_LOGO}
                  alt="ParkGrader"
                  width={181}
                  height={32}
                  className="h-7 w-auto"
                />
              </div>
            ) : null}

            <motion.div
              className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-4 lg:min-h-screen lg:flex-row lg:items-end lg:px-12 lg:gap-16"
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mx-auto max-w-[52rem] px-3 pt-24 pb-6 sm:px-6 sm:pt-28 sm:pb-8 lg:mx-0 lg:max-w-xl lg:self-center lg:pt-6 lg:pb-8">
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                  <p className="flex items-center justify-center gap-1.5 text-sm text-[#8C97A8] lg:justify-start">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#8c97a8" viewBox="0 0 256 256"><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"></path></svg>
                    Join 500+ campground owners
                  </p>
                  <h1 className="mt-2 text-[1.75rem] leading-[1.1] text-[#0A1628] sm:text-[2.4rem]">
                    Is your campground website costing you bookings?
                  </h1>
                  <p className="mt-4 max-w-[52ch] text-lg leading-7 text-[#5B6776] sm:text-xl sm:leading-8">
                    Enter your website address below. We&apos;ll scan it in 60 seconds and show you exactly what&apos;s turning guests away.
                  </p>
                </div>
                <div className="relative z-20 mx-auto mt-9 w-full max-w-[34ch] lg:mx-0 lg:max-w-none">
                  <div className="text-left">
                    <label className="mb-2 block text-center text-xs font-medium tracking-wide text-[#5B6776] uppercase lg:text-left">Enter your park website</label>
                    <motion.div
                      animate={urlInputShakeCount > 0 ? { x: [0, -10, 10, -7, 7, -3, 3, 0] } : { x: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      {isTradeshowMode ? (
                        <div className="relative">
                          <input
                            ref={landingInputRef}
                            value={contactSearch}
                            onFocus={() => setIsContactSearchOpen(true)}
                            onBlur={() => {
                              window.setTimeout(() => setIsContactSearchOpen(false), 160);
                            }}
                            onChange={(event) => {
                              setContactSearch(event.target.value);
                              setHubspotContactId("");
                              setSelectedContactWebsite("");
                              if (scanError) {
                                setScanError("");
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void beginAssessment();
                              }
                            }}
                            placeholder="Search by name, email, or company"
                            className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-lg font-semibold text-[#0A1628] text-center outline-none transition-colors placeholder:font-normal placeholder:text-[#6E7C90] ${
                              scanError ? "border-[#DC2626]" : "border-[#5B6776] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                            }`}
                          />
                          {isContactSearchOpen ? (
                            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto border border-[#E6EBF0] bg-white shadow-[0_10px_30px_rgba(10,22,40,0.08)]">
                              {isLoadingContacts ? (
                                <p className="px-3 py-2 text-xs text-[#5B6776]">Loading contacts...</p>
                              ) : contactSearchResults.length > 0 ? (
                                contactSearchResults.map((contact) => (
                                  <button
                                    key={contact.id}
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                      setHubspotContactId(contact.id);
                                      setContactSearch(contact.email);
                                      setSelectedContactWebsite(contact.website || "");
                                      setEmail(contact.email);
                                      if (!name && contact.name) {
                                        setName(contact.name);
                                      }
                                      if (!propertyName && contact.company) {
                                        setPropertyName(contact.company);
                                      }
                                      setIsContactSearchOpen(false);
                                    }}
                                    className="block w-full border-b border-[#F1F5F9] px-3 py-2 text-left text-xs text-[#0A1628] hover:bg-[#F8FAFC]"
                                  >
                                    <p className="font-medium">{contact.email}</p>
                                    {contact.name || contact.company ? (
                                      <p className="mt-0.5 text-[#5B6776]">{[contact.name, contact.company].filter(Boolean).join(" - ")}</p>
                                    ) : null}
                                  </button>
                                ))
                              ) : (
                                <p className="px-3 py-2 text-xs text-[#5B6776]">No contacts found.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <input
                          ref={landingInputRef}
                          value={urlInput}
                          onChange={(event) => {
                            setUrlInput(event.target.value);
                            if (scanError) {
                              setScanError("");
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void beginAssessment();
                            }
                          }}
                          placeholder="e.g. happycampsrvpark.com"
                          className={`h-12 w-full !rounded-[12px] border bg-white px-4 text-left text-base text-[#0A1628] outline-none transition-all placeholder:text-[#8C97A8] ${
                            scanError ? "border-[#DC2626] focus:border-[#DC2626] focus:shadow-[0_0_0_3px_rgba(220,38,38,0.10)]" : "border-[#C4CCD4] hover:border-[#2DA4A9]/40 focus:border-[#2DA4A9] focus:shadow-[0_0_0_3px_rgba(45,164,169,0.12)]"
                          }`}
                        />
                      )}
                    </motion.div>
                    {scanError ? <p className="mt-2 text-center text-base text-[#B42318]">{scanError}</p> : null}
                  </div>
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={beginAssessment}
                    className="btn-rounded mx-auto mt-4 block min-h-12 w-full bg-[#2DA4A9] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#24858A] lg:mx-0"
                  >
                    Get My Free Report
                  </motion.button>
                </div>
              </div>

              {/* iPhone mockup */}
              <div className="relative mx-auto mt-8 h-[420px] w-[500px] overflow-hidden sm:mt-10 sm:h-[460px] sm:w-[560px] lg:absolute lg:bottom-0 lg:right-0 lg:mt-0 lg:h-auto lg:w-auto lg:overflow-visible">
                <div className="relative w-full translate-x-[10%] lg:w-[850px] lg:translate-x-[28%]">
                  {/* Audit mockup inside iPhone */}
                  <div className="absolute top-[12%] left-[36.5%]! h-[67%]! w-[31%]! -translate-x-[52%] overflow-hidden rounded-[10px] bg-[#F8FAFC]">
                    {/* iOS status bar overlay */}
                    <div className="relative z-10 flex items-center justify-between bg-[#F8FAFC] px-[8%] pt-[4%] pb-[1.5%]">
                      <span className="text-[clamp(4px,1.8vw,10px)] font-semibold text-[#0A1628]">9:41</span>
                      <div className="flex items-center gap-[6%]">
                        {/* Signal bars */}
                        <svg className="h-[clamp(4px,1.2vw,8px)] w-auto" viewBox="0 0 17 10" fill="#0A1628">
                          <rect x="0" y="6" width="3" height="4" rx="0.5"/>
                          <rect x="4" y="4" width="3" height="6" rx="0.5"/>
                          <rect x="8" y="2" width="3" height="8" rx="0.5"/>
                          <rect x="12" y="0" width="3" height="10" rx="0.5"/>
                        </svg>
                        {/* Wifi */}
                        <svg className="h-[clamp(4px,1.2vw,8px)] w-auto" viewBox="0 0 16 12" fill="#0A1628">
                          <path d="M8 0C5.2 0 2.6 1.1.8 3l1.5 1.4C3.8 2.8 5.8 2 8 2s4.2.8 5.7 2.4L15.2 3C13.4 1.1 10.8 0 8 0z"/>
                          <path d="M8 4C6.1 4 4.4 4.8 3.2 6l1.5 1.4C5.5 6.5 6.7 6 8 6s2.5.5 3.3 1.4L12.8 6C11.6 4.8 9.9 4 8 4z"/>
                          <path d="M8 8c-.8 0-1.6.3-2.1.9L8 11l2.1-2.1C9.6 8.3 8.8 8 8 8z"/>
                        </svg>
                        {/* Battery */}
                        <svg className="h-[clamp(4px,1.2vw,8px)] w-auto" viewBox="0 0 25 10" fill="none">
                          <rect x=".5" y=".5" width="20" height="9" rx="1.5" stroke="#0A1628" strokeWidth="1"/>
                          <rect x="2" y="2" width="14" height="6" rx=".5" fill="#0A1628"/>
                          <path d="M22 3.5h1.5a1 1 0 011 1v1a1 1 0 01-1 1H22V3.5z" fill="#0A1628" fillOpacity=".4"/>
                        </svg>
                      </div>
                    </div>
                    <img
                      className="h-full w-full object-cover object-top"
                      src="https://assets.buckysolutions.com/parkgrader/showcase.png"
                      alt="ParkGrader audit report on iPhone"
                    />
                  </div>
                  {/* iPhone frame */}
                  <img
                    alt=""
                    src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/hero49/iphone.png"
                    className="relative z-10 w-full"
                    loading="lazy"
                    width="1008.71"
                    height="857"
                  />
                </div>
              </div>
            </motion.div>
            {/* Full-width bottom stroke */}
            <div className="relative z-20 h-px w-full bg-[#0A1628]/10" />

              {/* ── FAQ ── */}
              <div className="relative z-10">
              <Faq3
                heading="Common questions"
                description=""
                items={[
                  { id: "faq-1", question: "Is this really free?", answer: "Yes  -  100% free, no credit card, no commitment. You get your full score and category grades immediately. We ask for an email only to send you the detailed breakdown with specific fixes." },
                  { id: "faq-2", question: "What exactly does the audit check?", answer: "We run 35+ automated checks across five categories: mobile speed & technical health, booking flow & conversion, site content & trust signals, Google presence & local SEO, and competitive positioning against nearby parks." },
                  { id: "faq-3", question: "How long does it take?", answer: "About 60 seconds. Enter your website URL, answer a couple of quick questions about your property, and we scan everything automatically." },
                  { id: "faq-4", question: "Will you try to sell me something?", answer: "Yes, we offer services at Bucky Solutions. But this audit is genuinely free with no obligation, and no sales call unless you ask for one." },
                  { id: "faq-5", question: "What do I do with the results?", answer: "Every failing check includes a plain-English explanation of the problem and how to fix it. Most issues can be handled by your web developer or even on your own  -  no agency required." },
                  { id: "faq-6", question: "Do you sell my information?", answer: "No. We never sell or share your data. Your email is only used to deliver your audit report." },
                ]}
                supportHeading=""
                supportDescription=""
                supportButtonText=""
                supportButtonUrl=""
              />
              </div>
            {/* Full-width bottom stroke under entire section */}
            <div className="relative z-20 h-px w-full bg-[#0A1628]/10" />
            <PolicyFooter fixed />
          </motion.section>
        )}

        {step === "questions" && (
          <motion.section
            key="questions"
            className="relative flex min-h-screen flex-col overflow-hidden bg-[#F8FAFC] px-6 pb-24 pt-10 sm:px-10 sm:pt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <TopographicPanel />
            <div className="relative z-10 mx-auto flex w-full max-w-[820px] flex-1 flex-col justify-center">
              {questionStep === 0 ? (
                <motion.div
                  className="mx-auto w-full max-w-[680px]"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key="q-platform"
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h2 className="mt-4 text-center text-2xl leading-tight text-[#0A1628] sm:text-[2.2rem]">
                    What booking system does your park use?
                  </h2>
                  <p className="mt-4 text-center text-lg text-[#5B6776]">This helps us test your booking flow accurately.</p>
                  <div className="mt-10 space-y-3.5">
                    {BOOKING_PLATFORM_OPTIONS.map((option, index) => {
                      const isSelected = answers.booking_platform === option.value;
                      const pulse = selectedPulse === `booking_platform-${option.value}`;
                      return (
                        <motion.button
                          key={option.value}
                          className={`question-btn glass-card flex min-h-16 w-full items-center gap-4 px-5 py-4 text-left text-base transition-all ${
                            isSelected
                              ? "rounded-2xl border-[#2DA4A9] bg-[#E6F7F8]/80 !backdrop-blur-md text-[#0A1628] scale-[1.01]"
                              : "rounded-2xl text-[#0A1628] hover:border-[#2DA4A9] hover:bg-[#2DA4A9]/15 hover:scale-[1.01] hover:shadow-[0_4px_16px_rgba(45,164,169,0.15)]"
                          }`}
                          onClick={() => selectQuestionAnswer("booking_platform", option.value)}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0, scale: pulse ? [1, 1.02, 1] : 1 }}
                          transition={{ delay: 0.1 + index * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                              isSelected ? "border-[#2DA4A9] rounded-full" : "border-[#DCE6EE] rounded-full"
                          }`}>
                            <span className={`h-2 w-2 rounded-full ${isSelected ? "bg-[#2DA4A9]" : "bg-transparent"}`} />
                          </span>
                          <span className="leading-snug">{option.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  className="mx-auto w-full max-w-[680px]"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key="q-challenge"
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h2 className="mt-4 text-center text-2xl leading-tight text-[#0A1628] sm:text-[2.2rem]">
                    What&apos;s your biggest headache right now?
                  </h2>
                  <p className="mt-4 text-center text-lg text-[#5B6776]">We&apos;ll put the most relevant findings first in your report.</p>
                  <div className="mt-10 space-y-3.5">
                    {CHALLENGE_OPTIONS.map((option, index) => {
                      const isSelected = answers.primary_challenge === option.value;
                      const pulse = selectedPulse === `primary_challenge-${option.value}`;
                      return (
                        <motion.button
                          key={option.value}
                          className={`question-btn glass-card flex min-h-16 w-full items-center gap-4 px-5 py-4 text-left text-base transition-all ${
                            isSelected
                              ? "rounded-2xl border-[#2DA4A9] bg-[#E6F7F8]/80 !backdrop-blur-md text-[#0A1628] scale-[1.01]"
                              : "rounded-2xl text-[#0A1628] hover:border-[#2DA4A9] hover:bg-[#2DA4A9]/15 hover:scale-[1.01] hover:shadow-[0_4px_16px_rgba(45,164,169,0.15)]"
                          }`}
                          onClick={() => selectQuestionAnswer("primary_challenge", option.value)}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0, scale: pulse ? [1, 1.02, 1] : 1 }}
                          transition={{ delay: 0.1 + index * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                              isSelected ? "border-[#2DA4A9] rounded-full" : "border-[#DCE6EE] rounded-full"
                          }`}>
                            <span className={`h-2 w-2 rounded-full ${isSelected ? "bg-[#2DA4A9]" : "bg-transparent"}`} />
                          </span>
                          <span className="leading-snug">{option.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>
            <PolicyFooter fixed />
          </motion.section>
        )}

        {step === "partial" && (
          <motion.section
            key="partial"
            className="relative flex h-screen items-center justify-center overflow-hidden bg-[#F8FAFC] px-6 pb-24 pt-16 sm:px-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <TopographicPanel />
            <div className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
              <div className="h-36 w-36">
                <Lottie
                  animationData={starLoaderAnimation}
                  loop
                  autoplay
                  className="h-full w-full"
                />
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={scanStepLabel || "scanning"}
                  className="-mt-1 text-base text-[#5B6776]"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  {scanStepLabel || "Scanning your website…"}
                </motion.p>
              </AnimatePresence>
            </div>
            <PolicyFooter fixed />

          </motion.section>
        )}

        {step === "report" && scanResult && (
          <motion.section key="report" className="report-page relative min-h-screen overflow-hidden bg-[#F8FAFC]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}>
            <TopographicPanel mode="report" />
            <div ref={reportSectionRef} className="relative z-10 px-6 pb-16 pt-12 sm:px-10">
              <div className="mx-auto max-w-[760px]">
                <div className="flex items-center justify-between gap-4">
                  <button type="button" onClick={resetToLandingPage} className="inline-flex cursor-pointer items-center" aria-label="Back to ParkGrader start page">
                    <Image src={PARKGRADER_LOGO} alt="ParkGrader" width={181} height={32} className="h-7 w-auto" />
                  </button>
                  {(() => {
                    if (!previousScanResult) return null;
                    const delta = scanResult.score - previousScanResult.score;
                    if (delta === 0) {
                      return <span className="text-xs text-[#94A3B8]">No change since last scan</span>;
                    }
                    const color = delta > 0 ? "#16A34A" : "#B42318";
                    return (
                      <span className="text-xs font-medium" style={{ color }}>
                        {delta > 0 ? "↑" : "↓"} {Math.abs(delta)} point{Math.abs(delta) !== 1 ? "s" : ""} since last scan
                      </span>
                    );
                  })()}
                </div>

                <motion.div className="mx-auto mt-8" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
                  <div className="glass-card overflow-hidden rounded-2xl pt-6">
                  <div className="print-hidden flex items-end justify-center">
                    <div className="relative" style={{ width: 240, height: 148 }}>
                    <svg viewBox="0 0 240 148" className="h-full w-full">
                      {/* Grey background track */}
                      <path
                        d="M 20 128 A 100 100 0 0 1 220 128"
                        fill="none"
                        stroke="#E6EBF0"
                        strokeWidth="16"
                        strokeLinecap="round"
                      />
                      {/* Animated progress arc */}
                      <motion.path
                        d="M 20 128 A 100 100 0 0 1 220 128"
                        fill="none"
                        stroke={gaugeColor}
                        strokeWidth="16"
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: gaugeTargetProgress }}
                        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                        style={{ opacity: gaugeTargetProgress > 0 ? 1 : 0 }}
                      />
                      {/* Tick marks at 25 / 50 / 75 */}
                      {[25, 50, 75].map((p) => {
                        const a = (1 - p / 100) * Math.PI;
                        return (
                          <line
                            key={p}
                            x1={120 + 92 * Math.cos(a)}
                            y1={128 - 92 * Math.sin(a)}
                            x2={120 + 108 * Math.cos(a)}
                            y2={128 - 108 * Math.sin(a)}
                            stroke="white"
                            strokeWidth="2.5"
                          />
                        );
                      })}
                      {/* Scale labels */}
                      <text x="11" y="145" textAnchor="middle" fontSize="9" fill="#9CA3AF">0</text>
                      <text x="120" y="14" textAnchor="middle" fontSize="9" fill="#9CA3AF">50</text>
                      <text x="229" y="145" textAnchor="middle" fontSize="9" fill="#9CA3AF">100</text>
                      {/* Score number  -  centroid of the arc bowl */}
                      <text
                        x="120"
                        y="100"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={letterGrade.length > 1 ? "56" : "72"}
                        fontFamily="ParkGraderGoogleSansGrade"
                        fontWeight="700"
                        fill={finalScore >= 75 ? "#16A34A" : finalScore >= 50 ? "#D97706" : "#DC2626"}
                      >{letterGrade}</text>
                    </svg>
                    </div>
                  </div>
                  <a href={`https://${reportUrl}`} target="_blank" rel="noopener noreferrer" className="mx-auto mb-10 mt-2 flex max-w-[220px] items-center justify-center gap-1 break-all text-center text-xs text-[#5B6776] hover:text-[#1A2B3C] transition-colors">
                    <span>{displayReportUrl}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 flex-shrink-0"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm7.25-.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V6.31l-5.22 5.22a.75.75 0 1 1-1.06-1.06l5.22-5.22H12.25a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
                  </a>
                  {/* Card action buttons */}
                  <div className="mt-4 flex divide-x divide-[#E6EBF0] border-t border-[#E6EBF0]">
                    <button
                      type="button"
                      onClick={handleRescan}
                      className="report-btn-rounded flex flex-1 items-center justify-center gap-2 rounded-bl-2xl py-3 text-xs font-medium text-[#5B6776] transition-colors hover:bg-[#F8FAFB] hover:text-[#0A1628]"
                    >
                      <ArrowPathIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      Run Again
                    </button>
                    <button
                      type="button"
                      onClick={copyShareLink}
                      className="report-btn-rounded flex flex-1 items-center justify-center gap-2 rounded-br-2xl py-3 text-xs font-medium text-[#5B6776] transition-colors hover:bg-[#F8FAFB] hover:text-[#0A1628]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.105 5.545.75.75 0 001.001-1.117 2.5 2.5 0 01-.07-3.467l3-3z" />
                        <path d="M7.768 15.768a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 005.656 5.656l3-3a4 4 0 00-.105-5.545.75.75 0 00-1.001 1.117 2.5 2.5 0 01.07 3.467l-3 3z" />
                      </svg>
                      {copied ? "Copied" : "Copy Link"}
                    </button>
                  </div>
                  </div>
                </motion.div>

                {/* ── Detail Cards ── */}
                {isReportUnlocked || isTradeshowMode ? (
                <div className="relative mt-12">
                  {/* Report summary */}
                  <div className="mb-6 text-left">
                    <p className="text-[1.5rem] font-medium leading-tight text-[#0A1628]">
                      {reportSummary.total} things reviewed, {reportSummary.needWork} need work
                    </p>
                    <p className="mt-2 text-[1.5rem] leading-tight text-[#5B6776]">
                      See what's wrong and how to improve
                    </p>
                  </div>

                  {/* Flat check cards  -  all visible immediately, sorted by weight */}
                  <div className="glass-card overflow-hidden rounded-2xl">
                    {visibleChecks.map((check, index) => {
                      const isExpanded = expandedCardId === check.id;
                      return (
                      <motion.article
                        key={check.id}
                        className="group cursor-pointer transition-colors"
                        onClick={() => toggleCardExpanded(check.id)}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <div className={`px-5 py-5 transition-colors md:px-6 md:py-6 ${isExpanded ? "bg-[rgba(255,255,255,0.30)]" : "hover:bg-[rgba(255,255,255,0.30)]"} ${index < visibleChecks.length - 1 ? "border-b border-[#DCE6EE]" : ""}`}>
                          {/* Header row — always visible */}
                          <div className="flex items-center gap-2.5">
                            <span className="shrink-0">
                              {check.status === "pass" ? (
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <circle cx="10" cy="10" r="10" fill="#0E7C66" />
                                  <path d="M6 10.5l2.5 2.5L14 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <circle cx="10" cy="10" r="10" fill="#B42318" />
                                  <path d="M7 7l6 6M13 7l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            <span className="flex-1 text-lg font-medium leading-8 text-[#0A1628]">{check.finding || getCheckDisplayLabel(check)}</span>
                            <span className="shrink-0 text-[#9AA9B5] transition-transform duration-200" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
                              <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                            </span>
                          </div>

                          {/* Detail paragraph — always visible */}
                          {check.details ? (
                            <p className="mt-0.5 pl-[30px] text-base leading-7 text-[#0A1628]">{check.details}</p>
                          ) : null}

                          {/* Debug evidence — always visible */}
                          {isDebug && check.evidence ? (
                            <p className="mt-1 pl-[30px] text-xs leading-5 text-[#94A3B8] font-mono">{check.evidence}</p>
                          ) : null}

                          {/* How to fix it — expands on click */}
                          {isExpanded && check.steps && check.steps.length > 0 ? (
                            <motion.div
                              className="mt-3 pl-[30px]"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#357D84]">{check.status === "pass" ? "How to keep it this way" : "How to fix it"}</p>
                              {check.steps.length === 1 ? (
                                <p className="mt-1 text-base leading-7 text-[#0A1628]">{check.steps[0]}</p>
                              ) : (
                                <ul className="mt-1 space-y-1">
                                  {check.steps.map((step, stepIndex) => (
                                    <li key={stepIndex} className="flex gap-2 text-base leading-7 text-[#0A1628]">
                                      <span className="shrink-0">•</span>
                                      <span>{step}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </motion.div>
                          ) : null}
                        </div>
                      </motion.article>
                      );
                    })}
                  </div>

                  {/* Email capture — bottom of report, non-dismissible */}
                  {!isTradeshowMode ? (
                    hasSubmittedEmailGate ? (
                      /* Thank-you state — shown inline where form was */
                      <motion.section
                        className="mt-10 px-1"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <div className="relative">
                          <div className="glow-blob" />
                          <div className="glow-card px-8 py-10 text-center">
                            {/* Animated checkmark */}
                            <motion.div
                              className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#E6F7F8]"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", damping: 12, stiffness: 260, delay: 0.15 }}
                            >
                              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <motion.circle
                                  cx="22" cy="22" r="20"
                                  stroke="#2DA4A9" strokeWidth="3"
                                  strokeLinecap="round"
                                  fill="none"
                                  initial={{ pathLength: 0, rotate: -90 }}
                                  animate={{ pathLength: 1, rotate: -90 }}
                                  transition={{ duration: 0.5, delay: 0.3, ease: "easeInOut" }}
                                />
                                <motion.path
                                  d="M13 22.5l6 6L31 16"
                                  stroke="#2DA4A9" strokeWidth="3"
                                  strokeLinecap="round" strokeLinejoin="round"
                                  fill="none"
                                  initial={{ pathLength: 0 }}
                                  animate={{ pathLength: 1 }}
                                  transition={{ duration: 0.4, delay: 0.65, ease: "easeInOut" }}
                                />
                              </svg>
                            </motion.div>
                            <motion.p
                              className="text-[1.75rem] font-medium leading-tight text-[#0A1628]"
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.5, duration: 0.4 }}
                            >
                              We'll take a look!
                            </motion.p>
                            <motion.p
                              className="mx-auto mt-3 max-w-md text-base leading-7 text-[#5B6776]"
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.6, duration: 0.4 }}
                            >
                              We&apos;ll personally review your site and send a short video with your fix list to <span className="font-medium text-[#0A1628]">{inlineGateEmail}</span>, usually within 24 hours. In the meantime, scroll up to explore your results.
                            </motion.p>
                          </div>
                        </div>
                      </motion.section>
                    ) : (
                      /* Form state */
                      <motion.section
                        className="mt-10 px-1"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <div className="relative" ref={inlineGateRef}>
                          <div className="glow-blob" />
                          <div className="glow-card px-8 py-10 text-center">
                            <p className="text-[1.75rem] font-medium leading-tight text-[#0A1628]">Get a personalized video review</p>
                            <p className="mx-auto mt-2 max-w-md text-base leading-7 text-[#5B6776]">
                              We&apos;ll look at your results, record a short walkthrough of your biggest opportunities, and send it with your <span className="font-semibold text-[#4A5A6A]">fix list</span> and <span className="font-semibold text-[#4A5A6A]">full report</span>, usually within 24 hours.
                            </p>
                            <div className="mt-6 mx-auto w-full max-w-sm">
                              <input
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                autoCapitalize="none"
                                spellCheck={false}
                                value={inlineGateEmail}
                                onChange={(event) => {
                                  setInlineGateEmail(event.target.value);
                                  if (inlineGateNotice) {
                                    setInlineGateNotice("");
                                  }
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void submitInlineGate();
                                  }
                                }}
                                placeholder="Your email"
                                className={`h-12 w-full !rounded-[12px] border bg-white px-4 text-base text-[#0A1628] outline-none transition-all placeholder:text-[#8C97A8] hover:border-[#F57D52]/40 focus:shadow-[0_0_0_3px_rgba(245,125,82,0.12)] ${
                                  inlineGateNotice ? "border-[#DC2626] focus:border-[#DC2626] focus:shadow-[0_0_0_3px_rgba(220,38,38,0.10)]" : "border-[#C4CCD4] focus:border-[#F57D52]"
                                }`}
                              />
                              {inlineGateNotice ? <p className="mt-2 text-left text-base text-[#B42318]">{inlineGateNotice}</p> : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => void submitInlineGate()}
                              className="report-btn-rounded mt-6 inline-flex min-h-12 w-full max-w-sm items-center justify-center bg-[#F57D52] px-5 py-3 text-base font-medium text-white transition-all hover:bg-[#E0683E] hover:shadow-[0_0_28px_rgba(245,125,82,0.35)] disabled:cursor-not-allowed disabled:opacity-70"
                              disabled={isSubmittingInlineGate}
                            >
                              {isSubmittingInlineGate ? "Saving..." : "Send Me the Video"}
                            </button>
                            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-[#8C97A8]">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#8c97a8" viewBox="0 0 256 256"><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"></path></svg>
                              Join 500+ campground owners
                            </p>
                          </div>
                        </div>
                      </motion.section>
                    )
                  ) : null}

                </div>
                ) : null}

                <AnimatePresence>
                  {showSharePrompt && !isTradeshowMode ? (
                    <motion.div
                      className="print-hidden fixed inset-0 z-50 flex items-center justify-center bg-[#0A1628]/55 px-4 py-6 backdrop-blur-[2px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowSharePrompt(false)}
                    >
                      <motion.div
                        className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#E6EBF0] bg-[#fafcfd] shadow-[0_24px_80px_rgba(10,22,40,0.24)]"
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.97 }}
                        transition={{ type: "spring", damping: 26, stiffness: 300 }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setShowSharePrompt(false)}
                          className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center text-2xl leading-none text-[#9AA9B5] transition-colors hover:text-[#0A1628]"
                          aria-label="Close share prompt"
                        >
                          <XMarkIcon className="h-7 w-7" aria-hidden="true" />
                        </button>

                        <div className="p-6 sm:p-8">
                          <div>
                            <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">Want a copy of this report?</p>
                            <p className="mt-3 text-2xl leading-9 text-[#0A1628]">Send this report to your inbox</p>
                            <p className="mt-3 text-base leading-7 text-[#5B6776]">
                              Enter your email and where to send it. We&apos;ll also copy the share link for you.
                            </p>
                            <div className="mt-6 grid w-full grid-cols-1 gap-3">
                              <input
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                autoCapitalize="none"
                                spellCheck={false}
                                value={shareEmail}
                                onChange={(event) => {
                                  setShareEmail(event.target.value);
                                  if (sharePromptNotice) {
                                    setSharePromptNotice("");
                                  }
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void submitSharePrompt();
                                  }
                                }}
                                placeholder="Your email"
                                className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-base text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] ${
                                  sharePromptNotice ? "border-[#DC2626] focus:border-[#DC2626]" : "border-[#C4D3E2] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                                }`}
                              />
                              <input
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                autoCapitalize="none"
                                spellCheck={false}
                                value={shareEmail}
                                onChange={(event) => {
                                  setShareEmail(event.target.value);
                                  if (sharePromptNotice) {
                                    setSharePromptNotice("");
                                  }
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void submitSharePrompt();
                                  }
                                }}
                                placeholder="Send to (email address)"
                                className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-base text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] ${
                                  sharePromptNotice ? "border-[#DC2626] focus:border-[#DC2626]" : "border-[#C4D3E2] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                                }`}
                              />
                              {sharePromptNotice ? <p className="-mt-1 text-left text-base text-[#B42318]">{sharePromptNotice}</p> : null}
                            </div>
                            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                              <button
                                type="button"
                                onClick={() => void submitSharePrompt()}
                                className="report-btn-rounded inline-flex min-h-12 flex-1 items-center justify-center bg-[#2DA4A9] px-5 py-3 text-base text-white transition-colors hover:bg-[#24858A] disabled:cursor-not-allowed disabled:opacity-70"
                                disabled={isSubmittingSharePrompt}
                              >
                                {isSubmittingSharePrompt ? "Sending..." : "Send Report"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  ) : null}

                </AnimatePresence>

                <a
                  href="https://www.buckysolutions.com"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-12 flex items-center justify-center gap-2 text-xs text-[#5B6776]"
                >
                  Powered by
                  <Image
                    src="https://assets.buckysolutions.com/bucky%2Blogo%2Bwhite.svg"
                    alt="Bucky's Solutions"
                    width={100}
                    height={20}
                    className="h-4 w-auto"
                    style={{ filter: "brightness(0) saturate(100%) invert(41%) sepia(9%) saturate(735%) hue-rotate(175deg) brightness(92%) contrast(87%)" }}
                    unoptimized
                  />
                </a>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
