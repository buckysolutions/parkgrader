"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  GlobeAltIcon,
  HomeModernIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  NewspaperIcon,
  PhoneIcon,
  PhotoIcon,
  QueueListIcon,
  ReceiptPercentIcon,
  ShareIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SunIcon,
  TagIcon,
  TruckIcon,
  UserCircleIcon,
  UsersIcon,
  XMarkIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import QRCode from "qrcode";

type IndustryKey = "campground" | "marina" | "glamping" | "cabins";
type AppStep = "landing" | "guided" | "partial" | "report";
type CheckCategory =
  | "Does Your Website Work?"
  | "Can Guests Book Online?"
  | "What Info Are You Missing?"
  | "Can Guests Find You?"
  | "Are You Losing Guests?";
type CheckStatus = "pass" | "fail" | "unknown";
type Effort = "Low" | "Medium" | "High";
type Impact = "Low" | "Medium" | "High";

type ScanCheck = {
  id: string;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  pass: boolean;
  finding: string;
  details: string;
  weight: number;
  effort: Effort;
  impact: Impact;
  serviceKey: string;
  estimatedImpact?: string;
  benchmark?: string;
};

type ScanResponse = {
  url: string;
  pageSpeedReportUrl?: string;
  overallBenchmarkText?: string;
  accessibilityScore?: number | null;
  mobileTrafficPercent?: number | null;
  industry: IndustryKey;
  industryLabel: string;
  unitLabel: string;
  score: number;
  status: "Industry Leader" | "Above Average" | "Needs Attention" | "At Risk" | "Critical";
  detectedPlatform: string | null;
  lostBookingsEstimate: number;
  lostRevenueDrivers: string[];
  topFails: string[];
  categories: Array<{
    name: CheckCategory;
    score: number;
    passed: number;
    total: number;
    categoryWeight: number;
  }>;
  checks: ScanCheck[];
};

type AnswerOption = {
  value: string;
  label: string;
};

type HubSpotContactOption = {
  id: string;
  email: string;
  name: string;
  company: string;
  website: string;
};

type GuidedQuestion = {
  id: "property_type" | "primary_challenge" | "property_size";
  text: string;
  options: AnswerOption[];
};

type Answers = Partial<Record<GuidedQuestion["id"], AnswerOption>>;

type ProtectedAction = "share" | "email-share" | "sms-share" | "print" | "pdf" | "qr";
type PainLevel = "money-losers" | "maintenance-needed" | "watchlist" | "working-well";

type ServiceCta = {
  badge: string;
  title: string;
  description: string;
  buttonLabel: string;
  href: string;
};

type ReportSnapshot = {
  reportId: string;
  reportUrl: string;
  scanResult: ScanResponse;
  aiFixDraftByCheckId?: Record<string, string>;
  localReviewCompareByCheckId?: Record<string, LocalReviewCompareResult>;
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
  sendEmailCopy?: boolean;
  aiFixDraftByCheckIdOverride?: Record<string, string>;
  localReviewCompareByCheckIdOverride?: Record<string, LocalReviewCompareResult>;
};

type LocalReviewCompareResult = {
  subject: {
    name: string;
    rating: number | null;
    reviewCount: number;
  };
  competitors: Array<{
    name: string;
    rating: number | null;
    reviewCount: number;
  }>;
  benchmark: {
    averageRating: number;
    averageReviewCount: number;
    reviewGap: number;
    weeklyTarget: number;
  };
};

type DemoMode = null | "needs-work" | "good";

const PARKGRADER_LOGO = "https://assets.buckysolutions.com/parkgrader_logo.svg";

const PROPERTY_TYPE_OPTIONS: Array<AnswerOption & { industry: IndustryKey; unitLabel: string }> = [
  { value: "campground", label: "Campground / RV Park", industry: "campground", unitLabel: "sites" },
  { value: "marina", label: "Marina", industry: "marina", unitLabel: "slips" },
  { value: "glamping", label: "Glamping", industry: "glamping", unitLabel: "tents/domes" },
  { value: "cabins", label: "Cabins / Vacation Rentals", industry: "cabins", unitLabel: "units" },
];
const PRIMARY_CHALLENGE_OPTIONS: AnswerOption[] = [
  { value: "mostly-google-search", label: "Mostly Google search" },
  { value: "mostly-ota-platforms", label: "Mostly OTA platforms (Hipcamp, Campspot)" },
  { value: "mostly-word-of-mouth-repeat", label: "Mostly word of mouth / repeat guests" },
  { value: "not-sure", label: "Honestly, I'm not sure" },
];
const PROPERTY_SIZE_OPTIONS: Array<AnswerOption & { midpoint: number }> = [
  { value: "under-25", label: "Under 25 sites/units", midpoint: 12 },
  { value: "25-75", label: "25–75 sites/units", midpoint: 50 },
  { value: "76-200", label: "76–200 sites/units", midpoint: 138 },
  { value: "200-plus", label: "200+ sites/units", midpoint: 250 },
];
const GUIDED_QUESTIONS: GuidedQuestion[] = [
  {
    id: "property_type",
    text: "What type of property are you running?",
    options: PROPERTY_TYPE_OPTIONS,
  },
  {
    id: "primary_challenge",
    text: "How are guests currently finding you?",
    options: PRIMARY_CHALLENGE_OPTIONS,
  },
  {
    id: "property_size",
    text: "How large is your property?",
    options: PROPERTY_SIZE_OPTIONS,
  },
];
const CATEGORY_ORDER: CheckCategory[] = [
  "Does Your Website Work?",
  "Can Guests Book Online?",
  "What Info Are You Missing?",
  "Can Guests Find You?",
  "Are You Losing Guests?",
];

const PARTIAL_LOADING_PHASES = [
  { message: "Connecting to your website...", delay: 0 },
  { message: "Checking SSL certificate and redirect chain...", delay: 2000 },
  { message: "Scanning homepage content and links...", delay: 4500 },
  { message: "Analyzing booking flow and trust signals...", delay: 7000 },
  { message: "Checking maps, social profiles, and internal pages...", delay: 10000 },
  { message: "Running Google PageSpeed Lighthouse audit...", delay: 13000 },
  { message: "Still waiting on Google PageSpeed — this is the slow part...", delay: 25000 },
  { message: "Almost there — Google is finishing up...", delay: 40000 },
];

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>;

const CATEGORY_ICON_BY_CHECK_CATEGORY: Record<CheckCategory, HeroIcon> = {
  "Does Your Website Work?": BoltIcon,
  "Can Guests Book Online?": CalendarDaysIcon,
  "What Info Are You Missing?": HomeModernIcon,
  "Can Guests Find You?": MagnifyingGlassIcon,
  "Are You Losing Guests?": DevicePhoneMobileIcon,
};

const PAIN_LEVEL_ICON_BY_KEY: Record<PainLevel, HeroIcon> = {
  "money-losers": ExclamationCircleIcon,
  "maintenance-needed": ClockIcon,
  watchlist: QueueListIcon,
  "working-well": CheckCircleIcon,
};

const CHECK_ICON_BY_ID: Record<string, HeroIcon> = {
  "technical-trust-security": ShieldCheckIcon,
  "response-time": BoltIcon,
  "broken-links": LinkIcon,
  "pagespeed-mobile": DevicePhoneMobileIcon,
  "human-written-content": DocumentTextIcon,
  "website-technology": BoltIcon,
  "copyright-freshness": CalendarDaysIcon,
  "booking-platform": CalendarDaysIcon,
  "booking-cta": ArrowRightIcon,
  "date-picker-discoverability": CalendarDaysIcon,
  "fee-transparency": ReceiptPercentIcon,
  "tracking-pixels": ChartBarSquareIcon,
  "pet-policy": QueueListIcon,
  "rv-hookup-specs": TruckIcon,
  "big-rig-readiness": TruckIcon,
  "arrival-directions-clarity": MapPinIcon,
  "ev-extra-vehicle-policy": CreditCardIcon,
  "amenities-page": HomeModernIcon,
  "cancellation-policy": DocumentTextIcon,
  "accessibility-statement": UserCircleIcon,
  "meta-title": TagIcon,
  "meta-description": NewspaperIcon,
  "gbp-sync": MapPinIcon,
  "local-review-competitiveness": MapPinIcon,
  "social-presence": UsersIcon,
  "structured-data": GlobeAltIcon,
  "sitemap-presence": DocumentTextIcon,
  "mobile-viewport": DevicePhoneMobileIcon,
  "phone-conversion-readiness": PhoneIcon,
  "accessibility-score": UserCircleIcon,
  "rate-transparency": ReceiptPercentIcon,
  "contact-friction": PhoneIcon,
  "trust-stack-completeness": ShieldCheckIcon,
  "seasonal-visibility": SunIcon,
  "professional-email": EnvelopeIcon,
  "checkin-checkout-times": ClockIcon,
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

const INTERNAL_TEST_DOMAIN = "buckysolutions.com";
const IS_REVIEW_COACH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_REVIEW_COACH === "true";

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
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
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

const buildDemoScanResult = (mode: Exclude<DemoMode, null>): ScanResponse => {
  const good = mode === "good";
  const checks: ScanCheck[] = [
    {
      id: "technical-trust-security",
      name: "Technical trust & security",
      category: "Does Your Website Work?",
      status: "pass",
      pass: true,
      finding: "SSL, HTTPS redirect, and canonical tags are aligned.",
      details: "Your technical trust stack is solid — browsers show the padlock and search engines index one clean version of your site.",
      weight: 1,
      effort: "Low",
      impact: "High",
      serviceKey: "ssl",
    },
    {
      id: "pagespeed-mobile",
      name: "Mobile performance",
      category: "Does Your Website Work?",
      status: good ? "pass" : "fail",
      pass: good,
      finding: good ? "Mobile performance score 84." : "Mobile performance score 39.",
      details: good
        ? "Your site loads fast enough on phones to keep guests engaged."
        : "Your site is loading slower than it should on phones. Guests will leave before they ever see your booking button.",
      weight: 1,
      effort: "Medium",
      impact: "High",
      serviceKey: "pagespeed",
    },
    {
      id: "booking-cta",
      name: "Book now button",
      category: "Can Guests Book Online?",
      status: good ? "pass" : "fail",
      pass: good,
      finding: good ? "Clear booking path found." : "No clear booking button found.",
      details: good
        ? "Guests can quickly move from browsing to booking."
        : "If the booking step is hard to spot, conversion drops fast.",
      weight: 1,
      effort: "Low",
      impact: "High",
      serviceKey: "booking_cta",
    },
    {
      id: "tracking-pixels",
      name: "Tracking pixels",
      category: "Can Guests Book Online?",
      status: good ? "pass" : "fail",
      pass: good,
      finding: good ? "Facebook Pixel and GTM detected." : "No Facebook Pixel or GTM detected.",
      details: good
        ? "Retargeting and attribution are set up."
        : "You are missing remarketing data on visitors who leave before booking.",
      weight: 1,
      effort: "Low",
      impact: "Medium",
      serviceKey: "tracking_pixels",
    },
    {
      id: "cancellation-policy",
      name: "Cancellation policy",
      category: "What Info Are You Missing?",
      status: good ? "pass" : "fail",
      pass: good,
      finding: good ? "Cancellation policy found." : "No cancellation policy found.",
      details: good
        ? "Guests can understand the rules before committing money."
        : "Families book months ahead and worry about 'what if something comes up.' A clear cancellation policy often tips someone from 'thinking about it' to clicking 'Reserve.'",
      weight: 1,
      effort: "Low",
      impact: "Medium",
      serviceKey: "default",
    },
    {
      id: "rate-transparency",
      name: "Pricing visible",
      category: "Are You Losing Guests?",
      status: good ? "pass" : "fail",
      pass: good,
      finding: good ? "Pricing is visible on your site." : "No clear pricing found.",
      details: good
        ? "Guests can see if they can afford you before investing time in the booking process."
        : "Hidden pricing forces guests to call or fill out a form just to find out if they can afford your park. Most will just leave.",
      weight: 1,
      effort: "Low",
      impact: "High",
      serviceKey: "rate_page",
    },
    {
      id: "gbp-sync",
      name: "Google listing",
      category: "Can Guests Find You?",
      status: good ? "pass" : "fail",
      pass: good,
      finding: good ? "Google map and strong review signals found." : "Google Business Profile link appears weak or missing.",
      details: good
        ? "Local trust signals support discovery traffic."
        : "Weak local presence makes it harder to compete in maps and branded search.",
      weight: 1,
      effort: "Low",
      impact: "High",
      serviceKey: "google_business",
    },
    {
      id: "mobile-viewport",
      name: "Phone layout",
      category: "Are You Losing Guests?",
      status: good ? "pass" : "fail",
      pass: good,
      finding: good ? "Phone layout settings detected." : "Your site is missing phone layout settings.",
      details: good
        ? "Phones are receiving proper responsive layout instructions."
        : "Without this, your site shows up tiny and zoomed out on smartphones — text too small to read, buttons too small to tap.",
      weight: 1,
      effort: "Low",
      impact: "High",
      serviceKey: "mobile",
    },
  ];

  const categories: ScanResponse["categories"] = CATEGORY_ORDER.map((name) => {
    const categoryChecks = checks.filter((check) => check.category === name);
    const total = categoryChecks.reduce((sum, check) => sum + check.weight, 0);
    const passed = categoryChecks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0);
    const score = total === 0 ? 0 : Math.round((passed / total) * 100);
    const weights: Record<CheckCategory, number> = {
      "Does Your Website Work?": 15,
      "Can Guests Book Online?": 25,
      "What Info Are You Missing?": 30,
      "Can Guests Find You?": 15,
      "Are You Losing Guests?": 15,
    };
    return { name, score, passed, total, categoryWeight: weights[name] };
  }).filter((category) => category.total > 0);

  return {
    url: good ? "https://demoindustryleader.com" : "https://democampground.com",
    overallBenchmarkText: good ? "Industry average for campgrounds and RV parks is 68. You are 13 points above average." : "Industry average for campgrounds and RV parks is 68. You are 21 points below average.",
    industry: "campground",
    industryLabel: "Campground / RV Park",
    unitLabel: "sites",
    score: good ? 81 : 47,
    status: good ? "Industry Leader" : "At Risk",
    detectedPlatform: good ? "Campspot" : "Reserve America",
    lostBookingsEstimate: good ? 9 : 22,
    lostRevenueDrivers: good
      ? [
          "Your online experience is ahead of the market, but a few smaller leaks remain.",
          "You still have room to improve repeat guest capture.",
        ]
      : [
          "Your online experience is slower than ideal.",
          "Guests are not seeing a clear booking path.",
          "You are missing remarketing data.",
          "No cancellation policy is making guests hesitate.",
          "Hidden pricing is forcing visitors to bounce.",
        ],
    topFails: good ? ["tracking-pixels"] : ["pagespeed-mobile", "booking-cta", "rate-transparency"],
    categories,
    checks,
  };
};

type ReviewCoachTone = "friendly" | "professional" | "premium";

type ReviewCoachSummary = {
  totalReviews: number;
  averageRating: number;
  unansweredReviews: number;
  needsReplyNow: number;
  sentimentBreakdown: { positive: number; mixed: number; negative: number };
};

type ReviewCoachTopIssue = {
  key: string;
  label: string;
  count: number;
  frequencyPercent: number;
  recommendedUpdate: string;
  replyStrategy: string;
};

type ReviewCoachReply = {
  reviewId: string;
  rating: number;
  reviewSnippet: string;
  reason: string;
  draftReply: string;
};

type ReviewCoachResult = {
  summary: ReviewCoachSummary;
  insights: { topIssues: ReviewCoachTopIssue[]; repliesToPostNow: ReviewCoachReply[]; nextBestUpdates: string[] };
  meta: { tone: ReviewCoachTone; modelUsed: string };
  message?: string;
};

const STAR_COLORS: Record<number, string> = { 1: "#DC2626", 2: "#EA580C", 3: "#D97706", 4: "#2DA4A9", 5: "#16A34A" };

function ReviewCoachPanel({ propertyName, isVisible }: { propertyName: string; isVisible: boolean }) {
  const [tone, setTone] = useState<ReviewCoachTone>("friendly");
  const [result, setResult] = useState<ReviewCoachResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [authStatus, setAuthStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [locations, setLocations] = useState<{ name: string; title: string; address: string }[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  const refreshLocations = async () => {
    try {
      const res = await fetch("/api/reviews/locations");
      const payload = (await res.json().catch(() => ({}))) as {
        locations?: { name: string; title: string; address: string }[];
        message?: string;
      };

      if (!res.ok) {
        setAuthStatus("disconnected");
        setError(payload.message ?? "Could not load Google Business locations.");
        return;
      }

      const locs = payload.locations ?? [];
      setLocations(locs);
      setAuthStatus("connected");
      setError("");
      if (locs.length) {
        setSelectedLocation(locs[0].name);
      }
    } catch {
      setAuthStatus("disconnected");
      setError("Could not reach Google Business location service.");
    }
  };

  useEffect(() => {
    if (!isVisible) return;
    void refreshLocations();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if ((event.data as { type?: string })?.type !== "GBP_AUTH_SUCCESS") {
        return;
      }

      void refreshLocations();
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isVisible]);

  const openGoogleAuth = () => {
    const w = window.open("/api/auth/google?popup=1", "GoogleAuth", "width=600,height=700");
    const checkClosed = setInterval(() => {
      if (!w || w.closed) {
        clearInterval(checkClosed);
        void refreshLocations();
      }
    }, 500);
  };

  const fetchAndAnalyze = async () => {
    if (!selectedLocation) return;
    setIsFetching(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/reviews/fetch?location=${encodeURIComponent(selectedLocation)}`);
      const payload = (await res.json()) as { reviews?: unknown[]; message?: string };
      if (!res.ok) { if (res.status === 401) setAuthStatus("disconnected"); throw new Error(payload.message ?? "Fetch failed."); }
      const fetchedReviews = payload.reviews ?? [];
      if (!fetchedReviews.length) { setError("No reviews found."); setIsFetching(false); return; }
      setIsLoading(true);
      const selectedLoc = locations.find((l) => l.name === selectedLocation);
      const res2 = await fetch("/api/review-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyName: selectedLoc?.title || propertyName, tone, reviews: fetchedReviews }),
      });
      const payload2 = (await res2.json()) as ReviewCoachResult;
      if (!res2.ok) throw new Error(payload2.message ?? "Analysis failed.");
      setResult(payload2);
    } catch (e) { setError(e instanceof Error ? e.message : "Error fetching or analyzing reviews."); }
    finally { setIsFetching(false); setIsLoading(false); }
  };

  const copy = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopiedId(id); window.setTimeout(() => setCopiedId(""), 1800); } catch { /* silent */ }
  };

  if (!isVisible) return null;

  return (
    <aside className="print-hidden fixed right-0 top-0 z-40 flex h-full w-full max-w-sm flex-col overflow-hidden border-l border-[#E2E9EF] bg-white shadow-[-8px_0_48px_rgba(10,22,40,0.16)]">
      {/* header */}
      <div className="border-b border-[#E2E9EF] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2DA4A9]">Review Coach</p>
        <p className="mt-1 text-sm font-semibold text-[#0A1628]">Analyze &amp; Reply</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* connection status */}
        {authStatus === "checking" && (
          <div className="space-y-3 text-center py-6">
            <div className="animate-spin h-5 w-5 border-2 border-[#2DA4A9] border-t-transparent rounded-full mx-auto"></div>
            <p className="text-xs text-[#5B6776]">Checking connection…</p>
          </div>
        )}

        {authStatus === "disconnected" && (
          <div className="space-y-3">
            <p className="text-sm text-[#314154]">Connect your Google Business Profile to fetch and analyze your reviews.</p>
            <button
              type="button"
              onClick={openGoogleAuth}
              className="w-full flex items-center justify-center gap-2 border border-[#D4DEE7] bg-white hover:bg-[#F9FAFB] px-4 py-3 text-sm font-medium text-[#0A1628] transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
            <p className="text-[10px] text-[#9AA9B5] text-center">We only access your reviews and location info</p>
          </div>
        )}

        {authStatus === "connected" && (
          <div className="space-y-3">
            {/* location selector */}
            <div>
              <label className="text-xs font-medium text-[#314154]">Your location</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="mt-1 w-full border border-[#D4DEE7] bg-white px-3 py-2 text-xs outline-none focus:border-[#2DA4A9]"
              >
                <option value="">— Select a location —</option>
                {locations.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.title}{l.address ? ` (${l.address})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* reply tone */}
            <div>
              <label className="text-xs font-medium text-[#314154]">Reply tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as ReviewCoachTone)}
                className="mt-1 w-full border border-[#D4DEE7] bg-white px-3 py-2 text-xs outline-none focus:border-[#2DA4A9]"
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            {/* fetch & analyze button */}
            <button
              type="button"
              onClick={fetchAndAnalyze}
              disabled={isFetching || isLoading || !selectedLocation}
              className="w-full bg-[#0A1628] hover:bg-[#1a2a4a] disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition-colors"
            >
              {isFetching ? "Fetching reviews…" : isLoading ? "Analyzing…" : "Fetch & Analyze"}
            </button>

            <a
              href="/api/auth/google/disconnect"
              className="text-[10px] text-[#5B6776] hover:text-[#0A1628] flex items-center justify-end gap-1 transition-colors"
            >
              Disconnect
              <span>→</span>
            </a>
          </div>
        )}

        {error && (
          <div className="mt-4 border border-[#FEE2E2] bg-[#FEF2F2] p-3 text-xs text-[#A10F2B]">
            {error}
          </div>
        )}

        {/* results */}
        {result && (
          <div className="mt-4 space-y-4 pb-4">
            {/* summary bar */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Reviews", value: result.summary.totalReviews },
                { label: "Avg ★", value: result.summary.averageRating },
                { label: "Need reply", value: result.summary.needsReplyNow },
              ].map((stat) => (
                <div key={stat.label} className="border border-[#E2E9EF] bg-[#F8FAFB] p-2 text-center">
                  <p className="text-[9px] text-[#5B6776]">{stat.label}</p>
                  <p className="mt-0.5 text-base font-bold text-[#0A1628]">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* top issues */}
            {result.insights.topIssues.length > 0 && (
              <section>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5B6776]">Top Issues</p>
                <div className="space-y-2">
                  {result.insights.topIssues.slice(0, 3).map((issue) => (
                    <div key={issue.key} className="border border-[#E2E9EF] bg-[#F8FAFB] p-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-[#0A1628]">{issue.label}</p>
                        <span className="text-[9px] text-[#5B6776]">{issue.frequencyPercent}%</span>
                      </div>
                      <p className="mt-1 text-[10px] leading-3 text-[#314154]">{issue.recommendedUpdate}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* replies */}
            {result.insights.repliesToPostNow.length > 0 && (
              <section>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5B6776]">Draft Replies</p>
                <div className="space-y-2">
                  {result.insights.repliesToPostNow.slice(0, 3).map((reply) => (
                    <div key={reply.reviewId} className="border border-[#E2E9EF] bg-[#F8FAFB] p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold" style={{ color: STAR_COLORS[reply.rating] ?? "#5B6776" }}>★{reply.rating}</span>
                        <span className="text-[9px] text-[#5B6776]">Review {reply.reviewId.slice(0, 8)}…</span>
                      </div>
                      <p className="mt-1 text-[10px] leading-3 text-[#314154] line-clamp-2">{reply.reviewSnippet}</p>
                      <div className="mt-1.5 border-l-2 border-[#2DA4A9] bg-[#F0F9FA] px-2 py-1">
                        <p className="text-[10px] leading-3 text-[#0A1628] line-clamp-3">{reply.draftReply}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void copy(reply.reviewId, reply.draftReply)}
                        className="mt-1 text-[10px] text-[#2DA4A9] hover:font-semibold transition-all"
                      >
                        {copiedId === reply.reviewId ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-[#E2E9EF] bg-[#F8FAFB] px-4 py-2.5 text-[9px] text-[#5B6776]">
        AI requires GEMINI_API_KEY · Always review before posting
      </div>
    </aside>
  );
}
function TradeshowEmailConfirm({ email, onClose }: { email: string; onClose: () => void }) {
  return (
    <div className="px-6 pb-6 pt-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E6F7F8]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#2DA4A9]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <p className="mt-4 text-base font-medium text-[#0A1628]">Report sent!</p>
      <p className="mt-1 text-base text-[#5B6776]">Sent to <span className="font-medium text-[#0A1628]">{email}</span></p>
      <p className="mt-4 text-base text-[#94A3B8]">Ready when you are.</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center border border-[#D1DCE8] px-5 py-2 text-base text-[#0A1628] transition-colors hover:border-[#2DA4A9] hover:text-[#2DA4A9]"
      >
        Done
      </button>
    </div>
  );
}

function PolicyFooter({ fixed }: { fixed?: boolean }) {
  return (
    <footer
      className={`${fixed ? "fixed" : "relative"} bottom-4 left-1/2 z-20 -translate-x-1/2 text-xs text-[#A7BCCF] print-hidden`}
    >
      <div className="flex items-center gap-2 whitespace-nowrap px-1 py-1">
        <a className="transition-colors hover:text-[#5B6776]" href="https://www.buckysolutions.com/privacy-policy/" target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
        <span>·</span>
        <a className="transition-colors hover:text-[#5B6776]" href="https://www.buckysolutions.com/cookie-policy/" target="_blank" rel="noreferrer">
          Cookie Policy
        </a>
        <span>·</span>
        <a className="transition-colors hover:text-[#5B6776]" href="https://www.buckysolutions.com/terms-and-conditions/" target="_blank" rel="noreferrer">
          Terms and Conditions
        </a>
      </div>
    </footer>
  );
}

function TopographicPanel() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Rich multi-color base gradient */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fbfc_0%,#eef9f8_18%,#e9fdfe_42%,#edf7f1_68%,#faf6ef_100%)] sm:bg-[linear-gradient(135deg,#f0f9f8_0%,#e9fdfe_25%,#e6f4f1_50%,#f5f0e8_75%,#fef8f0_100%)]" />
      
      {/* Brand teal - top left */}
      <div className="absolute -left-32 top-4 h-[240px] w-[240px] rounded-full bg-[#54a2a7]/8 blur-[78px] sm:-left-24 sm:top-16 sm:h-[380px] sm:w-[380px] sm:bg-[#54a2a7]/18 sm:blur-[90px]" />
      
      {/* Vibrant cyan - right side */}
      <div className="absolute right-[-170px] top-[24%] h-[260px] w-[260px] rounded-full bg-[#00a9ba]/12 blur-[88px] sm:right-[-140px] sm:top-[22%] sm:h-[460px] sm:w-[460px] sm:bg-[#00a9ba]/28 sm:blur-[110px]" />
      
      {/* Fresh green - bottom center */}
      <div className="absolute bottom-[-120px] left-1/2 h-[240px] w-[420px] -translate-x-1/2 rounded-full bg-[#5abf7e]/14 blur-[105px] sm:bottom-[-160px] sm:h-[420px] sm:w-[620px] sm:bg-[#5abf7e]/35 sm:blur-[120px]" />
      
      {/* Warm orange accent - top right */}
      <div className="absolute -top-16 -right-32 h-[180px] w-[180px] rounded-full bg-[#ff8a44]/10 blur-[78px] sm:-top-16 sm:-right-32 sm:h-[320px] sm:w-[320px] sm:bg-[#ff8a44]/22 sm:blur-[100px]" />
      
      {/* Deep teal depth - bottom left */}
      <div className="absolute -bottom-28 -left-36 h-[220px] w-[220px] rounded-full bg-[#005056]/4 blur-[95px] sm:-bottom-24 sm:-left-32 sm:h-[360px] sm:w-[360px] sm:bg-[#005056]/10 sm:blur-[110px]" />
      
      {/* Tertiary soft teal - center right */}
      <div className="absolute top-[38%] right-[18%] h-[150px] w-[150px] rounded-full bg-[#befcff]/12 blur-[72px] sm:top-1/3 sm:right-1/4 sm:h-[280px] sm:w-[280px] sm:bg-[#befcff]/20 sm:blur-[90px]" />

      {/* Mobile edge blending so the background eases into device chrome more cleanly */}
      <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(248,251,252,0.92)_0%,rgba(248,251,252,0.55)_55%,rgba(248,251,252,0)_100%)] sm:hidden" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(0deg,rgba(250,246,239,0.96)_0%,rgba(250,246,239,0.62)_50%,rgba(250,246,239,0)_100%)] sm:hidden" />
      
      {/* Glossy overlay for premium depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.28)_42%,rgba(255,255,255,0.50)_100%)] sm:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.20)_40%,rgba(255,255,255,0.38)_100%)]" />
    </div>
  );
}

const DEFAULT_SERVICE_CTA: ServiceCta = {
  badge: "Recommended Service",
  title: "Website conversion tune-up",
  description: "Fix the highest-friction issues first so more visitors turn into booked stays.",
  buttonLabel: "Talk to Bucky's",
  href: "https://www.buckysolutions.com/consulting/",
};

const SERVICE_CTA_BY_KEY: Record<string, ServiceCta> = {
  ssl: {
    badge: "Security Fix",
    title: "Trust and security cleanup",
    description: "Patch SSL and redirect issues so guests stop seeing trust-breaking warnings before they book.",
    buttonLabel: "Fix trust issues",
    href: "https://www.buckysolutions.com/services/cybersecurity/",
  },
  pagespeed: {
    badge: "Speed Sprint",
    title: "Mobile speed improvement sprint",
    description: "Reduce slow load times, heavy assets, and performance bottlenecks that are costing direct bookings.",
    buttonLabel: "Improve speed",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  booking_cta: {
    badge: "Booking Conversion",
    title: "Booking path optimization",
    description: "Make booking buttons, pricing, and conversion paths obvious so high-intent visitors stop dropping out.",
    buttonLabel: "Improve booking flow",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  booking_platform: {
    badge: "Booking System",
    title: "Direct booking setup",
    description: "Add or improve the reservation stack so guests can check availability and book without friction.",
    buttonLabel: "Set up bookings",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  tracking_pixels: {
    badge: "Tracking Setup",
    title: "Analytics and retargeting setup",
    description: "Install GA4, tag management, and retargeting pixels so traffic and campaign ROI become measurable.",
    buttonLabel: "Set up tracking",
    href: "https://www.buckysolutions.com/services/vendor-management/",
  },
  photos: {
    badge: "Visual Refresh",
    title: "Photo and visual conversion refresh",
    description: "Upgrade imagery and page presentation so guests can picture the stay and trust the experience faster.",
    buttonLabel: "Upgrade visuals",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  google_business: {
    badge: "Visibility Boost",
    title: "Local visibility improvement",
    description: "Strengthen your Google Business Profile and discovery signals so more nearby guests actually find you.",
    buttonLabel: "Improve visibility",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  listing_signals: {
    badge: "Listing Boost",
    title: "Marketplace listing cleanup",
    description: "Tighten listing coverage and consistency across discovery channels where guests already shop.",
    buttonLabel: "Strengthen listings",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  social: {
    badge: "Social Presence",
    title: "Social profile cleanup",
    description: "Repair or strengthen your connected social presence so trust signals support booking decisions.",
    buttonLabel: "Fix social signals",
    href: "https://www.buckysolutions.com/services/vendor-management/",
  },
  meta_tags: {
    badge: "Search Visibility",
    title: "Search snippet optimization",
    description: "Rewrite titles and descriptions so your search presence earns more clicks from the right guests.",
    buttonLabel: "Improve search snippets",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  mobile: {
    badge: "Mobile UX",
    title: "Mobile usability fixes",
    description: "Fix viewport, tap targets, and mobile interaction issues that push guests away on phones.",
    buttonLabel: "Fix mobile UX",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  default: DEFAULT_SERVICE_CTA,
};

const getServiceCta = (serviceKey?: string | null): ServiceCta => {
  if (!serviceKey) {
    return DEFAULT_SERVICE_CTA;
  }
  return SERVICE_CTA_BY_KEY[serviceKey] ?? DEFAULT_SERVICE_CTA;
};

const CHECK_CTA_BY_ID: Record<string, Pick<ServiceCta, "buttonLabel" | "href">> = {
  "response-time": {
    buttonLabel: "Speed up load time",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "broken-links": {
    buttonLabel: "Repair broken links",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "pagespeed-mobile": {
    buttonLabel: "Improve mobile score",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "technical-trust-security": {
    buttonLabel: "Fix trust + security setup",
    href: "https://www.buckysolutions.com/services/cybersecurity/",
  },
  "website-technology": {
    buttonLabel: "Get a website assessment",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "human-written-content": {
    buttonLabel: "Improve website copy",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "booking-platform": {
    buttonLabel: "Upgrade booking stack",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "booking-cta": {
    buttonLabel: "Strengthen booking CTA",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "date-picker-discoverability": {
    buttonLabel: "Show date options sooner",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "fee-transparency": {
    buttonLabel: "Fix fee display",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "rate-transparency": {
    buttonLabel: "Improve rate transparency",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "tracking-pixels": {
    buttonLabel: "Set up tracking",
    href: "https://www.buckysolutions.com/services/vendor-management/",
  },
  "pet-policy": {
    buttonLabel: "Add policy content",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "rv-hookup-specs": {
    buttonLabel: "Publish hookup specs",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "big-rig-readiness": {
    buttonLabel: "Add big-rig details",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "arrival-directions-clarity": {
    buttonLabel: "Improve arrival directions",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "ev-extra-vehicle-policy": {
    buttonLabel: "Add vehicle policies",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "amenities-page": {
    buttonLabel: "Build amenities page",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "cancellation-policy": {
    buttonLabel: "Add clear policy",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "checkin-checkout-times": {
    buttonLabel: "Add check-in/out times",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "accessibility-statement": {
    buttonLabel: "Improve accessibility",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "meta-title": {
    buttonLabel: "Improve page titles",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "meta-description": {
    buttonLabel: "Improve meta descriptions",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "gbp-sync": {
    buttonLabel: "Improve GBP visibility",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "local-review-competitiveness": {
    buttonLabel: "Increase review volume",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "social-presence": {
    buttonLabel: "Improve social presence",
    href: "https://www.buckysolutions.com/services/vendor-management/",
  },
  "structured-data": {
    buttonLabel: "Add structured data",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "mobile-viewport": {
    buttonLabel: "Improve mobile rendering",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "phone-conversion-readiness": {
    buttonLabel: "Improve phone booking path",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "accessibility-score": {
    buttonLabel: "Improve accessibility",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "contact-friction": {
    buttonLabel: "Reduce contact friction",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "trust-stack-completeness": {
    buttonLabel: "Strengthen trust signals",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "seasonal-visibility": {
    buttonLabel: "Improve offer visibility",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "sitemap-presence": {
    buttonLabel: "Fix search visibility",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "copyright-freshness": {
    buttonLabel: "Update your website",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "professional-email": {
    buttonLabel: "Set up business email",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
};

const PASS_LEARN_CTA_BY_ID: Record<string, string> = {
  "response-time": "Learn about fast load speed",
  "broken-links": "Learn about link health",
  "pagespeed-mobile": "Learn about mobile speed",
  "technical-trust-security": "Learn about trust signals",
  "website-technology": "Learn about website technology",
  "human-written-content": "Learn about website copy",
  "mobile-viewport": "Learn about mobile readiness",
  "meta-title": "Learn about search signage",
  "meta-description": "Learn about search snippets",
  "booking-platform": "Learn about booking systems",
  "booking-cta": "Learn about booking visibility",
  "date-picker-discoverability": "Learn about date pickers",
  "fee-transparency": "Learn about fee clarity",
  "rate-transparency": "Learn about rate clarity",
  "tracking-pixels": "Learn about guest tracking",
  "pet-policy": "Learn about pet policies",
  "rv-hookup-specs": "Learn about hookup specs",
  "big-rig-readiness": "Learn about rig readiness",
  "arrival-directions-clarity": "Learn about arrival directions",
  "ev-extra-vehicle-policy": "Learn about vehicle policies",
  "amenities-page": "Learn about amenity pages",
  "cancellation-policy": "Learn about cancellation policies",
  "checkin-checkout-times": "Learn about check-in times",
  "accessibility-statement": "Learn about accessibility",
  "gbp-sync": "Learn about Google listings",
  "local-review-competitiveness": "Learn about review strategy",
  "social-presence": "Learn about social presence",
  "structured-data": "Learn about structured data",
  "phone-conversion-readiness": "Learn about phone bookings",
  "accessibility-score": "Learn about accessibility",
  "contact-friction": "Learn about contact ease",
  "trust-stack-completeness": "Learn about trust signals",
  "seasonal-visibility": "Learn about seasonal offers",
  "sitemap-presence": "Learn about XML sitemaps",
  "copyright-freshness": "Learn about copyright years",
  "professional-email": "Learn about business email",
};

const PASS_BENEFIT_BY_ID: Record<string, string> = {
  "response-time": "Fast loading: guests can open your site quickly without frustration, so more high-intent visitors stay on the booking path.",
  "mobile-viewport": "Smartphone ready: your website layout stays readable and easy to use when guests look you up from the road.",
  "meta-title": "Search engine signage: your Google listing label is clear, so the right guests can recognize your park faster.",
  "meta-description": "Your search preview explains the value of your park clearly, improving click quality from potential guests.",
  "broken-links": "All internal links are working correctly. Guests and search engines can navigate your site without hitting dead ends.",
  "pagespeed-mobile": "Your site loads quickly on mobile devices, keeping road-tripping guests engaged instead of bouncing to a competitor.",
  "technical-trust-security": "Your technical trust stack is solid — SSL, HTTPS, and canonical tags are all aligned and working together.",
  "website-technology": "Your site is built on modern technology that loads fast, works well on phones, and doesn't require workarounds for basic features.",
  "human-written-content": "Your website copy reads naturally and includes real details about your property, building trust with guests before they arrive.",
  "booking-platform": "You have an online booking system in place. Guests can check dates and reserve without needing to call or email.",
  "booking-cta": "Your booking button is clearly visible, making it easy for motivated guests to start a reservation right away.",
  "date-picker-discoverability": "Guests can quickly find where to check available dates, reducing friction at the most critical step.",
  "fee-transparency": "All fees are disclosed before the final payment screen, so guests feel informed and are less likely to abandon checkout.",
  "rate-transparency": "Rates are clearly displayed before checkout, building trust and reducing abandoned bookings.",
  "tracking-pixels": "Analytics tracking is installed, giving you visibility into how guests find your site and what they do before booking.",
  "pet-policy": "Your pet policy is published and easy to find. Pet owners can self-qualify before booking, reducing pre-trip calls.",
  "rv-hookup-specs": "Hookup specifications are clearly listed, helping RV travelers confirm compatibility before driving to your property.",
  "big-rig-readiness": "Big-rig details like max length and pull-through availability are visible, so large-rig owners can book with confidence.",
  "arrival-directions-clarity": "Clear arrival directions are published, helping guests navigate confidently and start their stay without stress.",
  "ev-extra-vehicle-policy": "Vehicle and EV policies are visible, reducing checkout hesitation and pre-booking support calls.",
  "amenities-page": "Amenity information is easy to find, giving guests the details they need to picture their stay and commit to booking.",
  "cancellation-policy": "Your cancellation policy is published and clear, building trust and reducing booking hesitation.",
  "checkin-checkout-times": "Posted check-in and check-out times prevent confusion, reduce phone calls, and help guests plan their travel schedule.",
  "accessibility-statement": "Accessibility information is available, helping guests with mobility or access needs plan their visit.",
  "gbp-sync": "Your Google Business Profile is active and consistent with your website, strengthening local search visibility.",
  "local-review-competitiveness": "Your review volume and ratings are competitive locally, supporting trust and search ranking in your area.",
  "social-presence": "Active social profiles are linked from your site, giving guests additional proof that your property is real and active.",
  "structured-data": "Structured data is present on your site, helping Google display rich search results with stars, pricing, and business details.",
  "phone-conversion-readiness": "Your phone booking path is smooth and accessible, capturing guests who prefer to reserve by phone.",
  "accessibility-score": "Your site scores well on accessibility, making it usable for guests with disabilities and improving overall user experience.",
  "contact-friction": "Contacting you is simple and low-friction, so guests with questions can reach you quickly and book faster.",
  "trust-stack-completeness": "Key trust signals — reviews, security, and policies — are visible where guests need them most.",
  "seasonal-visibility": "Current promotions and seasonal offers are prominently displayed, helping convert price-sensitive searchers.",
  "sitemap-presence": "Your XML sitemap is in place, helping search engines find and index all your important pages.",
  "copyright-freshness": "Your copyright year is current, signaling to visitors that your site and business are actively maintained.",
  "professional-email": "A branded business email shows guests they're dealing with a real, established business — not someone's side project.",
};

const PAIN_LEVEL_ORDER: PainLevel[] = ["money-losers", "maintenance-needed", "working-well"];

const PAIN_LEVEL_LABELS: Record<PainLevel, string> = {
  "money-losers": "Money Losers (Fix First)",
  "maintenance-needed": "Maintenance Needed",
  "watchlist": "Monitor and Improve",
  "working-well": "What\'s Working Well",
};

const PAIN_LEVEL_ICON_STYLES: Record<PainLevel, string> = {
  "money-losers": "bg-[#FEE2E2] text-[#B42318]",
  "maintenance-needed": "bg-[#FFE7CC] text-[#B54708]",
  "watchlist": "bg-[#E5EAF0] text-[#51606F]",
  "working-well": "bg-[#DDF5E8] text-[#157347]",
};

const getPainLevelForCheck = (check: ScanCheck): PainLevel => {
  if (check.status === "pass") {
    return "working-well";
  }

  if (check.status === "fail") {
    if (check.impact === "High") {
      return "money-losers";
    }
    if (check.impact === "Medium") {
      return "maintenance-needed";
    }
  }

  return "maintenance-needed";
};

const CATEGORY_SORT_ORDER: Record<CheckCategory, number> = {
  "Does Your Website Work?": 0,
  "Can Guests Book Online?": 1,
  "What Info Are You Missing?": 2,
  "Can Guests Find You?": 3,
  "Are You Losing Guests?": 4,
};

function CheckIcon({ check, className = "h-4 w-4" }: { check: ScanCheck; className?: string }) {
  const Icon = CHECK_ICON_BY_ID[check.id] ?? CATEGORY_ICON_BY_CHECK_CATEGORY[check.category] ?? SparklesIcon;

  return <Icon className={className} aria-hidden="true" />;
}

function PainLevelIcon({ painLevel, className = "h-5 w-5" }: { painLevel: PainLevel; className?: string }) {
  const Icon = PAIN_LEVEL_ICON_BY_KEY[painLevel] ?? ClockIcon;

  return <Icon className={className} aria-hidden="true" />;
}

const getCheckCta = (check?: ScanCheck | null): ServiceCta => {
  if (!check) {
    return DEFAULT_SERVICE_CTA;
  }

  const baseCta = getServiceCta(check.serviceKey);
  const checkCta = CHECK_CTA_BY_ID[check.id];
  if (!checkCta) {
    return baseCta;
  }

  return {
    ...baseCta,
    buttonLabel: checkCta.buttonLabel,
    href: checkCta.href,
  };
};

const getCheckCtaForStatus = (check?: ScanCheck | null): ServiceCta => {
  const cta = getCheckCta(check);
  if (!check || check.status !== "pass") {
    return cta;
  }

  return {
    ...cta,
    buttonLabel: PASS_LEARN_CTA_BY_ID[check.id] ?? "Learn about this strength",
  };
};

const WRITING_HEAVY_CHECK_IDS = new Set([
  "pet-policy",
  "cancellation-policy",
  "accessibility-statement",
  "ev-extra-vehicle-policy",
]);

const COMPETITOR_COMPARE_INTENT_CHECK_IDS = new Set([
  "local-review-competitiveness",
]);

const CHECK_DIRECT_FIX_BY_ID: Record<string, string> = {
  "response-time":
    "Large photo files are the #1 cause of slow websites. Compress your images before uploading using a free tool like Squoosh. Ask your host if they offer caching — it's usually free and makes a huge difference for repeat visitors.",
  "human-written-content":
    "Go through your homepage and replace any generic phrases like 'unforgettable experience' or 'world-class amenities' with real details about your property. Instead of 'enjoy our beautiful campground,' say something like 'our 12 wooded pull-throughs sit along the creek with direct trail access.' The more specific you are, the more trustworthy your site sounds to real guests.",
  "website-technology":
    "If your site was built more than 5 years ago or runs on old technology like jQuery 1.x, Bootstrap 2/3, or an ancient WordPress version, patching it usually isn't worth the cost — a modern rebuild is faster, cheaper in the long run, and will perform dramatically better on phones. Talk to a web professional about options.",
  "broken-links":
    "Broken links often happen when you update a page or rename something and forget to update the links pointing to it. Walk through your main navigation, footer, and any 'Book Now' buttons and click each one to make sure they still work. A free tool like Dead Link Checker (deadlinkchecker.com) can scan your whole site automatically and list every broken link in one report.",
  "pagespeed-mobile":
    "The fastest way to fix this is to share the PageSpeed report below with your web developer or hosting provider. They'll see exactly which files are slowing you down and how to fix them. If you're doing it yourself, focus on compressing photos, removing unused plugins, and turning off auto-play videos.",
  "pet-policy":
    "Pet owners look for pet-friendly parks before booking, so make it obvious on your site what pets are allowed, any size or breed limits, any extra fees, and leash rules. If you do not want to write that yourself, hit the AI button below and let it draft the policy for you.",
  "rv-hookup-specs":
    "RV travelers need to know if your hookups match their rig before they drive hours to get there. List the details for each site type: 30-amp or 50-amp power, water hookup, sewer connection (full hookup, water and electric only, dry camping, etc.), and max rig length if there's a limit. A simple table or bullet list on your site pages is enough — don't make guests call to find out.",
  "big-rig-readiness":
    "Add two details right next to site selection: maximum rig length and whether each site is pull-through or back-in. Big-rig owners will skip booking if they cannot confirm fit in seconds.",
  "arrival-directions-clarity":
    "Create a short 'Getting Here' section with the exact entrance instructions and any GPS warnings (like low-clearance bridges or roads to avoid). This prevents stressful arrivals and angry first impressions.",
  "ev-extra-vehicle-policy":
    "Publish a simple vehicle policy page that answers two common questions: EV charging rules and extra vehicle fees/limits. Clear rules reduce pre-booking calls and checkout hesitation.",
  "amenities-page":
    "A clear amenities page helps guests picture their stay and decide to book. List everything you offer — pool, bathhouses, laundry, fire pits, store, dog park, playground, Wi-Fi — and for each one, add a photo and a short note like the hours or location. Guests who can visualize the experience are much more likely to book.",
  "cancellation-policy":
    "Guests won't book if they're afraid of losing money on a non-refundable reservation. Put your cancellation policy in plain language on your site: how many days ahead someone needs to cancel, whether they get a full refund or a credit, and whether there are exceptions for weather or emergencies. If needed, use AI to write a plain-English version for you, then paste it onto your site. Link to your policy from the booking page so guests see it before they pay.",
  "accessibility-statement":
    "If your park has accessible routes, restrooms, or campsites, say so on your site — guests with mobility needs will specifically look for this information. List what's available: paved or hard-packed paths, accessible restrooms or shower rooms, ADA-designated sites, and a phone number or email for guests who need to ask questions. If you are not sure how to word it, use AI to draft the statement for you and paste it onto your site. If accessibility is limited, being honest about it is still better than leaving guests to guess.",
  "meta-title":
    "Your page title is what shows up as the blue link in Google search results. To improve it, include your property name, location, and what you offer — something like \"Shady Pines RV Park | Full Hookup Sites in Asheville, NC.\" If you want help phrasing it, use AI to generate a few options, then paste the best one into your SEO settings in Squarespace, Wix, or WordPress.",
  "meta-description":
    "The short text that appears under your link in Google search results is called a meta description. Most platforms let you edit this under \"SEO Settings\" for each page. Write 1–2 sentences that describe what makes your park worth booking, mention your location, and end with something actionable like \"Book your site online today.\" If you do not want to write it yourself, use AI to draft it, then paste it into your page settings. Keep it under 155 characters so Google doesn't cut it off.",
  "gbp-sync":
    "Your Google Business Profile is often the first thing people see when they search your park. Log in at business.google.com and make sure your address, phone number, and website link are correct. Add recent photos (at least 10), fill in your hours, select the right business categories (like RV Park or Campground), and post an update at least once a month. Profiles that are active and complete rank higher and get more calls.",
  "local-review-competitiveness":
    "To improve local win-rate, ask for fresh Google reviews weekly and reply to every review quickly. Review volume and recency often decide who gets the click when guests compare nearby parks.",
  "social-presence":
    "An active social media presence reassures guests that your park is open and well-maintained. Post a photo or short video at least once or twice a week — it doesn't need to be professional. A quick shot of a sunset, a fire pit, or happy guests goes a long way. Make sure the links on your website point to your real active pages, not an old or unused account.",
  "mobile-viewport":
    "When a site doesn't display correctly on phones, text appears tiny, buttons are too small to tap, and guests have to pinch and zoom just to read anything. This is usually a settings issue rather than a big redesign. If your site is on a platform like Squarespace, Wix, or WordPress, open the mobile preview and check how each page looks. Ask your web person to confirm that the mobile viewport tag is set correctly — it's a quick fix.",
  "phone-conversion-readiness":
    "Put your phone number at the top of mobile pages and make it tap-to-call. Add simple wording like 'Call now for same-day availability' near the number so guests know what to do. If people have to search for your number or copy-paste it, you lose calls.",
  "rate-transparency":
    "Guests often abandon a booking when the price jumps unexpectedly at checkout. To avoid this, show your nightly rate early — before guests click into the booking flow. If there's a cleaning fee, reservation fee, or tax, mention the approximate total somewhere visible so the final number isn't a surprise. Even a line like \"Sites from $45/night, fees apply\" builds more trust than showing a price for the first time at payment.",
  "contact-friction":
    "If the only way to contact you is a long form with 8 fields, many guests won't bother. Simplify your contact page to just the basics — name, email, and message. Better yet, also show a phone number, your typical response time, and a link to your booking page for guests who just want to reserve. The easier you make it to reach you, the more inquiries you'll get.",
  "trust-stack-completeness":
    "Show your key trust signals in obvious places: secure site (https), clear cancellation policy, and real guest reviews. Guests should not need to dig for these basics before paying. A few trust signals in the booking path can make the difference between hesitation and reservation.",
  "seasonal-visibility":
    "If you're running a summer special or a fall deal, make sure guests can actually see it. Put your current promotion near the top of your homepage where it's impossible to miss — not buried in a blog post or a footer banner. Something as simple as a bold headline that says \"Book by July 4th and save 15%\" with a direct link to availability is enough to move reservations. If you need help writing the offer, use AI to generate the promo text and paste it onto your homepage.",
  "sitemap-presence":
    "Most website platforms (WordPress, Squarespace, Wix) can generate a sitemap automatically — search your platform's help docs for 'XML sitemap.' If yours doesn't have one, ask your web person to add a sitemap plugin or generate one with a free tool like XML-Sitemaps.com. Once it exists at yoursite.com/sitemap.xml, submit it to Google Search Console so Google knows about all your pages.",
  "copyright-freshness":
    "Scroll to the bottom of your website and update the year in your copyright notice to the current year. On most platforms, this is a quick edit in your footer settings. Some platforms let you use a dynamic year that updates automatically so you never have to think about it again.",
  "professional-email":
    "Get a branded email address like info@yourpark.com or reservations@yourpark.com. Most hosting providers include email with your domain for free or a few dollars a month. Google Workspace and Microsoft 365 both offer professional email starting at about $6/month. Once you have it, update the email address on your website, Google Business Profile, and booking confirmations.",
  "checkin-checkout-times":
    "Add your check-in and check-out times to your FAQ page, booking confirmation page, and ideally your homepage too. Something like 'Check-in: 3:00 PM / Check-out: 11:00 AM' is all it takes. If you have early check-in or late check-out available for an extra fee, mention that too — it's an easy upsell.",
  "fee-transparency":
    "Guests don't mind paying fees — they mind being surprised by them. Show your cleaning fee, reservation fee, or any other mandatory charges on your rates page or booking page before the final payment screen. A simple line like \"A $15 reservation fee applies\" is all it takes. When guests feel informed, they're more likely to complete the booking instead of abandoning it.",
  "structured-data":
    "Ask your web developer to add JSON-LD structured data to your homepage. Use LodgingBusiness or LocalBusiness as the type, include your address, phone, price range, and aggregate ratings if available. Google's Structured Data Markup Helper can generate the code — then paste it into your site's HTML head. This helps Google show rich results with stars and pricing for your property.",
  "accessibility-score":
    "Start with the biggest wins: add alt text to all images, make sure form fields have labels, check that text contrast meets a 4.5:1 ratio, and use proper heading hierarchy (h1, h2, h3). Free tools like WAVE or axe DevTools can scan your site and show exactly which elements need fixing. Most fixes take a few minutes each.",
};

const condenseFixCopy = (copy: string): string => {
  const normalized = copy.replace(/\s+/g, " ").trim();
  const sentences = normalized.match(/[^.!?]+[.!?]/g) ?? [normalized];

  if (sentences.length <= 2) {
    return normalized;
  }

  const firstTwo = sentences.slice(0, 2).join(" ").trim();
  if (firstTwo.length >= 210) {
    return firstTwo;
  }

  return sentences.slice(0, 3).join(" ").trim();
};

const CHECK_DISPLAY_LABEL_BY_ID: Record<string, string> = {
  "technical-trust-security": "Technical trust & security",
  "response-time": "Fast loading",
  "broken-links": "Working website links",
  "pagespeed-mobile": "Phone loading speed",
  "human-written-content": "Human-written content",
  "website-technology": "Website technology",
  "copyright-freshness": "Copyright year",
  "booking-platform": "Online booking system",
  "booking-cta": "Book now visibility",
  "date-picker-discoverability": "Date picker visibility",
  "fee-transparency": "Fee transparency",
  "tracking-pixels": "Guest follow-up tracking",
  "pet-policy": "Pet policy visibility",
  "rv-hookup-specs": "RV hookup details",
  "big-rig-readiness": "Big-rig readiness",
  "arrival-directions-clarity": "Arrival directions clarity",
  "ev-extra-vehicle-policy": "EV and extra-vehicle policy",
  "amenities-page": "Amenities visibility",
  "cancellation-policy": "Cancellation policy visibility",
  "accessibility-statement": "Accessibility information",
  "meta-title": "Search engine signage",
  "meta-description": "Search result description",
  "gbp-sync": "Google listing strength",
  "local-review-competitiveness": "Local review competitiveness",
  "social-presence": "Social media presence",
  "structured-data": "Structured data for search",
  "sitemap-presence": "XML sitemap",
  "mobile-viewport": "Smartphone readiness",
  "phone-conversion-readiness": "Phone booking readiness",
  "accessibility-score": "Accessibility score",
  "rate-transparency": "Price clarity",
  "contact-friction": "Contact convenience",
  "trust-stack-completeness": "Booking trust signals",
  "seasonal-visibility": "Seasonal offer visibility",
  "professional-email": "Business email",
  "checkin-checkout-times": "Check-in / check-out times",
};

const getCheckDisplayLabel = (check?: ScanCheck | null): string => {
  if (!check) {
    return "";
  }

  return CHECK_DISPLAY_LABEL_BY_ID[check.id] ?? check.name;
};

const getCheckFooterMeta = (check?: ScanCheck | null): string | null => {
  if (!check?.effort) return null;

  switch (check.effort) {
    case "Low":
      return "Easy · 5 mins";
    case "Medium":
      return "Medium · 15 mins";
    case "High":
      return "Hard · 30+ mins";
    default:
      return null;
  }
};

const getCheckHeadline = (check?: ScanCheck | null): string => {
  if (!check) return "";
  const p = check.status === "pass";
  const f = check.status === "fail";
  switch (check.id) {
    case "technical-trust-security":
      return p ? "Technical trust and security are solid" : f ? "Technical trust and security need cleanup" : "Technical trust setup needs one more step";
    case "pagespeed-mobile":
      return p ? "Site loads fast on phones" : f ? "Site loads slowly on phones" : "Phone load speed is borderline";
    case "human-written-content":
      return p ? "Content feels human and trustworthy" : f ? "Content feels over-templated" : "Content authenticity needs review";
    case "website-technology":
      return p ? "Website technology is up to date" : f ? "Outdated website technology" : "Website technology could use an update";
    case "copyright-freshness":
      return p ? "Copyright year is current" : f ? "Copyright year is outdated" : "No copyright year found";
    case "response-time":
      return p ? "Website responds quickly" : f ? "Website is slow to respond" : "Website response is borderline";
    case "broken-links":
      return p ? "No broken links found" : f ? "Some links on the site are broken" : "One or more links may be broken";
    case "date-picker-discoverability":
      return p ? "Guests can start date search quickly" : f ? "Date search is hard to find" : "Date search visibility needs review";
    case "big-rig-readiness":
      return p ? "Big-rig details are clearly posted" : f ? "Big-rig details are missing" : "Big-rig details are partially visible";
    case "arrival-directions-clarity":
      return p ? "Arrival directions are clear" : f ? "Arrival directions are hard to find" : "Arrival instructions need more detail";
    case "ev-extra-vehicle-policy":
      return p ? "Vehicle policies are clearly posted" : f ? "Vehicle policies are missing" : "Vehicle policies are partial";
    case "booking-cta":
      return p ? "Book now button is easy to find" : f ? "Book now button is hard to find" : "Book now button could be clearer";
    case "booking-platform":
      return p ? "Guests can book online" : f ? "No online booking found" : "Online booking needs review";
    case "local-review-competitiveness":
      return p ? "Review strength looks competitive" : f ? "Review strength trails local competition" : "Review competitiveness is borderline";
    case "fee-transparency":
      return p ? "All fees are shown up front" : f ? "Guests see surprise fees" : "Fee timing could be clearer";
    case "rate-transparency":
      return p ? "Nightly rates are easy to find" : f ? "Nightly rates are hard to find" : "Pricing could be easier to find";
    case "cancellation-policy":
      return p ? "Cancellation policy is easy to find" : f ? "No cancellation policy found" : "Cancellation policy is hard to find";
    case "tracking-pixels":
      return p ? "Ad retargeting is active" : f ? "Ad retargeting isn't set up" : "Ad retargeting needs attention";
    case "pet-policy":
      return p ? "Pet policy is clearly posted" : f ? "Pet policy is missing or unclear" : "Pet policy could be clearer";
    case "rv-hookup-specs":
      return p ? "RV hookup details are listed" : f ? "RV hookup details are missing" : "RV hookup info could be clearer";
    case "amenities-page":
      return p ? "Amenities are clearly listed" : f ? "Amenities aren't listed anywhere" : "Amenities page could be improved";
    case "accessibility-statement":
      return p ? "ADA accessibility info is posted" : f ? "No ADA accessibility info found" : "Accessibility statement needs attention";
    case "meta-title":
      return p ? "Google page title is set up well" : f ? "Google page title needs work" : "Google page title could be stronger";
    case "meta-description":
      return p ? "Google search preview text is set" : f ? "Google search preview text is missing" : "Google preview text could be better";
    case "gbp-sync":
      return p ? "Google listing looks complete" : f ? "Google listing looks incomplete" : "Google listing needs attention";
    case "social-presence":
      return p ? "Active on social media" : f ? "Hard to find on social media" : "Social media presence is limited";
    case "mobile-viewport":
      return p ? "Site looks good on phones" : f ? "Site doesn't display well on phones" : "Phone display needs attention";
    case "phone-conversion-readiness":
      return p ? "Phone call path is conversion-ready" : f ? "Phone call path is weak" : "Phone call path needs tuning";
    case "contact-friction":
      return p ? "Easy to get in touch" : f ? "Hard to get in touch" : "Contact info could be easier to find";
    case "trust-stack-completeness":
      return p ? "Trust signals are strong" : f ? "Trust signals are too weak" : "Trust signals are incomplete";
    case "seasonal-visibility":
      return p ? "Seasonal deals are easy to spot" : f ? "No seasonal deals visible to guests" : "Seasonal offers could be more visible";
    case "professional-email":
      return p ? "Business email looks professional" : f ? "Personal email used for business" : "Email setup could be stronger";
    case "checkin-checkout-times":
      return p ? "Check-in and check-out times are posted" : f ? "Check-in and check-out times are missing" : "Check-in/check-out times need review";
    case "structured-data":
      return p ? "Rich search data is in place" : f ? "No structured data for search engines" : "Structured data is partial";
    case "sitemap-presence":
      return p ? "XML sitemap is in place" : f ? "No XML sitemap found" : "Sitemap needs review";
    case "accessibility-score":
      return p ? "Accessibility score is strong" : f ? "Accessibility needs improvement" : "Accessibility score is borderline";
    default: {
      if (p) return "This check passed";
      if (f) return "This check found an issue";
      return "This check needs review";
    }
  }
};

export default function Home() {
  const pathname = usePathname();
  const [step, setStep] = useState<AppStep>("landing");
  const [urlInput, setUrlInput] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedPulse, setSelectedPulse] = useState("");
  const [questionsComplete, setQuestionsComplete] = useState(false);
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
  const [tradeshowEmailModalOpen, setTradeshowEmailModalOpen] = useState(false);
  const [tradeshowEmailSent, setTradeshowEmailSent] = useState(false);
  const [tradeshowConsentEmailCopy, setTradeshowConsentEmailCopy] = useState(false);
  const [tradeshowConsentMarketing, setTradeshowConsentMarketing] = useState(false);
  const [hasSubmittedTradeshowLead, setHasSubmittedTradeshowLead] = useState(false);
  const [isReportUnlocked, setIsReportUnlocked] = useState(false);
  const [urlInputShakeCount, setUrlInputShakeCount] = useState(0);
  const [emailInputShakeCount, setEmailInputShakeCount] = useState(0);
  const [hubspotContactId, setHubspotContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactSearchResults, setContactSearchResults] = useState<HubSpotContactOption[]>([]);
  const [isContactSearchOpen, setIsContactSearchOpen] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [selectedContactWebsite, setSelectedContactWebsite] = useState("");
  const [pendingProtectedAction, setPendingProtectedAction] = useState<ProtectedAction | null>(null);
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [isGeneratingQrCode, setIsGeneratingQrCode] = useState(false);
  const [isGeneratingAiFix, setIsGeneratingAiFix] = useState(false);
  const [aiFixDraftByCheckId, setAiFixDraftByCheckId] = useState<Record<string, string>>({});
  const [aiFixCopied, setAiFixCopied] = useState(false);
  const [aiFixError, setAiFixError] = useState("");
  const [isComparingLocalReviews, setIsComparingLocalReviews] = useState(false);
  const [localReviewCompareError, setLocalReviewCompareError] = useState("");
  const [localReviewCompareByCheckId, setLocalReviewCompareByCheckId] = useState<Record<string, LocalReviewCompareResult>>({});
  const [partialLoadingMessageIndex, setPartialLoadingMessageIndex] = useState(0);
  const [previousScanResult, setPreviousScanResult] = useState<ScanResponse | null>(null);
  const [collapsedPainGroups, setCollapsedPainGroups] = useState<Partial<Record<PainLevel, boolean>>>({});
  const [isHydratingSharedReport, setIsHydratingSharedReport] = useState(() => Boolean(getReportIdFromPathname(pathname ?? "")));
  const [engagementIssueClicks, setEngagementIssueClicks] = useState(0);
  const [isReviewCoachOpen, setIsReviewCoachOpen] = useState(false);
  const [hasShownEngagementPrompt, setHasShownEngagementPrompt] = useState(false);
  const [hasClosedSecondIssue, setHasClosedSecondIssue] = useState(false);
  const [secondIssueCloseScrollY, setSecondIssueCloseScrollY] = useState<number | null>(null);
  const landingInputRef = useRef<HTMLInputElement | null>(null);
  const scanRequestRef = useRef(0);
  const loadingStartRef = useRef<number | null>(null);
  const reportSectionRef = useRef<HTMLElement | null>(null);
  const capturedAuditReportsRef = useRef<Set<string>>(new Set());
  const hydratedFromSavedReportRef = useRef(false);
  const previousFlippedCardIdRef = useRef<string | null>(null);
  const saveAuditSessionRef = useRef<((leadEmail?: string, options?: SaveAuditSessionOptions) => Promise<{ stored: boolean; emailSent: boolean; email: string }>) | null>(null);


  const selectedPropertyType = (answers.property_type?.value as IndustryKey | undefined) ?? "campground";
  const selectedChallenge = answers.primary_challenge?.value ?? "converting-visitors";
  const selectedPropertySize = answers.property_size?.value;
  const activeCheck = useMemo(
    () => scanResult?.checks.find((check) => check.id === flippedCardId) ?? null,
    [flippedCardId, scanResult],
  );

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

  useEffect(() => {
    if (!activeCheck) {
      document.body.style.overflow = "";
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFlippedCardId(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeCheck]);

  const currentQuestion = questionsComplete ? null : GUIDED_QUESTIONS[questionIndex] ?? null;

  const finalScore = scanResult?.score ?? 0;
  const letterGrade = scoreToLetterGrade(finalScore);
  const displayReportUrl = useMemo(() => formatDisplayUrl(reportUrl), [reportUrl]);
  const emailInputError = !isReportUnlocked ? leadNotice : "";
  const activeCheckCta = useMemo(() => getCheckCtaForStatus(activeCheck), [activeCheck]);
  const activeCheckNeedsAi = useMemo(
    () => Boolean(activeCheck && WRITING_HEAVY_CHECK_IDS.has(activeCheck.id)),
    [activeCheck],
  );
  const activeCheckNeedsCompareIntent = useMemo(
    () => Boolean(activeCheck && COMPETITOR_COMPARE_INTENT_CHECK_IDS.has(activeCheck.id)),
    [activeCheck],
  );
  const activeCheckDirectFix = useMemo(() => {
    if (!activeCheck) {
      return "";
    }

    return condenseFixCopy(
      CHECK_DIRECT_FIX_BY_ID[activeCheck.id] ??
      "Start with the simplest fix first: read the details above, make the change on your website, then re-run this audit to confirm it's resolved."
    );
  }, [activeCheck]);
  const activeCheckBenefit = useMemo(() => {
    if (!activeCheck) {
      return "";
    }

    const fallbackBenefit = activeCheck.details.trim();

    return (
      PASS_BENEFIT_BY_ID[activeCheck.id] ??
      (fallbackBenefit ||
      "This is a healthy signal that builds trust and supports smoother bookings."
      )
    );
  }, [activeCheck]);

  const showFixContent = true;

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

  const emailShareLink = useMemo(() => {
    if (!shareLink) {
      return "";
    }
    const subject = "My ParkGrader audit report";
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareMessage)}`;
  }, [shareLink, shareMessage]);

  const smsShareLink = useMemo(() => {
    if (!shareLink) {
      return "";
    }
    return `sms:?&body=${encodeURIComponent(shareMessage)}`;
  }, [shareLink, shareMessage]);

  useEffect(() => {
    let cancelled = false;

    const generateQrCode = async () => {
      if (!shareLink) {
        setQrCodeDataUrl("");
        return;
      }

      setIsGeneratingQrCode(true);
      try {
        const dataUrl = await QRCode.toDataURL(shareLink, {
          width: 176,
          margin: 1,
          errorCorrectionLevel: "M",
          color: {
            dark: "#0A1628",
            light: "#FFFFFF",
          },
        });

        if (!cancelled) {
          setQrCodeDataUrl(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setQrCodeDataUrl("");
        }
      } finally {
        if (!cancelled) {
          setIsGeneratingQrCode(false);
        }
      }
    };

    void generateQrCode();

    return () => {
      cancelled = true;
    };
  }, [shareLink]);

  const generateAiFix = useCallback(async () => {
    if (!activeCheck || !scanResult || !reportUrl || isGeneratingAiFix) {
      return;
    }

    if (aiFixDraftByCheckId[activeCheck.id]) {
      return;
    }

    setIsGeneratingAiFix(true);
    setAiFixError("");

    try {
      const response = await fetch("/api/generate-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: reportUrl,
          industryLabel: scanResult.industryLabel,
          checkId: activeCheck.id,
          checkName: activeCheck.name,
          finding: activeCheck.finding,
          details: activeCheck.details,
        }),
      });

      const payload = (await response.json()) as { fix?: string; message?: string };
      if (!response.ok || !payload.fix) {
        throw new Error(payload.message ?? "Unable to generate AI fix right now.");
      }

      const nextDraft = payload.fix.trim();
      const nextAiFixDraftByCheckId = {
        ...aiFixDraftByCheckId,
        [activeCheck.id]: nextDraft,
      };
      setAiFixDraftByCheckId(nextAiFixDraftByCheckId);
      await saveAuditSessionRef.current?.(undefined, {
        sendEmailCopy: false,
        aiFixDraftByCheckIdOverride: nextAiFixDraftByCheckId,
      });
    } catch (error) {
      setAiFixError(error instanceof Error ? error.message : "Unable to generate AI fix right now.");
    } finally {
      setIsGeneratingAiFix(false);
    }
  }, [activeCheck, aiFixDraftByCheckId, isGeneratingAiFix, reportUrl, scanResult]);

  const triggerCompetitorCompareIntent = useCallback(async () => {
    if (!activeCheck || activeCheck.id !== "local-review-competitiveness") {
      return;
    }

    if (!reportUrl || isComparingLocalReviews || localReviewCompareByCheckId[activeCheck.id]) {
      return;
    }

    setIsComparingLocalReviews(true);
    setLocalReviewCompareError("");

    try {
      const response = await fetch("/api/local-review-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: reportUrl, reportId }),
      });

      const payload = (await response.json()) as LocalReviewCompareResult | { message?: string };
      if (!response.ok || !("subject" in payload)) {
        throw new Error("message" in payload ? (payload.message ?? "Unable to compare local reviews right now.") : "Unable to compare local reviews right now.");
      }

      const nextLocalReviewCompareByCheckId = {
        ...localReviewCompareByCheckId,
        [activeCheck.id]: payload,
      };

      setLocalReviewCompareByCheckId(nextLocalReviewCompareByCheckId);
      await saveAuditSessionRef.current?.(undefined, {
        sendEmailCopy: false,
        localReviewCompareByCheckIdOverride: nextLocalReviewCompareByCheckId,
      });
    } catch (error) {
      setLocalReviewCompareError(error instanceof Error ? error.message : "Unable to compare local reviews right now.");
    } finally {
      setIsComparingLocalReviews(false);
    }
  }, [activeCheck, isComparingLocalReviews, localReviewCompareByCheckId, reportId, reportUrl]);

  useEffect(() => {
    setAiFixError("");
    setAiFixCopied(false);
    setLocalReviewCompareError("");
  }, [activeCheck?.id]);

  const generatePdfReport = useCallback(async () => {
    if (typeof window === "undefined" || isGeneratingPdf) {
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const reportMarkup = reportSectionRef.current?.outerHTML;
      if (!reportMarkup) {
        window.print();
        return;
      }

      const headContent = Array.from(document.head.querySelectorAll("style, link[rel='stylesheet']"))
        .map((node) => node.outerHTML)
        .join("\n");
      const title = `${displayReportUrl || "parkgrader-report"}-audit`;

      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const printDocument = iframe.contentDocument;
      const printWindow = iframe.contentWindow;
      if (!printDocument || !printWindow) {
        iframe.remove();
        window.print();
        return;
      }

      printDocument.open();
      printDocument.write(`
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>${title}</title>
            <base href="${window.location.origin}" />
            ${headContent}
            <style>
              html, body {
                background: #ffffff !important;
              }

              body {
                margin: 0 !important;
              }

              .report-print-shell {
                min-height: 100vh;
                background: #ffffff;
              }

              .report-print-shell .print-hidden {
                display: none !important;
              }

              .report-print-shell .report-page {
                min-height: auto !important;
                background: #ffffff !important;
              }

              .report-print-shell .report-page * {
                animation: none !important;
                transition: none !important;
              }

              .report-print-shell .report-page [style*="opacity: 0"] {
                opacity: 1 !important;
              }

              .report-print-shell .report-page [style*="transform"] {
                transform: none !important;
              }

              .report-print-shell .report-page [style*="path-length"] {
                stroke-dasharray: none !important;
                stroke-dashoffset: 0 !important;
              }
            </style>
          </head>
          <body>
            <div class="report-print-shell">${reportMarkup}</div>
          </body>
        </html>
      `);
      printDocument.close();

      const waitForImages = async () => {
        const images = Array.from(printDocument.images);
        if (images.length === 0) {
          return;
        }

        await Promise.race([
          Promise.all(
            images.map(
              (image) =>
                new Promise<void>((resolve) => {
                  if (image.complete) {
                    resolve();
                    return;
                  }
                  image.addEventListener("load", () => resolve(), { once: true });
                  image.addEventListener("error", () => resolve(), { once: true });
                }),
            ),
          ),
          new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), 2200);
          }),
        ]);
      };

      await Promise.race([
        new Promise<void>((resolve) => {
          if (printDocument.readyState === "complete") {
            resolve();
            return;
          }
          printWindow.addEventListener("load", () => resolve(), { once: true });
        }),
        new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), 1200);
        }),
      ]);

      await waitForImages();
      await new Promise<void>((resolve) => printWindow.setTimeout(() => resolve(), 250));

      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => iframe.remove();
      window.setTimeout(() => {
        iframe.remove();
      }, 4000);
    } finally {
      window.setTimeout(() => {
        setIsGeneratingPdf(false);
      }, 300);
    }
  }, [displayReportUrl, isGeneratingPdf]);

  const syncReportPath = useCallback((nextReportId: string) => {
    if (typeof window === "undefined") {
      return;
    }
    window.history.replaceState({}, "", `/r/${encodeURIComponent(nextReportId)}`);
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
      const reportSnapshotPayload: ReportSnapshot = {
        reportId: nextReportId,
        reportUrl,
        scanResult,
        aiFixDraftByCheckId: options?.aiFixDraftByCheckIdOverride ?? aiFixDraftByCheckId,
        localReviewCompareByCheckId:
          options?.localReviewCompareByCheckIdOverride ?? localReviewCompareByCheckId,
        previousScanResult: previousScanResult || undefined,
        answers,
        name,
        propertyName,
        email: normalizedEmail,
        emailConfirmation,
        savedAt: new Date().toISOString(),
        demoMode,
      };

      const payload = {
        email: normalizedEmail || undefined,
        name,
        property_name: propertyName,
        url: reportUrl,
        score: scanResult.score ?? 0,
        property_type: selectedPropertyType,
        primary_challenge: selectedChallenge,
        property_size: selectedPropertySize ?? "25-75",
        scan_date: new Date().toISOString(),
        report_id: nextReportId,
        report_snapshot: reportSnapshotPayload,
        send_email_copy: Boolean(options?.sendEmailCopy),
        hubspot_contact_id: hubspotContactId || undefined,
        tradeshow_consent_email: isTradeshowMode ? tradeshowConsentEmailCopy : undefined,
        tradeshow_consent_marketing: isTradeshowMode ? tradeshowConsentMarketing : undefined,
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
        email_sent?: boolean;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(result.message ?? "Unable to save lead.");
      }

      return {
        stored: Boolean(result.stored),
        emailSent: Boolean(result.email_sent),
        email: normalizedEmail,
      };
    },
    [
      answers,
      aiFixDraftByCheckId,
      demoMode,
      email,
      emailConfirmation,
      hubspotContactId,
      isTradeshowMode,
      localReviewCompareByCheckId,
      name,
      previousScanResult,
      propertyName,
      reportId,
      reportUrl,
      scanResult,
      selectedChallenge,
      selectedPropertySize,
      selectedPropertyType,
      syncReportPath,
      tradeshowConsentEmailCopy,
      tradeshowConsentMarketing,
    ],
  );

  saveAuditSessionRef.current = saveAuditSession;

  const runScan = useCallback(async (site: string, industry: IndustryKey) => {
    scanRequestRef.current += 1;
    const requestId = scanRequestRef.current;
    setIsScanning(true);
    setScanError("");
    const startedAt = Date.now();

    try {
      const response = await fetch(`/api/scan?url=${encodeURIComponent(site)}&industry=${encodeURIComponent(industry)}`);
      const payload = (await response.json()) as ScanResponse | { message: string };
      if (!response.ok || !("checks" in payload)) {
        throw new Error("message" in payload ? payload.message : "Scan failed");
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed < 2800) {
        await new Promise((resolve) => setTimeout(resolve, 2800 - elapsed));
      }
      if (requestId !== scanRequestRef.current) {
        return;
      }
      setPreviousScanResult(scanResult);
      setScanResult(payload);
      setReportUrl(payload.url);
    } catch (error) {
      if (requestId !== scanRequestRef.current) {
        return;
      }
      setScanError(error instanceof Error ? error.message : "Unable to complete scan.");
      setStep("landing");
    } finally {
      if (requestId === scanRequestRef.current) {
        setIsScanning(false);
      }
    }
  }, []);

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
    setQuestionIndex(0);
    setQuestionsComplete(false);
    setScanResult(null);
    setLeadNotice("");
    setEmailConfirmation("");
    setCopied(false);
    setReportId("");
    setDisplayScore(0);
    setTradeshowEmailModalOpen(false);
    setTradeshowEmailSent(false);
    setTradeshowConsentEmailCopy(false);
    setTradeshowConsentMarketing(false);
    setHasSubmittedTradeshowLead(false);
    setContactSearch("");
    setContactSearchResults([]);
    setIsContactSearchOpen(false);
    setSelectedContactWebsite("");
    setAiFixDraftByCheckId({});
    setLocalReviewCompareByCheckId({});
    setFlippedCardId(null);
    setEngagementIssueClicks(0);
    setHasShownEngagementPrompt(false);
    setHasClosedSecondIssue(false);
    setSecondIssueCloseScrollY(null);
    setIsReportUnlocked(isTradeshowMode);
    hydratedFromSavedReportRef.current = false;
    loadingStartRef.current = null;
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
    }
    setReportUrl(normalized);
    setStep("guided");
    void runScan(normalized, "campground");
  };

  const selectAnswer = (option: AnswerOption) => {
    if (!currentQuestion) {
      return;
    }
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }));
    if (currentQuestion.id === "property_type") {
      const nextIndustry = option.value as IndustryKey;
      if (reportUrl) {
        void runScan(reportUrl, nextIndustry);
      }
    }
    setSelectedPulse(`${currentQuestion.id}-${option.value}`);
    window.setTimeout(() => {
      setSelectedPulse("");
      if (questionIndex < GUIDED_QUESTIONS.length - 1) {
        setQuestionIndex((value) => value + 1);
      } else {
        setQuestionsComplete(true);
        setStep("partial");
      }
    }, 350);
  };

  const hydrateSnapshot = useCallback((snapshot: ReportSnapshot) => {
    hydratedFromSavedReportRef.current = true;
    setReportId(snapshot.reportId);
    setReportUrl(snapshot.reportUrl);
    setScanResult(snapshot.scanResult);
    setAiFixDraftByCheckId(snapshot.aiFixDraftByCheckId ?? {});
    setLocalReviewCompareByCheckId(snapshot.localReviewCompareByCheckId ?? {});
    setPreviousScanResult(snapshot.previousScanResult ?? null);
    setAnswers(snapshot.answers);
    setName(snapshot.name);
    setPropertyName(snapshot.propertyName);
    setEmail(snapshot.email);
    setEmailConfirmation(snapshot.emailConfirmation);
    setDemoMode(snapshot.demoMode);
    const unlocked = Boolean(snapshot.email) || Boolean(snapshot.demoMode) || isTradeshowMode;
    setIsReportUnlocked(unlocked);
    setEngagementIssueClicks(0);
    setHasShownEngagementPrompt(unlocked);
    setHasClosedSecondIssue(false);
    setSecondIssueCloseScrollY(null);
    syncReportPath(snapshot.reportId);
    setStep("report");
  }, [isTradeshowMode, syncReportPath]);

  useEffect(() => {
    let cancelled = false;

    const validateTradeshowAccess = async () => {
      const params = new URLSearchParams(window.location.search);
      setIsWebsiteMode(hasEnabledQueryFlag(params, "website"));

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

        const payload = (await response.json()) as { snapshot?: ReportSnapshot };
        if (!cancelled && payload.snapshot) {
          hydrateSnapshot(payload.snapshot);
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
      const mode: Exclude<DemoMode, null> = demoParam === "good" ? "good" : "needs-work";
      const demoScan = buildDemoScanResult(mode);
      const newReportId = makeReportId();
      const demoAnswers: Answers = {
        property_type: PROPERTY_TYPE_OPTIONS[0],
        primary_challenge: PRIMARY_CHALLENGE_OPTIONS[1],
        property_size: PROPERTY_SIZE_OPTIONS[1],
      };
      const snapshot: ReportSnapshot = {
        reportId: newReportId,
        reportUrl: demoScan.url,
        scanResult: demoScan,
        answers: demoAnswers,
        name: "",
        propertyName: mode === "good" ? "Cedar Ridge Resort" : "Pine Hollow RV Park",
        email: "",
        emailConfirmation: "Demo mode loaded. No email was sent.",
        savedAt: new Date().toISOString(),
        demoMode: mode,
      };
      setDemoMode(mode);
      hydrateSnapshot(snapshot);
      setIsHydratingSharedReport(false);
    }

    return () => {
      cancelled = true;
    };
  }, [hydrateSnapshot, pathname]);

  useEffect(() => {
    if (step !== "partial" || !questionsComplete) {
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
        setIsReportUnlocked(Boolean(demoMode) || isTradeshowMode || isInternalTestDomain(reportUrl));
        setStep("report");
      },
      Math.max(0, minDelay - elapsed),
    );

    return () => window.clearTimeout(timeout);
  }, [demoMode, isScanning, isTradeshowMode, questionsComplete, reportId, reportUrl, scanResult, step, syncReportPath]);

  useEffect(() => {
    if (step !== "partial") {
      setPartialLoadingMessageIndex(0);
      return;
    }

    const timers = PARTIAL_LOADING_PHASES.map((phase, index) =>
      window.setTimeout(() => setPartialLoadingMessageIndex(index), phase.delay),
    );

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [step]);

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
        await saveAuditSession(undefined, { sendEmailCopy: false });
      } catch (error) {
        capturedAuditReportsRef.current.delete(reportId);
        console.error("ParkGrader audit capture failed", error);
      }
    })();
  }, [demoMode, reportId, reportUrl, saveAuditSession, scanResult, step]);

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
    const actionToRun = pendingProtectedAction;
    const nextReportId = reportId || makeReportId();
    if (!reportId) {
      setReportId(nextReportId);
    }
    syncReportPath(nextReportId);

    try {
      const result = await saveAuditSession(normalizedEmail, { sendEmailCopy: true });
      console.log("ParkGrader email confirmation queued for", normalizedEmail);
      setEmailConfirmation(
        isInternalTestEmail(normalizedEmail)
          ? `Test mode is on for ${normalizedEmail}. No email was sent.`
          : result.emailSent
            ? `A copy of this report has been sent to ${normalizedEmail}.`
            : `We saved your report, but could not send email right now. Use the share link below.`,
      );
      setLeadNotice(
        result.stored
          ? "Your details were saved successfully."
          : "Lead capture is connected, but HubSpot credentials are not configured yet.",
      );
      setIsReportUnlocked(true);
      setHasShownEngagementPrompt(true);
      setPendingProtectedAction(null);
      setStep("report");
      if (actionToRun) {
        window.setTimeout(() => {
          void performProtectedAction(actionToRun);
        }, 0);
      }
    } catch (error) {
      console.log("ParkGrader email confirmation placeholder for", normalizedEmail);
      setEmailConfirmation(
        isInternalTestEmail(normalizedEmail)
          ? `Test mode is on for ${normalizedEmail}. No email was sent.`
          : `A copy of this report has been sent to ${normalizedEmail}.`,
      );
      setLeadNotice(error instanceof Error ? error.message : "Lead capture failed.");
      setIsReportUnlocked(true);
      setHasShownEngagementPrompt(true);
      setPendingProtectedAction(null);
      setStep("report");
      if (actionToRun) {
        window.setTimeout(() => {
          void performProtectedAction(actionToRun);
        }, 0);
      }
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const copyShareLink = useCallback(async () => {
    if (!shareLink) {
      return;
    }
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [shareLink]);

  const takeReportWithYou = useCallback(async () => {
    if (!shareLink) {
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: "ParkGrader audit report",
          text: shareMessage,
          url: shareLink,
        });
        return;
      } catch {
        // If native share is dismissed, fall through to clipboard copy.
      }
    }

    await copyShareLink();
  }, [copyShareLink, shareLink, shareMessage]);

  const performProtectedAction = useCallback(async (action: ProtectedAction) => {
    switch (action) {
      case "share":
        await takeReportWithYou();
        return;
      case "email-share":
        if (emailShareLink && typeof window !== "undefined") {
          window.location.href = emailShareLink;
        }
        return;
      case "sms-share":
        if (smsShareLink && typeof window !== "undefined") {
          window.location.href = smsShareLink;
        }
        return;
      case "print":
        if (typeof window !== "undefined") {
          window.print();
        }
        return;
      case "pdf":
        await generatePdfReport();
        return;
      case "qr":
        setIsQrModalOpen(true);
        return;
    }
  }, [emailShareLink, generatePdfReport, smsShareLink, takeReportWithYou]);

  const requestProtectedAction = useCallback((action: ProtectedAction) => {
    if (isReportUnlocked) {
      void performProtectedAction(action);
      return;
    }
    setPendingProtectedAction(action);
  }, [isReportUnlocked, performProtectedAction]);

  const openCheckDetails = useCallback((checkId: string) => {
    setFlippedCardId(checkId);
    if (!isReportUnlocked) {
      setEngagementIssueClicks((value) => value + 1);
    }
  }, [isReportUnlocked]);

  useEffect(() => {
    const wasOpen = previousFlippedCardIdRef.current !== null;
    const isNowClosed = wasOpen && flippedCardId === null;

    if (isNowClosed && !isReportUnlocked && step === "report" && engagementIssueClicks >= 2 && !hasClosedSecondIssue) {
      setHasClosedSecondIssue(true);
      setSecondIssueCloseScrollY(window.scrollY);
    }

    previousFlippedCardIdRef.current = flippedCardId;
  }, [engagementIssueClicks, flippedCardId, hasClosedSecondIssue, isReportUnlocked, step]);

  useEffect(() => {
    if (step !== "report" || isReportUnlocked || hasShownEngagementPrompt) {
      return;
    }

    if (engagementIssueClicks < 3 || flippedCardId !== null) {
      return;
    }

    setHasShownEngagementPrompt(true);
    setPendingProtectedAction((existing) => existing ?? "share");
  }, [engagementIssueClicks, flippedCardId, hasShownEngagementPrompt, isReportUnlocked, step]);

  useEffect(() => {
    if (step !== "report" || isReportUnlocked || hasShownEngagementPrompt) {
      return;
    }

    const handleScroll = () => {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollableHeight <= 0) {
        return;
      }

      const scrollPct = (window.scrollY / scrollableHeight) * 100;
      const hasBrowsedAfterSecondClose =
        hasClosedSecondIssue && secondIssueCloseScrollY !== null && Math.abs(window.scrollY - secondIssueCloseScrollY) >= 120;

      if ((scrollPct >= 50 || hasBrowsedAfterSecondClose) && flippedCardId === null) {
        setHasShownEngagementPrompt(true);
        setPendingProtectedAction((existing) => existing ?? "share");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [flippedCardId, hasClosedSecondIssue, hasShownEngagementPrompt, isReportUnlocked, secondIssueCloseScrollY, step]);

  const visibleChecks = (scanResult?.checks ?? []).filter(
    (check) => !(check.id === "abandonment-recovery-readiness" && check.status === "unknown"),
  );

  const detailedPainGroups = PAIN_LEVEL_ORDER.map((painLevel) => ({
    painLevel,
    checks: visibleChecks
      .filter((check) => getPainLevelForCheck(check) === painLevel)
      .sort((a, b) => {
        const categoryDelta = CATEGORY_SORT_ORDER[a.category] - CATEGORY_SORT_ORDER[b.category];
        if (categoryDelta !== 0) {
          return categoryDelta;
        }

        return a.name.localeCompare(b.name);
      }),
  })).filter((entry) => entry.checks.length > 0);

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
            className="relative flex min-h-screen items-center overflow-hidden bg-[#F8FAFC] px-6 pb-24 pt-10 sm:px-10 sm:pt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TopographicPanel />
            {!isWebsiteMode ? (
              <>
                <Image
                  src={PARKGRADER_LOGO}
                  alt="ParkGrader"
                  width={181}
                  height={32}
                  style={{ height: "2rem", width: "auto" }}
                  className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 lg:left-10 lg:top-8 lg:translate-x-0"
                />

              </>
            ) : null}

            <motion.div
              className="relative z-10 mx-auto w-full max-w-3xl"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              <div className="mx-auto max-w-[52rem] px-3 py-6 sm:px-6 sm:py-8">
                <div className="flex flex-col items-center text-center">
                  <p className="text-sm font-normal tracking-[0.08em] text-[#9AA9B5]">
                    100+ PARKS GRADED SO FAR
                  </p>
                  <h1 className="mt-4 text-[2rem] leading-[0.95] text-[#0A1628] sm:text-[2.8rem] sm:whitespace-nowrap">
                    <span className="sm:hidden">Get more bookings</span>
                    <span className="hidden sm:inline">Get more direct bookings</span>
                  </h1>
                  <p className="mt-4 max-w-[56ch] text-base leading-7 text-[#5B6776] sm:text-xl sm:leading-8">
                    See exactly what's costing you direct bookings — and what to fix first.
                  </p>
                </div>
                <div className="mx-auto mt-9 w-full max-w-[34ch]">
                  <div className="text-left">
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
                              scanError ? "border-[#DC2626]" : "border-[#8DA4BA] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
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
                          placeholder="Enter your park website"
                          className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-lg font-semibold text-[#0A1628] text-center outline-none transition-colors placeholder:font-normal placeholder:text-[#6E7C90] ${
                            scanError ? "border-[#DC2626]" : "border-[#8DA4BA] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
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
                    className="mx-auto mt-8 block min-h-12 w-full rounded-2xl bg-[#2DA4A9] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#24858A] sm:max-w-[260px]"
                  >
                    Get My Free Audit
                  </motion.button>
                  <p className="mt-4 text-center text-base text-[#5B6776]">100% free. No credit card required.</p>
                </div>
              </div>
            </motion.div>
            <PolicyFooter fixed />
          </motion.section>
        )}

        {step === "guided" && (
          <motion.section
            key="guided"
            className="relative flex min-h-screen flex-col overflow-hidden bg-[#F8FAFC] px-6 pb-24 pt-10 sm:px-10 sm:pt-12"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
          >
            <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col justify-center">
              {!questionsComplete && currentQuestion ? (
                <motion.div
                  className="mx-auto w-full max-w-[680px]"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Image src={PARKGRADER_LOGO} alt="ParkGrader" width={181} height={32} style={{ height: "2rem", width: "auto" }} className="mx-auto" />
                  <motion.h2 key={currentQuestion.id} className="mt-10 text-center text-2xl leading-tight text-[#0A1628] sm:text-[2.2rem]" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
                    {currentQuestion.text}
                  </motion.h2>
                  <p className="mt-4 text-center text-base text-[#5B6776]">Choose the option that best matches your property today.</p>
                  <div className="mt-10 space-y-3.5">
                    {currentQuestion.options.map((option, index) => {
                      const isSelected = answers[currentQuestion.id]?.value === option.value;
                      const pulse = selectedPulse === `${currentQuestion.id}-${option.value}`;
                      return (
                        <motion.button
                          key={option.value}
                          className={`flex min-h-16 w-full items-center gap-4 border px-5 py-4 text-left text-base transition-colors ${
                            isSelected
                              ? "border-[#2DA4A9] bg-[#E6F7F8] text-[#0A1628]"
                              : "border-[#E6EBF0] bg-[#fafcfd] text-[#0A1628] hover:border-[#BFD2DC]"
                          }`}
                          onClick={() => selectAnswer(option)}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0, scale: pulse ? [1, 1.02, 1] : 1 }}
                          transition={{ delay: 0.08 + index * 0.08, duration: 0.28 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                            isSelected ? "border-[#2DA4A9]" : "border-[#CAD5E2]"
                          }`}>
                            <span className={`h-2 w-2 ${isSelected ? "bg-[#2DA4A9]" : "bg-transparent"}`} />
                          </span>
                          <span className="leading-snug">{option.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              ) : null}
              <div className="print-hidden mx-auto mt-8 w-full max-w-[680px] text-center text-base text-[#5B6776]">
                {`Question ${Math.min(GUIDED_QUESTIONS.length, questionIndex + 1)} of ${GUIDED_QUESTIONS.length}`}
              </div>
            </div>
            <PolicyFooter fixed />
          </motion.section>
        )}

        {step === "partial" && (
          <motion.section
            key="partial"
            className="flex h-screen items-center justify-center bg-[#F8FAFC] px-6 pb-24 pt-16 sm:px-10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="flex w-full max-w-xl flex-col items-center text-center">
              <motion.div
                className="h-12 w-12 rounded-full border-[3px] border-[#D9E2EC] border-t-[#0A1628]"
                animate={{ rotate: 360 }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.9, ease: "linear" }}
              />
              <AnimatePresence mode="wait">
                <motion.p
                  key={partialLoadingMessageIndex}
                  className="mt-6 text-base text-[#5B6776]"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {PARTIAL_LOADING_PHASES[partialLoadingMessageIndex]?.message}
                </motion.p>
              </AnimatePresence>
            </div>
            <PolicyFooter fixed />

          </motion.section>
        )}

        {step === "report" && scanResult && (
          <motion.section ref={reportSectionRef} key="report" className="report-page min-h-screen bg-[#F8FAFC]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="px-6 pb-16 pt-12 sm:px-10">
              <div className="mx-auto max-w-[760px]">
                <div className="flex items-center justify-between gap-4">
                  <button type="button" onClick={resetToLandingPage} className="inline-flex cursor-pointer items-center" aria-label="Back to ParkGrader start page">
                    <Image src={PARKGRADER_LOGO} alt="ParkGrader" width={181} height={32} style={{ height: "2rem", width: "auto" }} />
                  </button>
                  <div className={`print-hidden flex flex-wrap items-center justify-end gap-1 text-right text-[#0A1628] ${isReportUnlocked ? "" : "opacity-80"}`}>
                    {IS_REVIEW_COACH_ENABLED ? (
                      <button
                        type="button"
                        onClick={() => setIsReviewCoachOpen(!isReviewCoachOpen)}
                        aria-label="View Review Coach"
                        title="Review Coach — Analyze reviews & draft replies"
                        className="inline-flex h-10 items-center gap-1.5 border border-[#DCE5EC] bg-white px-3 text-xs font-semibold text-[#0A1628] transition-colors hover:border-[#2DA4A9] hover:text-[#2DA4A9]"
                      >
                        <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                        Reviews
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => requestProtectedAction("share")}
                      aria-label="Share report"
                      title="Share report"
                      className="inline-flex h-10 w-10 items-center justify-center transition-colors hover:text-[#2DA4A9]"
                    >
                      <ShareIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => isTradeshowMode ? setTradeshowEmailModalOpen(true) : requestProtectedAction("email-share")}
                      aria-label="Email"
                      title="Email"
                      className="inline-flex h-10 w-10 items-center justify-center transition-colors hover:text-[#2DA4A9]"
                    >
                      <EnvelopeIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => requestProtectedAction("qr")}
                      aria-label="Open QR code"
                      title="Open QR code"
                      className="inline-flex h-10 w-10 items-center justify-center transition-colors hover:text-[#2DA4A9]"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 8V5a1 1 0 0 1 1-1h3" />
                        <path d="M16 4h3a1 1 0 0 1 1 1v3" />
                        <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
                        <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
                        <rect x="7" y="7" width="3" height="3" rx="0.5" />
                        <rect x="14" y="7" width="3" height="3" rx="0.5" />
                        <rect x="7" y="14" width="3" height="3" rx="0.5" />
                        <path d="M14 14h3v3h-3z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <motion.div className="mx-auto mt-8" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
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
                        stroke={finalScore >= 75 ? "#16A34A" : finalScore >= 50 ? "#D97706" : "#DC2626"}
                        strokeWidth="16"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: displayScore / 100 }}
                        transition={{ duration: 1.1, ease: "easeOut" }}
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
                      {/* Score number — centroid of the arc bowl */}
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
                  <a href={`https://${reportUrl}`} target="_blank" rel="noopener noreferrer" className="mx-auto mt-3 flex max-w-[220px] items-center justify-center gap-1 break-all text-center text-xs text-[#5B6776] hover:text-[#1A2B3C] transition-colors">
                    <span>{displayReportUrl}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 flex-shrink-0"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm7.25-.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V6.31l-5.22 5.22a.75.75 0 1 1-1.06-1.06l5.22-5.22H12.25a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
                  </a>
                </motion.div>

                {isTradeshowMode ? (
                  <p className="print-hidden mt-6 text-center text-xs uppercase tracking-[0.12em] text-[#5B6776]">Tradeshow mode enabled</p>
                ) : null}

                {previousScanResult ? (
                  <motion.div
                    className="mt-8 border border-[#E6EBF0] bg-white p-5"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">Score comparison</p>
                    <div className="mt-3 flex items-center gap-4">
                      <span className="text-2xl font-medium text-[#94A3B8]">{previousScanResult.score}</span>
                      <ArrowRightIcon className="h-5 w-5 text-[#94A3B8]" aria-hidden="true" />
                      <span className={`text-2xl font-medium ${scanResult.score > previousScanResult.score ? "text-[#16A34A]" : scanResult.score < previousScanResult.score ? "text-[#DC2626]" : "text-[#0A1628]"}`}>
                        {scanResult.score}
                      </span>
                      <span className={`text-base ${scanResult.score > previousScanResult.score ? "text-[#16A34A]" : scanResult.score < previousScanResult.score ? "text-[#DC2626]" : "text-[#5B6776]"}`}>
                        {scanResult.score > previousScanResult.score
                          ? `+${scanResult.score - previousScanResult.score} points`
                          : scanResult.score < previousScanResult.score
                            ? `${scanResult.score - previousScanResult.score} points`
                            : "No change"}
                      </span>
                    </div>
                    {(() => {
                      const prevFailIds = new Set(previousScanResult.checks.filter((c) => c.status === "fail").map((c) => c.id));
                      const nowPassIds = scanResult.checks.filter((c) => c.status === "pass" && prevFailIds.has(c.id)).map((c) => c.id);
                      const prevPassIds = new Set(previousScanResult.checks.filter((c) => c.status === "pass").map((c) => c.id));
                      const nowFailIds = scanResult.checks.filter((c) => c.status === "fail" && prevPassIds.has(c.id)).map((c) => c.id);
                      if (nowPassIds.length === 0 && nowFailIds.length === 0) return null;
                      return (
                        <div className="mt-3 space-y-1">
                          {nowPassIds.map((id) => (
                            <p key={id} className="text-sm text-[#16A34A]">
                              + {CHECK_DISPLAY_LABEL_BY_ID[id] ?? id} now passing
                            </p>
                          ))}
                          {nowFailIds.map((id) => (
                            <p key={id} className="text-sm text-[#DC2626]">
                              - {CHECK_DISPLAY_LABEL_BY_ID[id] ?? id} now failing
                            </p>
                          ))}
                        </div>
                      );
                    })()}
                  </motion.div>
                ) : null}

                <div className="relative mt-12">
                  <motion.div className="relative space-y-0">
                  {detailedPainGroups.map(({ painLevel, checks }, categoryIndex) => (
                    <motion.section key={painLevel} className="pb-8 pt-6 md:pb-10 md:pt-7" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: categoryIndex * 0.04 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setCollapsedPainGroups((previous) => ({
                            ...previous,
                            [painLevel]: !previous[painLevel],
                          }));
                        }}
                        className="mb-6 flex w-full cursor-pointer items-center gap-4 text-left"
                        aria-expanded={!collapsedPainGroups[painLevel]}
                      >
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${PAIN_LEVEL_ICON_STYLES[painLevel]}`}><PainLevelIcon painLevel={painLevel} /></span>
                        <h3 className="text-base uppercase tracking-[0.08em] text-[#0A1628] md:text-lg">{PAIN_LEVEL_LABELS[painLevel]}</h3>
                        <div className="h-px flex-1 bg-[#E6EBF0]" />
                        <ChevronDownIcon className={`h-4 w-4 text-[#6B7B8D] transition-transform ${collapsedPainGroups[painLevel] ? "rotate-180" : ""}`} aria-hidden="true" />
                      </button>
                      {!collapsedPainGroups[painLevel] ? (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                        {checks.map((check, index) => (
                          <motion.article
                            key={check.id}
                            className="flip-card group relative flex min-h-[220px] flex-col cursor-pointer transition-shadow md:aspect-square md:min-h-0"
                            onClick={() => openCheckDetails(check.id)}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                          >
                            <div className={`flex h-full flex-col border border-[#E6EBF0] bg-[#FEFFFF] p-5 md:p-6 ${
                              check.status === "pass"
                                ? "border-t-[3px] border-t-[#2DA4A9]"
                                : check.status === "fail"
                                  ? "border-t-[3px] border-t-[#DC2626]"
                                  : "border-t-[3px] border-t-[#94A3B8]"
                            }`}>
                              <div className="flex items-start justify-between gap-3">
                                <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-[#5B6776]">
                                  <span className="text-[#6B7B8D]"><CheckIcon check={check} /></span>
                                  <span>{getCheckDisplayLabel(check)}</span>
                                </p>
                              </div>
                              <p className="mt-5 text-lg font-medium leading-8 text-[#0A1628]">{getCheckHeadline(check)}</p>
                              {check.estimatedImpact ? (
                                <>
                                  <p className="mt-3 text-base leading-7 text-[#5B6776]">{check.estimatedImpact.replace(/^Estimated impact:\s*/i, "")}</p>
                                  <p className="mt-3 text-left">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openCheckDetails(check.id);
                                      }}
                                      className="cursor-pointer text-base font-medium text-[#2DA4A9] underline transition-colors"
                                    >
                                      {check.status === "pass" ? "Why this matters" : "How do I fix this?"}
                                    </button>
                                  </p>
                                </>
                              ) : null}
                              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                                {(() => { const footerMeta = getCheckFooterMeta(check); return footerMeta ? <span className="text-[11px] text-[#94A3B8]">{footerMeta}</span> : <span />; })()}
                                <ArrowRightIcon className="flip-hint-icon h-4 w-4 shrink-0 text-[#9AA9B5] transition-colors group-hover:text-[#2DA4A9]" aria-hidden="true" />
                              </div>
                            </div>
                          </motion.article>
                        ))}
                      </div>
                      ) : null}
                    </motion.section>
                  ))}
                  </motion.div>
                </div>

                <AnimatePresence>
                  {pendingProtectedAction ? (
                    <motion.div
                      className="print-hidden fixed inset-0 z-50 flex items-center justify-center bg-[#0A1628]/55 px-4 py-6 backdrop-blur-[2px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setPendingProtectedAction(null)}
                    >
                      <motion.div
                        className="relative w-full max-w-[640px] overflow-hidden border border-[#E6EBF0] bg-[#fafcfd] shadow-[0_24px_80px_rgba(10,22,40,0.24)]"
                        initial={{ opacity: 0, y: 18, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 18, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setPendingProtectedAction(null)}
                          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center text-lg text-[#9AA9B5] transition-colors hover:text-[#0A1628]"
                          aria-label="Close details"
                        >
                          <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                        </button>

                        <div className="p-6 sm:p-8">
                          <div className="pr-10">
                            <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">One quick step</p>
                            <p className="mt-3 text-2xl leading-9 text-[#0A1628]">Email this report to yourself</p>
                            <p className="mt-3 text-base leading-7 text-[#5B6776]">
                              Enter your email and we&apos;ll send a copy of this audit to your inbox right away. You&apos;ll also unlock the share link, QR code, and print options.
                            </p>
                            <div className="mt-6 grid w-full grid-cols-1 gap-3">
                              <motion.div
                                animate={emailInputShakeCount > 0 ? { x: [0, -10, 10, -7, 7, -3, 3, 0] } : { x: 0 }}
                                transition={{ duration: 0.4 }}
                              >
                                <input
                                  type="email"
                                  inputMode="email"
                                  autoComplete="email"
                                  autoCapitalize="none"
                                  spellCheck={false}
                                  value={email}
                                  onChange={(event) => {
                                    setEmail(event.target.value);
                                    if (emailInputError) {
                                      setLeadNotice("");
                                    }
                                  }}
                                  placeholder="Email address"
                                  className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-base text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] ${
                                    emailInputError ? "border-[#DC2626] focus:border-[#DC2626]" : "border-[#C4D3E2] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                                  }`}
                                />
                              </motion.div>
                              {emailInputError ? <p className="-mt-1 text-left text-base text-[#B42318]">{emailInputError}</p> : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => void submitLead()}
                              className="mt-6 inline-flex min-h-12 w-full items-center justify-center bg-[#2DA4A9] px-5 py-3 text-base text-white transition-colors hover:bg-[#24858A]"
                            >
                              {isSubmittingLead ? "Sending..." : "Send my report"}
                            </button>
                            <p className="mt-3 text-center text-xs leading-relaxed text-[#5B6776]">
                              By entering your email you agree to receive a copy of this audit and occasional tips from Bucky Solutions. You can unsubscribe at any time. See our{" "}
                              <a href="https://www.buckysolutions.com/privacy-policy/" target="_blank" rel="noreferrer" className="text-[#2DA4A9]">
                                Privacy Policy.
                              </a>
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  ) : null}

                  {isQrModalOpen ? (
                    <motion.div
                      className="print-hidden fixed inset-0 z-50 flex items-center justify-center bg-[#0A1628]/55 px-4 py-6 backdrop-blur-[2px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsQrModalOpen(false)}
                    >
                      <motion.div
                        className="relative w-full max-w-[360px] overflow-hidden border border-[#DDE7F0] bg-[#F8FAFC] shadow-[0_24px_80px_rgba(10,22,40,0.24)]"
                        initial={{ opacity: 0, y: 18, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 18, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setIsQrModalOpen(false)}
                          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center text-2xl leading-none text-[#9AA9B5] transition-colors hover:text-[#0A1628]"
                          aria-label="Close QR code"
                        >
                          <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                        </button>
                        <div className="border-b border-[#E6EBF0] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9fc_100%)] px-6 py-5">
                          <p className="text-xs uppercase tracking-[0.1em] text-[#5B6776]">Share via QR</p>
                          <p className="mt-1 text-base text-[#0A1628]">Scan to open this report instantly.</p>
                        </div>
                        <div className="flex flex-col items-center px-6 pb-6 pt-5">
                          {qrCodeDataUrl ? (
                            <div className="border border-[#E6EBF0] bg-white p-3 shadow-[0_8px_20px_rgba(10,22,40,0.08)]">
                              <Image src={qrCodeDataUrl} alt="QR code to open this audit report" width={176} height={176} className="h-[176px] w-[176px]" unoptimized />
                            </div>
                          ) : isGeneratingQrCode ? (
                            <div className="flex h-[202px] w-[202px] items-center justify-center border border-[#E6EBF0] bg-white text-base text-[#5B6776]">
                              Preparing QR code...
                            </div>
                          ) : (
                            <p className="text-base text-[#5B6776]">QR code unavailable right now.</p>
                          )}
                          {shareLink ? (
                            <button
                              type="button"
                              onClick={() => void copyShareLink()}
                              className="mt-4 inline-flex items-center justify-center border border-[#D1DCE8] px-3 py-1.5 text-xs text-[#0A1628] transition-colors hover:border-[#2DA4A9] hover:text-[#2DA4A9]"
                            >
                              {copied ? "Copied" : "Copy share link"}
                            </button>
                          ) : null}
                        </div>
                      </motion.div>
                    </motion.div>
                  ) : null}

                  {tradeshowEmailModalOpen ? (
                    <motion.section
                      className="print-hidden fixed inset-0 z-50 flex min-h-screen flex-col overflow-hidden bg-[#F8FAFC] px-6 pb-24 pt-10 sm:px-10 sm:pt-12"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="relative mx-auto flex w-full max-w-[820px] flex-1 flex-col justify-center">
                        <button
                          type="button"
                          onClick={() => setTradeshowEmailModalOpen(false)}
                          className="absolute right-0 top-0 inline-flex h-12 w-12 items-center justify-center text-2xl leading-none text-[#9AA9B5] transition-colors hover:text-[#0A1628]"
                          aria-label="Close"
                        >
                          <XMarkIcon className="h-7 w-7" aria-hidden="true" />
                        </button>

                        {tradeshowEmailSent ? (
                          <motion.div className="mx-auto w-full max-w-[680px]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                            <Image src={PARKGRADER_LOGO} alt="ParkGrader" width={181} height={32} style={{ height: "2rem", width: "auto" }} className="mx-auto" />
                            <div className="mt-8 border border-[#E6EBF0] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9fc_100%)] p-5 sm:p-6">
                              <TradeshowEmailConfirm
                                email={email}
                                onClose={() => {
                                  setTradeshowEmailModalOpen(false);
                                  setTradeshowEmailSent(false);
                                }}
                              />
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div className="mx-auto w-full max-w-[680px]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                            <Image src={PARKGRADER_LOGO} alt="ParkGrader" width={181} height={32} style={{ height: "2rem", width: "auto" }} className="mx-auto" />
                            <h2 className="mt-10 text-center text-2xl leading-tight text-[#0A1628] sm:text-[2.2rem]">Email this report?</h2>
                            <p className="mt-4 text-center text-base text-[#5B6776]">Update the contact email if needed, then choose an option.</p>

                            <div className="mt-8 border border-[#E6EBF0] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9fc_100%)] p-5 sm:p-6">
                              <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">Contact email</p>
                              <motion.div
                                className="mt-3"
                                animate={emailInputShakeCount > 0 ? { x: [0, -10, 10, -7, 7, -3, 3, 0] } : { x: 0 }}
                                transition={{ duration: 0.4 }}
                              >
                                <input
                                  type="email"
                                  inputMode="email"
                                  autoComplete="email"
                                  autoCapitalize="none"
                                  spellCheck={false}
                                  value={email}
                                  onChange={(event) => {
                                    setEmail(event.target.value);
                                    if (leadNotice) {
                                      setLeadNotice("");
                                    }
                                  }}
                                  placeholder="name@company.com"
                                  className="h-12 w-full border-0 border-b-2 border-[#C4D3E2] bg-transparent px-0 pb-2 text-base text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                                />
                              </motion.div>

                              {leadNotice ? <p className="mt-3 text-base text-[#B42318]">{leadNotice}</p> : null}

                              <div className="mt-5 space-y-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const normalizedEmail = email.trim().toLowerCase();
                                    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                    if (!emailPattern.test(normalizedEmail)) {
                                      setLeadNotice("Please enter a valid email address.");
                                      setEmailInputShakeCount((value) => value + 1);
                                      return;
                                    }
                                    setEmail(normalizedEmail);
                                    setLeadNotice("");
                                    setTradeshowConsentEmailCopy(true);
                                    setTradeshowConsentMarketing(true);
                                    if (!hasSubmittedTradeshowLead) {
                                      setHasSubmittedTradeshowLead(true);
                                      void submitLead();
                                    }
                                    setTradeshowEmailSent(true);
                                  }}
                                  className="inline-flex min-h-12 w-full items-center justify-center bg-[#2DA4A9] px-5 py-3 text-base text-white transition-colors hover:bg-[#24858A]"
                                >
                                  Yes, send it
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTradeshowConsentEmailCopy(false);
                                    setTradeshowConsentMarketing(false);
                                    setTradeshowEmailModalOpen(false);
                                  }}
                                  className="inline-flex min-h-12 w-full items-center justify-center border border-[#D1DCE8] px-5 py-3 text-base text-[#0A1628] transition-colors hover:border-[#2DA4A9] hover:text-[#2DA4A9]"
                                >
                                  No thanks
                                </button>
                              </div>
                            </div>
                            <p className="mt-3 text-center text-xs leading-relaxed text-[#5B6776]">
                              We&apos;re committed to your privacy. Bucky Solutions uses the information you provide to contact you about relevant content, products, and services. You may unsubscribe from these communications at any time. For more information, see our
                              <a href="https://www.buckysolutions.com/privacy-policy/" target="_blank" rel="noreferrer" className="ml-1 text-[#2DA4A9]">
                                Privacy Policy.
                              </a>
                            </p>
                          </motion.div>
                        )}
                      </div>
                      <PolicyFooter fixed />
                    </motion.section>
                  ) : null}

                  {activeCheck ? (
                    <motion.div
                      className="print-hidden fixed inset-0 z-50 flex items-center justify-center bg-[#0A1628]/55 px-4 py-6 backdrop-blur-[2px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setFlippedCardId(null)}
                    >
                      <motion.div
                        className={`relative w-full max-w-[640px] overflow-hidden border border-[#E6EBF0] bg-[#fafcfd] shadow-[0_24px_80px_rgba(10,22,40,0.24)] ${
                          showFixContent
                            ? activeCheck.status === "fail"
                              ? "border-t-[3px] border-t-[#DC2626]"
                              : activeCheck.status === "pass"
                                ? "border-t-[3px] border-t-[#2DA4A9]"
                                : "border-t-[3px] border-t-[#94A3B8]"
                            : ""
                        }`}
                        initial={{ opacity: 0, y: 18, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 18, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setFlippedCardId(null)}
                          className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center text-2xl leading-none text-[#9AA9B5] transition-colors hover:text-[#0A1628]"
                          aria-label="Close details"
                        >
                          <XMarkIcon className="h-7 w-7" aria-hidden="true" />
                        </button>

                        <div className="p-6 sm:p-8">
                          {showFixContent ? (
                            <>
                              <div className="pr-10">
                                <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">{getCheckDisplayLabel(activeCheck)}</p>
                              </div>
                              <p className="mt-3 text-xl font-medium leading-8 text-[#0A1628]">{getCheckHeadline(activeCheck)}</p>
                            </>
                          ) : null}
                          {showFixContent ? (
                            <div className="mt-5">
                              <p className="text-base leading-7 text-[#5B6776]">
                                {activeCheck.status === "pass" ? activeCheckBenefit : activeCheckDirectFix}
                              </p>
                
                              {activeCheck.id === "pagespeed-mobile" && scanResult?.mobileTrafficPercent ? (
                                <div className="mt-5 flex items-center gap-3 rounded-lg bg-[#F0F9FA] px-4 py-3">
                                  <svg className="h-5 w-5 flex-shrink-0 text-[#2DA4A9]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                                  </svg>
                                  <p className="text-sm leading-5 text-[#0A1628]">
                                    <span className="font-semibold">{scanResult.mobileTrafficPercent}%</span> of your visitors browse on a phone
                                  </p>
                                </div>
                              ) : null}

                              {activeCheck.id === "pagespeed-mobile" && scanResult?.pageSpeedReportUrl ? (
                                <a
                                  href={scanResult.pageSpeedReportUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-6 inline-block text-sm font-medium text-[#2DA4A9] underline transition-colors hover:text-[#24858A]"
                                >
                                  View full PageSpeed report
                                </a>
                              ) : null}

                              {activeCheck.id === "response-time" ? (
                                <a
                                  href="https://squoosh.app"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-6 inline-block text-sm font-medium text-[#2DA4A9] underline transition-colors hover:text-[#24858A]"
                                >
                                  Try Squoosh to compress images
                                </a>
                              ) : null}

                              {activeCheckNeedsAi ? (
                                <>
                                  {(() => {
                                    const draft = activeCheck ? (aiFixDraftByCheckId[activeCheck.id] ?? "") : "";
                                    return draft ? (
                                      <div className="mt-4">
                                        <div className="max-h-[220px] overflow-auto border border-[#E6EBF0] bg-white p-3">
                                          <p className="whitespace-pre-wrap text-base leading-7 text-[#0A1628]">{draft}</p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            await navigator.clipboard.writeText(draft);
                                            setAiFixCopied(true);
                                            window.setTimeout(() => setAiFixCopied(false), 2000);
                                          }}
                                          className="mt-2 inline-flex items-center gap-1.5 border border-[#D1DCE8] px-3 py-1.5 text-xs text-[#0A1628] transition-colors hover:border-[#2DA4A9] hover:text-[#2DA4A9]"
                                        >
                                          {aiFixCopied ? "Copied!" : "Copy text"}
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="mt-4">
                                        {aiFixError ? <p className="mb-2 text-base text-[#B42318]">{aiFixError}</p> : null}
                                        <button
                                          type="button"
                                          onClick={() => void generateAiFix()}
                                          disabled={isGeneratingAiFix}
                                          className="inline-block text-sm font-medium text-[#2DA4A9] underline transition-colors hover:text-[#24858A] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {isGeneratingAiFix ? "Generating with AI..." : "Generate with AI"}
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </>
                              ) : null}

                              {activeCheckNeedsCompareIntent ? (
                                <div className="mt-4">
                                  <button
                                    type="button"
                                    onClick={() => void triggerCompetitorCompareIntent()}
                                    disabled={isComparingLocalReviews || Boolean(activeCheck && localReviewCompareByCheckId[activeCheck.id])}
                                    className="inline-block text-sm font-medium text-[#2DA4A9] underline transition-colors hover:text-[#24858A] disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isComparingLocalReviews
                                      ? "Comparing local competitors..."
                                      : activeCheck && localReviewCompareByCheckId[activeCheck.id]
                                        ? "Local comparison generated"
                                        : "Compare my reviews to local competitors"}
                                  </button>

                                  {localReviewCompareError ? (
                                    <p className="mt-2 text-base text-[#B42318]">{localReviewCompareError}</p>
                                  ) : null}

                                  {activeCheck && localReviewCompareByCheckId[activeCheck.id] ? (
                                    <div className="mt-3 border border-[#E6EBF0] bg-white p-3">
                                      <p className="text-base leading-7 text-[#0A1628]">
                                        You are at {localReviewCompareByCheckId[activeCheck.id].subject.rating ?? "N/A"} stars with {localReviewCompareByCheckId[activeCheck.id].subject.reviewCount} reviews. Nearby competitors average {localReviewCompareByCheckId[activeCheck.id].benchmark.averageRating} stars with {localReviewCompareByCheckId[activeCheck.id].benchmark.averageReviewCount} reviews.
                                      </p>
                                      <p className="mt-2 text-base leading-7 text-[#5B6776]">
                                        {localReviewCompareByCheckId[activeCheck.id].benchmark.reviewGap > 0
                                          ? `You need about ${localReviewCompareByCheckId[activeCheck.id].benchmark.reviewGap} more reviews to match that local average (~${localReviewCompareByCheckId[activeCheck.id].benchmark.weeklyTarget}/week for 12 months).`
                                          : "You are currently at or above the nearby review-volume average."}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {!showFixContent ? (
                              <div className="pr-10">
                                <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">One quick step</p>
                                <p className="mt-3 text-2xl leading-9 text-[#0A1628]">See all of your fixes</p>
                                <p className="mt-3 text-base leading-7 text-[#5B6776]">
                                  Enter your email to view the fixes in this audit. We&apos;ll also send a copy of the full audit to your inbox so you can keep it and share it later.
                                </p>
                                <div className="mt-6 grid w-full grid-cols-1 gap-3">
                                  <motion.div
                                    animate={emailInputShakeCount > 0 ? { x: [0, -10, 10, -7, 7, -3, 3, 0] } : { x: 0 }}
                                    transition={{ duration: 0.4 }}
                                  >
                                    <input
                                      type="email"
                                      inputMode="email"
                                      autoComplete="email"
                                      autoCapitalize="none"
                                      spellCheck={false}
                                      value={email}
                                      onChange={(event) => {
                                        setEmail(event.target.value);
                                        if (leadNotice) {
                                          setLeadNotice("");
                                        }
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          void submitLead();
                                        }
                                      }}
                                      placeholder="Email address"
                                      className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-base text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] ${
                                        leadNotice ? "border-[#DC2626] focus:border-[#DC2626]" : "border-[#C4D3E2] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                                      }`}
                                    />
                                  </motion.div>
                                  {leadNotice ? <p className="-mt-1 text-left text-base text-[#B42318]">{leadNotice}</p> : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void submitLead()}
                                  disabled={isSubmittingLead}
                                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center bg-[#2DA4A9] px-5 py-3 text-base text-white transition-colors hover:bg-[#24858A] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {isSubmittingLead ? "Sending..." : "Email my audit and show fixes"}
                                </button>
                                <p className="mt-3 text-center text-xs leading-relaxed text-[#5B6776]">
                                  By entering your email you agree to receive a copy of this audit and occasional tips from Bucky Solutions. You can unsubscribe at any time. See our{" "}
                                  <a href="https://www.buckysolutions.com/privacy-policy/" target="_blank" rel="noreferrer" className="text-[#2DA4A9]">
                                    Privacy Policy.
                                  </a>
                                </p>
                              </div>
                          ) : null}
                        </div>

                        {showFixContent ? (
                          <div className="flex flex-col gap-3 border-t border-[#E6EBF0] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                            <p className="hidden text-base text-[#5B6776] sm:block">
                              {activeCheck.status === "fail"
                                ? "Need this fixed for you?"
                                : activeCheck.status === "pass"
                                  ? "Want to strengthen this area even more?"
                                  : "Want help validating this area?"}
                            </p>
                            <a
                              href={activeCheckCta.href}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex w-full items-center justify-center bg-[#2DA4A9] px-4 py-2 text-base text-white transition-opacity hover:opacity-90 sm:w-auto"
                            >
                              {activeCheckCta.buttonLabel}
                            </a>
                          </div>
                        ) : null}
                      </motion.div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence>
                  {IS_REVIEW_COACH_ENABLED && isReviewCoachOpen && (
                    <motion.div key="review-coach" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.22, ease: "easeOut" }}>
                      <ReviewCoachPanel propertyName={propertyName || reportUrl} isVisible={isReviewCoachOpen} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <a
                  href="https://www.buckysolutions.com"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-12 flex items-center justify-center gap-2 text-xs text-[#5B6776]"
                >
                  Powered by
                  <Image
                    src="https://assets.buckysolutions.com/bucky_icon_white.svg"
                    alt="Bucky's Solutions"
                    width={56}
                    height={56}
                    className="h-14 w-14"
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
