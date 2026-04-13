"use client";

import Image from "next/image";
import { Faq3 } from "@/components/faq3";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Lottie from "lottie-react";
import starLoaderAnimation from "@/public/star-loader.json";
import {
  ArrowRightIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
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
  ShieldCheckIcon,
  SparklesIcon,
  SunIcon,
  TagIcon,
  TruckIcon,
  UserCircleIcon,
  UsersIcon,
  XMarkIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  StarIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
type ResultStatusFilter = Record<CheckStatus, boolean>;

type ScanCheck = {
  id: string;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  pass: boolean;
  confidence?: "CONFIRMED" | "INFERRED" | "UNVERIFIED";
  evidence?: string;
  finding: string;
  details: string;
  links?: Array<{ label: string; url: string }>;
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
  nameOverride?: string;
  phoneOverride?: string;
  leadIntent?: string;
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
  "google-rating": StarIcon,
  "review-count": ChatBubbleLeftRightIcon,
  "physical-address": MapPinIcon,
  "lead-capture": EnvelopeIcon,
  "thin-content": DocumentTextIcon,
  "cliche-density": DocumentTextIcon,
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
      id: "google-rating",
      name: "Google rating",
      category: "Can Guests Find You?",
      status: good ? "pass" : "fail",
      pass: good,
      finding: good ? "Google rating is above 4.0." : "Google rating is below 4.0.",
      details: good
        ? "Strong rating helps guests trust your park quickly when comparing options on Maps."
        : "Guests often filter to 4+ stars on Maps. Improve rating momentum by fixing recurring complaints, replying quickly, and asking happy guests for fresh reviews.",
      weight: 1,
      effort: "Medium",
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
          "No cancellation policy is making guests hesitate.",
          "Hidden pricing is forcing visitors to bounce.",
        ],
    topFails: good ? ["copyright-freshness"] : ["pagespeed-mobile", "booking-cta", "rate-transparency"],
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

type CoachReviewInput = {
  id: string;
  rating: number;
  text: string;
  hasOwnerReply?: boolean;
};

const STAR_COLORS: Record<number, string> = { 1: "#DC2626", 2: "#EA580C", 3: "#D97706", 4: "#2DA4A9", 5: "#16A34A" };

const parseManualReviews = (raw: string): { reviews: CoachReviewInput[]; error: string } => {
  const blocks = raw
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  if (!blocks.length) {
    return { reviews: [], error: "Paste at least one review to analyze." };
  }

  const reviews: CoachReviewInput[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    let text = block;
    let rating = 5;

    const starsPrefix = block.match(/^([★⭐]{1,5})\s*[-:|]?\s*/);
    if (starsPrefix) {
      rating = Math.min(5, starsPrefix[1].length);
      text = block.slice(starsPrefix[0].length).trim();
    } else {
      const numericPrefix = block.match(/^([1-5])\s*(?:stars?)?\s*[-:|]\s*/i);
      if (numericPrefix) {
        rating = Number(numericPrefix[1]);
        text = block.slice(numericPrefix[0].length).trim();
      } else {
        const inlineRating = block.match(/\b([1-5])\s*\/\s*5\b/);
        if (inlineRating) {
          rating = Number(inlineRating[1]);
        }
      }
    }

    if (text.length < 6) {
      continue;
    }

    reviews.push({
      id: `manual-${index + 1}`,
      rating,
      text,
      hasOwnerReply: false,
    });
  }

  if (!reviews.length) {
    return { reviews: [], error: "Could not read any review text. Use one review per paragraph, like: '5 - Great staff and easy check-in'." };
  }

  return { reviews, error: "" };
};

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
  const [manualReviewsInput, setManualReviewsInput] = useState("");

  const analyzeReviews = async (reviews: CoachReviewInput[], displayName: string) => {
    setIsLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/review-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyName: displayName || propertyName, tone, reviews }),
      });
      const payload = (await res.json()) as ReviewCoachResult;
      if (!res.ok) throw new Error(payload.message ?? "Analysis failed.");
      setResult(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error analyzing reviews.");
    } finally {
      setIsLoading(false);
    }
  };

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
      const selectedLoc = locations.find((l) => l.name === selectedLocation);
      await analyzeReviews(fetchedReviews as CoachReviewInput[], selectedLoc?.title || propertyName);
    } catch (e) { setError(e instanceof Error ? e.message : "Error fetching or analyzing reviews."); }
    finally { setIsFetching(false); }
  };

  const analyzeManualReviews = async () => {
    const parsed = parseManualReviews(manualReviewsInput);
    if (parsed.error) {
      setError(parsed.error);
      setResult(null);
      return;
    }
    await analyzeReviews(parsed.reviews, propertyName);
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

            <div className="mt-3 border-t border-[#E2E9EF] pt-3">
              <p className="text-xs font-medium text-[#314154]">Or paste reviews manually</p>
              <p className="mt-1 text-[10px] leading-4 text-[#5B6776]">Use one review per paragraph. Start with rating if possible, e.g. <span className="font-medium">5 - Great staff and easy check-in.</span></p>
              <textarea
                value={manualReviewsInput}
                onChange={(event) => setManualReviewsInput(event.target.value)}
                placeholder={"5 - Great location and friendly team.\n\n2 - Bathrooms were dirty and check-in was slow."}
                className="mt-2 h-28 w-full resize-none border border-[#D4DEE7] bg-white px-3 py-2 text-xs leading-5 text-[#0A1628] outline-none focus:border-[#2DA4A9]"
              />
              <button
                type="button"
                onClick={() => void analyzeManualReviews()}
                disabled={isLoading || !manualReviewsInput.trim()}
                className="mt-2 w-full bg-[#0A1628] hover:bg-[#1a2a4a] disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition-colors"
              >
                {isLoading ? "Analyzing..." : "Analyze Pasted Reviews"}
              </button>
            </div>
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
  "google-rating": {
    buttonLabel: "Improve Google rating",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "review-count": {
    buttonLabel: "Increase review volume",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "physical-address": {
    buttonLabel: "Fix local SEO",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "lead-capture": {
    buttonLabel: "Add email capture",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "thin-content": {
    buttonLabel: "Improve content",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "cliche-density": {
    buttonLabel: "Improve copywriting",
    href: "https://www.buckysolutions.com/services/website-management/",
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
  "google-rating": "Learn about Google ratings",
  "review-count": "Learn about review strategy",
  "physical-address": "Learn about local SEO",
  "lead-capture": "Learn about email marketing",
  "thin-content": "Learn about content depth",
  "cliche-density": "Learn about copywriting",
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
  "response-time": "Server response: your hosting server hands off the page quickly, so visitors aren't left waiting for the site to even start loading.",
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
  "google-rating": "Your Google rating is strong, building instant trust with guests comparing parks on Google Maps.",
  "review-count": "You have a healthy volume of Google reviews, providing strong social proof for potential guests.",
  "physical-address": "Your physical street address is visible on the site, helping Google verify your location and guests find you.",
  "lead-capture": "You're collecting visitor emails, allowing you to re-engage interested guests with seasonal deals and last-minute openings.",
  "thin-content": "Your homepage has enough descriptive content for Google to understand and rank your site effectively.",
  "cliche-density": "Your website copy is original and specific to your property, standing out from generic hospitality language.",
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
  "google-rating":
    "Respond to every review — positive or negative — within 48 hours. Guests who leave negative reviews often update their rating when they see a thoughtful response. Focus on the most common complaint, fix it, and reply publicly saying what changed. Then ask your happiest guests to leave a Google review — even a simple card at checkout with a QR code works.",
  "review-count":
    "Ask every happy guest to leave a Google review at checkout. A simple sign at the front desk with a QR code linking to your review page works great. Aim for 15+ reviews — that's the threshold where most guests start to trust a listing. Respond to every review to show you're engaged.",
  "negative-review-risk":
    "Look at the complaint themes above — the one that keeps coming up is where to start. Fix that issue first, then reply to each review and tell the guest exactly what changed. Once you've addressed it, start asking your happiest guests for fresh reviews so the newer ones push the old ones down. Respond to every new review within 24 hours to show future guests you're paying attention.",
  "physical-address":
    "Post your physical street address on your contact page, footer, and Google Business Profile. Google uses this to verify your location for Maps and 'near me' searches. A PO box doesn't count — guests need the real address to plug into their GPS.",
  "lead-capture":
    "Add a simple email signup form on your homepage — something like 'Get seasonal deals and opening alerts.' Use it to fill last-minute cancellations and announce special events. Even a basic Mailchimp or ConvertKit signup works. Position it above the scroll fold for best results.",
  "thin-content":
    "Your homepage needs at least 300 words of real, descriptive content — not just a booking widget and a photo. Write about what makes your property special: the setting, the amenities, nearby attractions, what guests love most. This helps Google understand what you offer and ranks you for relevant searches.",
  "cliche-density":
    "Go through your copy and replace generic phrases with specific details about YOUR property. Instead of 'nestled amidst nature,' say 'surrounded by 50 acres of pine forest along the Shenandoah River.' Instead of 'unforgettable experience,' describe what guests actually do — fish, hike, sit by the fire. Specific copy converts better and ranks better.",
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
  "response-time": "Server response",
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
  "google-rating": "Google rating",
  "review-count": "Review volume",
  "negative-review-risk": "Bad reviews",
  "physical-address": "Physical address",
  "lead-capture": "Email capture",
  "thin-content": "Content depth",
  "cliche-density": "Original copy",
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
      return p ? "Server responds quickly" : f ? "Server is slow to respond" : "Server response is borderline";
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
    case "negative-review-risk":
      return p
        ? "No major bad-review red flags"
        : (check.finding?.trim() || "Recent bad-review risk needs review");
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
    case "google-rating":
      return p ? "Google rating is strong" : (check.finding?.trim() || (f ? "Google rating needs improvement" : "Google rating not available"));
    case "review-count":
      return p ? "Healthy review volume" : f ? "More Google reviews needed" : "Review count not available";
    case "physical-address":
      return p ? "Physical address is visible" : f ? "No physical street address found" : "Address visibility unclear";
    case "lead-capture":
      return p ? "Email capture is in place" : f ? "No email capture form found" : "Email capture needs review";
    case "thin-content":
      return p ? "Content depth is sufficient" : f ? "Homepage content is too thin" : "Content depth needs review";
    case "cliche-density":
      return p ? "Copy is original and specific" : f ? "Copy relies heavily on clichés" : "Copy originality needs review";
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

const renderInlineReviewLinkedDetails = (check: ScanCheck, fallback: string): ReactNode => {
  const links = check.links ?? [];
  if (links.length === 0 || !fallback.includes("[[REVIEW_")) {
    return fallback;
  }

  const segments: ReactNode[] = [];
  const pattern = /\[\[REVIEW_(\d+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = pattern.exec(fallback);

  while (match) {
    const tokenStart = match.index;
    const tokenEnd = pattern.lastIndex;
    const oneBasedIndex = Number(match[1]);
    const link = Number.isFinite(oneBasedIndex) ? links[oneBasedIndex - 1] : undefined;

    if (tokenStart > lastIndex) {
      segments.push(fallback.slice(lastIndex, tokenStart));
    }

    if (link) {
      segments.push(
        <a
          key={`${check.id}-${oneBasedIndex}-${link.url}`}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-[#2DA4A9] decoration-1 underline-offset-2 hover:text-[#2DA4A9]"
        >
          {link.label}
        </a>,
      );
    } else {
      segments.push(match[0]);
    }

    lastIndex = tokenEnd;
    match = pattern.exec(fallback);
  }

  if (lastIndex < fallback.length) {
    segments.push(fallback.slice(lastIndex));
  }

  return segments;
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
  // Report is always unlocked for viewing; email prompt is engagement-based
  const [isReportUnlocked, setIsReportUnlocked] = useState(true);
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
  const [resultStatusFilter, setResultStatusFilter] = useState<ResultStatusFilter>({ pass: true, fail: true, unknown: true });
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [partialLoadingMessageIndex, setPartialLoadingMessageIndex] = useState(0);
  const [previousScanResult, setPreviousScanResult] = useState<ScanResponse | null>(null);
  const [collapsedPainGroups, setCollapsedPainGroups] = useState<Partial<Record<PainLevel, boolean>>>({});
  const [isHydratingSharedReport, setIsHydratingSharedReport] = useState(() => Boolean(getReportIdFromPathname(pathname ?? "")));
  const [engagementIssueClicks, setEngagementIssueClicks] = useState(0);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePromptNotice, setSharePromptNotice] = useState("");
  const [isSubmittingSharePrompt, setIsSubmittingSharePrompt] = useState(false);
  // Engagement prompt shown after scroll/click
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
  const [showCheckHelpForm, setShowCheckHelpForm] = useState(false);
  const [checkHelpSubmitted, setCheckHelpSubmitted] = useState(false);
  const [checkHelpName, setCheckHelpName] = useState("");
  const [checkHelpPhone, setCheckHelpPhone] = useState("");
  const [checkHelpNotice, setCheckHelpNotice] = useState("");
  const [isSubmittingCheckHelp, setIsSubmittingCheckHelp] = useState(false);
  const landingInputRef = useRef<HTMLInputElement | null>(null);
  const scanRequestRef = useRef(0);
  const loadingStartRef = useRef<number | null>(null);
  const reportSectionRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!isFilterMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!filterMenuRef.current?.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFilterMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFilterMenuOpen]);

  const currentQuestion = questionsComplete ? null : GUIDED_QUESTIONS[questionIndex] ?? null;

  const finalScore = scanResult?.score ?? 0;
  const gaugeTargetProgress = Math.max(0, Math.min(finalScore / 100, 1));
  const gaugeColor = finalScore >= 75 ? "#16A34A" : finalScore >= 50 ? "#D97706" : "#DC2626";
  const letterGrade = scoreToLetterGrade(finalScore);
  const displayReportUrl = useMemo(() => formatDisplayUrl(reportUrl), [reportUrl]);
  const emailInputError = leadNotice;
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

    if ((activeCheck.id === "negative-review-risk" || activeCheck.id === "google-rating") && activeCheck.details?.trim()) {
      return activeCheck.details.trim();
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

  useEffect(() => {
    setShowCheckHelpForm(false);
    setCheckHelpSubmitted(false);
    setCheckHelpName(name);
    setCheckHelpPhone("");
    setCheckHelpNotice("");
  }, [activeCheck?.id, email, name]);

  const generatePdfReport = useCallback(async () => {
    if (typeof window === "undefined" || isGeneratingPdf) {
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const title = `${displayReportUrl || reportUrl || "parkgrader"}-audit`;
      const { jsPDF } = await import("jspdf");

      // Fetch SVG logo and rasterise to PNG so jsPDF can embed it
      let logoPngDataUrl: string | null = null;
      try {
        const res = await fetch("/api/logo");
        let svgText = await res.text();
        // Ensure explicit dimensions so the browser renders it at a known size
        if (!/<svg[^>]+width=/.test(svgText)) {
          svgText = svgText.replace("<svg", '<svg width="480" height="96"');
        }
        // base64 data URI is more reliable than objectURL for SVG→canvas
        const b64 = btoa(unescape(encodeURIComponent(svgText)));
        const dataUri = `data:image/svg+xml;base64,${b64}`;
        logoPngDataUrl = await new Promise<string>((resolve, reject) => {
          const img = new window.Image();
          img.onload = () => {
            const scale = 3;
            const canvas = document.createElement("canvas");
            canvas.width = 480 * scale;
            canvas.height = 96 * scale;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const png = canvas.toDataURL("image/png");
            // If canvas is blank (cross-origin taint or render failure) reject
            if (png === "data:,") { reject(); return; }
            resolve(png);
          };
          img.onerror = () => reject();
          img.src = dataUri;
        });
      } catch {
        // Logo unavailable — will fall back to text wordmark
      }

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const L = 56; // left
      const R = 56; // right
      const W = pageW - L - R;

      const hexRgb = (h: string): [number, number, number] => {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
        return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
      };
      const tc = (h: string) => { const [r, g, b] = hexRgb(h); pdf.setTextColor(r, g, b); };
      const dc = (h: string) => { const [r, g, b] = hexRgb(h); pdf.setDrawColor(r, g, b); };

      let y = 48;

      const needBreak = (h: number) => {
        if (y + h > pageH - 52) { pdf.addPage(); y = 48; }
      };

      // ── Logo ──────────────────────────────────────────────────────────────────
      if (logoPngDataUrl) {
        pdf.addImage(logoPngDataUrl, "PNG", L, y - 10, 120, 24);
        y += 28;
      } else {
        tc("#0A1628"); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
        pdf.text("ParkGrader", L, y);
        y += 20;
      }

      // ── Header rule ───────────────────────────────────────────────────────────
      dc("#D6E2EE"); pdf.setLineWidth(0.5);
      pdf.line(L, y, pageW - R, y);
      y += 28;

      // ── Site + score ──────────────────────────────────────────────────────────
      tc("#0A1628"); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
      pdf.text(displayReportUrl || reportUrl || "—", L, y);
      y += 14;

      tc("#5B6776"); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
      const score = scanResult?.score ?? 0;
      const status = scanResult?.status ?? "";
      const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      pdf.text(`Score: ${score} / 100  ·  ${status}  ·  ${dateStr}`, L, y);
      y += 28;

      // ── Section rule ──────────────────────────────────────────────────────────
      dc("#D6E2EE"); pdf.setLineWidth(0.5);
      pdf.line(L, y, pageW - R, y);
      y += 20;

      // ── Check rows ───────────────────────────────────────────────────────────
      const allChecks = [
        ...(scanResult?.checks ?? []).filter(c => c.status === "fail"),
        ...(scanResult?.checks ?? []).filter(c => c.status !== "fail" && c.status !== "pass"),
        ...(scanResult?.checks ?? []).filter(c => c.status === "pass"),
      ];

      for (const check of allChecks) {
        const statusLabel =
          check.status === "pass" ? "Pass" :
          check.status === "fail" ? "Fail" : "Review";
          const statusColor =
            check.status === "pass" ? "#16A34A" :
            check.status === "fail" ? "#DC2626" : "#D97706";
          const nameLines: string[] = pdf.splitTextToSize(check.name, W - 60);
        const finding = (check.finding ?? "").replace(/^(PASS|FAIL|WARN|UNKNOWN):\s*/i, "").replace(/\.$/, "");
          const findLines: string[] = finding ? pdf.splitTextToSize(finding, W - 60) : [];
        const rowH = nameLines.length * 12 + (findLines.length ? findLines.length * 11 + 4 : 0) + 18;

        needBreak(rowH + 4);

          // Colored left rail
          const [rr, rg, rb] = hexRgb(statusColor);
          pdf.setFillColor(rr, rg, rb);
          pdf.rect(L, y + 4, 3, rowH - 8, "F");

          // Status label — right-aligned, colored
          tc(statusColor); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8);
        pdf.text(statusLabel, pageW - R, y + 12, { align: "right" });

        // Check name
        tc("#0A1628"); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
          pdf.text(nameLines, L + 12, y + 12);

        // Finding
        if (findLines.length) {
          tc("#5B6776"); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5);
            pdf.text(findLines, L + 12, y + 12 + nameLines.length * 12 + 5);
        }

        // Bottom hairline
        dc("#EEF2F7"); pdf.setLineWidth(0.3);
        pdf.line(L, y + rowH, pageW - R, y + rowH);

        y += rowH + 6;
      }

      // ── Footer on every page ────────────────────────────────────────────────
      const totalPages = (pdf.internal as unknown as { pages: unknown[] }).pages.length - 1;
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        dc("#D6E2EE"); pdf.setLineWidth(0.4);
        pdf.line(L, pageH - 30, pageW - R, pageH - 30);
        tc("#8898AA"); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
        pdf.text("ParkGrader  ·  parkgrader.com", L, pageH - 18);
        pdf.text(`${p} / ${totalPages}`, pageW - R, pageH - 18, { align: "right" });
      }

      pdf.save(`${title}.pdf`);
    } finally {
      window.setTimeout(() => {
        setIsGeneratingPdf(false);
      }, 300);
    }
  }, [displayReportUrl, isGeneratingPdf, reportUrl, scanResult]);

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
      const normalizedName = (options?.nameOverride ?? name).trim();
      const normalizedPhone = (options?.phoneOverride ?? "").trim();
      const savedAt = new Date().toISOString();
      const reportSnapshotPayload: ReportSnapshot = {
        reportId: nextReportId,
        reportUrl,
        scanResult,
        aiFixDraftByCheckId: options?.aiFixDraftByCheckIdOverride ?? aiFixDraftByCheckId,
        localReviewCompareByCheckId:
          options?.localReviewCompareByCheckIdOverride ?? localReviewCompareByCheckId,
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
        property_type: selectedPropertyType,
        primary_challenge: selectedChallenge,
        property_size: selectedPropertySize ?? "25-75",
        scan_date: savedAt,
        report_id: nextReportId,
        report_snapshot: reportSnapshotPayload,
        send_email_copy: Boolean(options?.sendEmailCopy),
        lead_intent: options?.leadIntent || undefined,
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

  const handleRescan = useCallback(() => {
    if (!reportUrl || isScanning || !scanResult) {
      return;
    }
    setPartialLoadingMessageIndex(0);
    setStep("partial");
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
    // (Obsolete: engagement prompt state removed)
    setIsReportUnlocked(true);
    setShowEmailPrompt(false);
    setHasTriggeredEmailPrompt(false);
    hydratedFromSavedReportRef.current = false;
    loadingStartRef.current = null;
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
    }
    setReportUrl(normalized);
    if (isTradeshowMode) {
      setStep("guided");
    } else {
      setQuestionsComplete(true);
      setStep("partial");
    }
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
    setReportSavedAt(snapshot.savedAt ?? "");
    // Report is always unlocked for viewing; suppress email prompt if we already have their email
    setIsReportUnlocked(true);
    setShowEmailPrompt(false);
    setHasTriggeredEmailPrompt(Boolean(snapshot.email) || Boolean(snapshot.demoMode));
    setEngagementIssueClicks(0);
    // (Obsolete: engagement prompt state removed)
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
        setIsReportUnlocked(true);
        setReportSavedAt(new Date().toISOString());
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
      const result = await saveAuditSession(normalizedEmail, { sendEmailCopy: true, leadIntent: "share-report" });
      setEmail(normalizedEmail);
      setEmailConfirmation(
        isInternalTestEmail(normalizedEmail)
          ? `Test mode is on for ${normalizedEmail}. No email was sent.`
          : result.emailSent
            ? `A copy of this report has been sent to ${normalizedEmail}.`
            : `We saved your report, but could not send email right now. Use the share link below.`,
      );
      setShowSharePrompt(false);
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
      const result = await saveAuditSession(normalizedEmail, { sendEmailCopy: true, leadIntent: "engagement-email" });
      setEmail(normalizedEmail);
      setEmailConfirmation(
        isInternalTestEmail(normalizedEmail)
          ? `Test mode is on for ${normalizedEmail}. No email was sent.`
          : result.emailSent
            ? `A copy of this report has been sent to ${normalizedEmail}.`
            : `We saved your report, but could not send email right now. Use the share link below.`,
      );
      setShowEmailPrompt(false);
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
        sendEmailCopy: false,
        nameOverride: normalizedName,
        phoneOverride: normalizedPhone,
        leadIntent: "callback-request",
      });
      setName(normalizedName);
      setEmail(normalizedEmail);
      setShowEmailPrompt(false);
      setEmailConfirmation("Thanks. We’ll pull up your site before we call.");
    } catch (error) {
      setCallbackPromptNotice(error instanceof Error ? error.message : "Unable to send your request.");
    } finally {
      setIsSubmittingCallbackPrompt(false);
    }
  };

  const submitCheckHelpRequest = async () => {
    if (!activeCheck) {
      return;
    }

    const normalizedName = checkHelpName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = checkHelpPhone.trim();
    const phoneDigits = normalizedPhone.replace(/\D/g, "");

    if (!normalizedName) {
      setCheckHelpNotice("Please enter your name.");
      return;
    }

    if (phoneDigits.length < 10) {
      setCheckHelpNotice("Please enter a valid phone number.");
      return;
    }

    setIsSubmittingCheckHelp(true);
    setCheckHelpNotice("");

    try {
      await saveAuditSession(normalizedEmail, {
        sendEmailCopy: false,
        nameOverride: normalizedName,
        phoneOverride: normalizedPhone,
        leadIntent: `check-help:${activeCheck.id}`,
      });
      setName(normalizedName);
      setEmail(normalizedEmail);
      setCheckHelpSubmitted(true);
      setEmailConfirmation("Thanks. We received your request and will follow up about this issue.");
    } catch (error) {
      setCheckHelpNotice(error instanceof Error ? error.message : "Unable to send your request.");
    } finally {
      setIsSubmittingCheckHelp(false);
    }
  };

  const handleDownloadIntent = useCallback(() => {
    if (!hasTriggeredEmailPrompt) {
      setHasTriggeredEmailPrompt(true);
      openEngagementPrompt();
      return;
    }
    void generatePdfReport();
  }, [generatePdfReport, hasTriggeredEmailPrompt, openEngagementPrompt]);

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
      setShowEmailPrompt(false);
      // (Obsolete: engagement prompt state removed)
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
      setShowEmailPrompt(false);
      // (Obsolete: engagement prompt state removed)
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
    if (action === "share") {
      openSharePrompt();
      return;
    }
    if (isReportUnlocked) {
      void performProtectedAction(action);
      return;
    }
    setPendingProtectedAction(action);
  }, [isReportUnlocked, openSharePrompt, performProtectedAction]);

  const openCheckDetails = useCallback((checkId: string) => {
    setEngagementIssueClicks((value) => {
      const next = value + 1;
      // On the 3rd click, show prompt instead of opening the card underneath.
      if (!hasTriggeredEmailPrompt && next >= 3) {
        setFlippedCardId(null);
        openEngagementPrompt();
        setHasTriggeredEmailPrompt(true);
        return next;
      }

      setFlippedCardId(checkId);
      return next;
    });
  }, [hasTriggeredEmailPrompt]);

  // Engagement-based email prompt: scroll 40% or 3rd card click
  useEffect(() => {
    if (step !== "report" || hasTriggeredEmailPrompt) return;
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollY = window.scrollY || doc.scrollTop;
      const winH = window.innerHeight || doc.clientHeight;
      const fullH = doc.scrollHeight;
      if (fullH > 0 && (scrollY + winH) / fullH >= 0.4) {
        openEngagementPrompt();
        setHasTriggeredEmailPrompt(true);
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [step, hasTriggeredEmailPrompt, openEngagementPrompt]);

  const visibleChecks = (scanResult?.checks ?? []).filter(
    (check) => {
      if (check.id === "abandonment-recovery-readiness" && check.status === "unknown") {
        return false;
      }
      return resultStatusFilter[check.status];
    },
  );

  const isFilterActive = !resultStatusFilter.pass || !resultStatusFilter.fail || !resultStatusFilter.unknown;

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

  // Progressive tease: pick the 3 most alarming failing checks to show ungated
  const ungatedCheckIds = useMemo(() => {
    const failingChecks = visibleChecks
      .filter((c) => c.status === "fail")
      .sort((a, b) => {
        const painA = getPainLevelForCheck(a);
        const painB = getPainLevelForCheck(b);
        const painOrder: Record<PainLevel, number> = { "money-losers": 0, "maintenance-needed": 1, "watchlist": 2, "working-well": 3 };
        return (painOrder[painA] ?? 3) - (painOrder[painB] ?? 3);
      });
    return new Set(failingChecks.slice(0, 3).map((c) => c.id));
  }, [visibleChecks]);

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
              <>
                <Image
                  src={PARKGRADER_LOGO}
                  alt="ParkGrader"
                  width={181}
                  height={32}
                  className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 h-7 w-auto lg:left-10 lg:top-8 lg:translate-x-0"
                />

              </>
            ) : null}

            <motion.div
              className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-4 lg:min-h-screen lg:flex-row lg:items-end lg:px-12 lg:gap-16"
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mx-auto max-w-[52rem] px-3 pt-24 pb-6 sm:px-6 sm:pt-28 sm:pb-8 lg:mx-0 lg:max-w-xl lg:self-center lg:pt-6 lg:pb-8">
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                  <p className="text-sm font-medium tracking-[0.04em] text-[#D97706]">
                    THE AVERAGE PARK WE AUDIT HAS 9 FIXABLE ISSUES
                  </p>
                  <h1 className="mt-4 text-[1.75rem] leading-[1.1] text-[#0A1628] sm:text-[2.4rem]">
                    Find your park&apos;s booking leaks
                  </h1>
                  <p className="mt-4 max-w-[52ch] text-lg leading-7 text-[#5B6776] sm:text-xl sm:leading-8">
                    Most park websites lose 30%+ of direct bookings to fixable problems. Get a free audit in 60 seconds — no email required.
                  </p>
                </div>
                <div className="mx-auto mt-9 w-full max-w-[34ch] lg:mx-0 lg:max-w-none">
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
                          className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-lg font-semibold text-[#0A1628] text-center lg:text-left outline-none transition-colors placeholder:font-normal placeholder:text-[#6E7C90] ${
                            scanError ? "border-[#DC2626]" : "border-[#5B6776] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
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
                    className="btn-rounded mx-auto mt-8 block min-h-12 w-full bg-[#2DA4A9] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#24858A] lg:mx-0"
                  >
                    Get My Free Audit
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
                      src="https://assets.buckysolutions.com/website-assets/parkgrader_mobile_example.png"
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
                  { id: "faq-1", question: "Is this really free?", answer: "Yes — 100% free, no credit card, no commitment. You get your full score and category grades immediately. We ask for an email only to send you the detailed breakdown with specific fixes." },
                  { id: "faq-2", question: "What exactly does the audit check?", answer: "We run 35+ automated checks across five categories: mobile speed & technical health, booking flow & conversion, site content & trust signals, Google presence & local SEO, and competitive positioning against nearby parks." },
                  { id: "faq-3", question: "How long does it take?", answer: "About 60 seconds. Enter your website URL, answer a couple of quick questions about your property, and we scan everything automatically." },
                  { id: "faq-4", question: "Will you try to sell me something?", answer: "Yes, we offer services at Bucky Solutions. But this audit is genuinely free with no obligation, and no sales call unless you ask for one." },
                  { id: "faq-5", question: "What do I do with the results?", answer: "Every failing check includes a plain-English explanation of the problem and how to fix it. Most issues can be handled by your web developer or even on your own — no agency required." },
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

        {step === "guided" && (
          <motion.section
            key="guided"
            className="relative flex min-h-screen flex-col overflow-hidden bg-[#F8FAFC] px-6 pb-24 pt-10 sm:px-10 sm:pt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col justify-center">
              {!questionsComplete && currentQuestion ? (
                <motion.div
                  className="mx-auto w-full max-w-[680px]"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Image src={PARKGRADER_LOGO} alt="ParkGrader" width={181} height={32} style={{ height: "2rem", width: "auto" }} className="mx-auto" />
                  <motion.h2 key={currentQuestion.id} className="mt-10 text-center text-2xl leading-tight text-[#0A1628] sm:text-[2.2rem]" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
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
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0, scale: pulse ? [1, 1.02, 1] : 1 }}
                          transition={{ delay: 0.1 + index * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
                  key={partialLoadingMessageIndex}
                  className="-mt-1 text-base text-[#5B6776]"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {PARTIAL_LOADING_PHASES[partialLoadingMessageIndex]?.message}
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
                  <div className={`print-hidden flex flex-wrap items-center justify-end gap-1 text-right text-[#0A1628] ${isReportUnlocked ? "" : "opacity-80"}`}>
                    <button
                      type="button"
                      onClick={handleRescan}
                      aria-label="Run scan again"
                      title="Re-scan this website"
                      className="inline-flex h-10 w-10 items-center justify-center transition-colors hover:text-[#2DA4A9]"
                    >
                      <ArrowPathIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div ref={filterMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setIsFilterMenuOpen((value) => !value)}
                        aria-label="Filter checks by status"
                        title="Choose which check statuses to show"
                        aria-expanded={isFilterMenuOpen}
                        className={`inline-flex h-10 w-10 items-center justify-center transition-colors hover:text-[#2DA4A9] ${isFilterActive ? "text-[#2DA4A9]" : ""}`}
                      >
                        <QueueListIcon className="h-5 w-5" aria-hidden="true" />
                      </button>

                      {isFilterMenuOpen ? (
                        <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-xl border border-[#DCE6EE] bg-[rgba(248,250,252,0.97)] p-2 shadow-[0_12px_28px_rgba(10,22,40,0.14)] backdrop-blur-sm">
                          <button
                            type="button"
                            onClick={() => setResultStatusFilter({ pass: true, fail: true, unknown: true })}
                            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-[#0A1628] transition-colors hover:bg-white"
                          >
                            <span>Show all</span>
                            <span className="text-xs text-[#5B6776]">Reset</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setResultStatusFilter((previous) => {
                              const enabledCount = Object.values(previous).filter(Boolean).length;
                              if (previous.fail && enabledCount === 1) return previous;
                              return { ...previous, fail: !previous.fail };
                            })}
                            className="mt-1 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-[#0A1628] transition-colors hover:bg-white"
                          >
                            <span>Needs Fix</span>
                            <span className={`text-xs ${resultStatusFilter.fail ? "text-[#2DA4A9]" : "text-[#9AA9B5]"}`}>{resultStatusFilter.fail ? "On" : "Off"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setResultStatusFilter((previous) => {
                              const enabledCount = Object.values(previous).filter(Boolean).length;
                              if (previous.unknown && enabledCount === 1) return previous;
                              return { ...previous, unknown: !previous.unknown };
                            })}
                            className="mt-1 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-[#0A1628] transition-colors hover:bg-white"
                          >
                            <span>Review</span>
                            <span className={`text-xs ${resultStatusFilter.unknown ? "text-[#2DA4A9]" : "text-[#9AA9B5]"}`}>{resultStatusFilter.unknown ? "On" : "Off"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setResultStatusFilter((previous) => {
                              const enabledCount = Object.values(previous).filter(Boolean).length;
                              if (previous.pass && enabledCount === 1) return previous;
                              return { ...previous, pass: !previous.pass };
                            })}
                            className="mt-1 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-[#0A1628] transition-colors hover:bg-white"
                          >
                            <span>Passing</span>
                            <span className={`text-xs ${resultStatusFilter.pass ? "text-[#2DA4A9]" : "text-[#9AA9B5]"}`}>{resultStatusFilter.pass ? "On" : "Off"}</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
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

                <motion.div className="mx-auto mt-8" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
                  <div className="overflow-hidden rounded-2xl border border-[#DCE6EE] bg-[rgba(248,250,252,0.84)] pt-6 shadow-[0_10px_30px_rgba(115,146,176,0.08)] backdrop-blur-sm">
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
                  <a href={`https://${reportUrl}`} target="_blank" rel="noopener noreferrer" className="mx-auto mb-10 mt-2 flex max-w-[220px] items-center justify-center gap-1 break-all text-center text-xs text-[#5B6776] hover:text-[#1A2B3C] transition-colors">
                    <span>{displayReportUrl}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 flex-shrink-0"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm7.25-.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V6.31l-5.22 5.22a.75.75 0 1 1-1.06-1.06l5.22-5.22H12.25a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
                  </a>
                  {/* Card action buttons */}
                  <div className="mt-4 flex divide-x divide-[#E6EBF0] border-t border-[#E6EBF0]">
                    <button
                      type="button"
                      onClick={handleDownloadIntent}
                      className="report-btn-rounded flex flex-1 items-center justify-center gap-2 rounded-bl-2xl py-3 text-xs font-medium text-[#5B6776] transition-colors hover:bg-[#F8FAFB] hover:text-[#0A1628]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v7.44l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0L5.72 9.78a.75.75 0 0 1 1.06-1.06L9.25 11.19V3.75A.75.75 0 0 1 10 3ZM3.75 15a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H3.75Z" clipRule="evenodd" />
                      </svg>
                      Download Report
                    </button>
                    <button
                      type="button"
                      onClick={openSharePrompt}
                      className="report-btn-rounded flex flex-1 items-center justify-center gap-2 rounded-br-2xl py-3 text-xs font-medium text-[#5B6776] transition-colors hover:bg-[#F8FAFB] hover:text-[#0A1628]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.474l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" />
                      </svg>
                      Share Report
                    </button>
                  </div>
                  </div>
                </motion.div>

                {isTradeshowMode ? (
                  <p className="print-hidden mt-6 text-center text-xs uppercase tracking-[0.12em] text-[#5B6776]">Tradeshow mode enabled</p>
                ) : null}

                {previousScanResult ? (
                  <motion.div
                    className="mt-8 rounded-2xl border border-[#DCE6EE] bg-[rgba(248,250,252,0.84)] p-5 shadow-[0_10px_30px_rgba(115,146,176,0.08)] backdrop-blur-sm"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">Score comparison</p>
                    <div className="mt-3 flex items-center gap-4">
                      <span className="text-2xl font-medium text-[#94A3B8]">{previousScanResult.score}</span>
                      <ChevronRightIcon className="h-5 w-5 text-[#94A3B8]" aria-hidden="true" />
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

                {/* Category Grade Summary removed as requested */}

                {/* ── Detail Cards (only shown after unlock) ── */}
                {isReportUnlocked || isTradeshowMode ? (
                <div className="relative mt-12">
                  <motion.div className="relative space-y-0">
                  {detailedPainGroups.map(({ painLevel, checks }, categoryIndex) => (
                    <motion.section key={painLevel} className="pb-8 pt-6 md:pb-10 md:pt-7" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: categoryIndex * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
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
                        <h3 className="text-[22px] font-medium tracking-[-0.03em] text-[#0A1628] md:text-[26px]">{PAIN_LEVEL_LABELS[painLevel]}</h3>
                        <div className="h-px flex-1 bg-[#B8C4D1]" />
                        <ChevronDownIcon className={`h-4 w-4 text-[#6B7B8D] transition-transform ${collapsedPainGroups[painLevel] ? "rotate-180" : ""}`} aria-hidden="true" />
                      </button>
                      {!collapsedPainGroups[painLevel] ? (
                      <div className="overflow-hidden rounded-2xl border border-[#DCE6EE] bg-[rgba(248,250,252,0.84)] shadow-[0_10px_30px_rgba(115,146,176,0.08)] backdrop-blur-sm">
                        {checks.map((check, index) => (
                          <motion.article
                            key={check.id}
                            className="flip-card group relative cursor-pointer transition-colors"
                            onClick={() => openCheckDetails(check.id)}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <div className={`relative flex h-full flex-col gap-4 px-5 py-5 transition-colors hover:bg-[rgba(255,255,255,0.38)] md:flex-row md:items-start md:gap-6 md:px-6 md:py-6 ${index < checks.length - 1 ? "border-b border-[#DCE6EE]" : ""}`}>
                              <div className="min-w-0 flex-1 pr-8">
                                <div className="flex items-start gap-3">
                                  {(() => {
                                    const footerMeta = getCheckFooterMeta(check);
                                    return (
                                      <span
                                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                          check.status === "pass"
                                            ? "bg-[#E8F7F4] text-[#0E7C66]"
                                            : check.status === "fail"
                                              ? "bg-[#FDECEC] text-[#B42318]"
                                              : "bg-[#EEF2F6] text-[#667085]"
                                        }`}
                                      >
                                        {footerMeta ?? (check.status === "pass" ? "Passing" : check.status === "fail" ? "Needs Fix" : "Review")}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <p className="mt-4 max-w-3xl text-lg font-medium leading-8 text-[#0A1628]">{getCheckHeadline(check)}</p>
                                {check.estimatedImpact ? (
                                  <p className="mt-3 max-w-3xl text-base leading-7 text-[#5B6776]">{check.estimatedImpact.replace(/^Estimated impact:\s*/i, "")}</p>
                                ) : null}
                              </div>
                              <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2">
                                <ChevronRightIcon className="flip-hint-icon h-4 w-4 shrink-0 text-[#9AA9B5] transition-colors group-hover:text-[#2DA4A9]" aria-hidden="true" />
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
                              Enter an email and we&apos;ll send the full report there. If you just need the link, you can copy it below instead.
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
                                placeholder="Email address"
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
                              <button
                                type="button"
                                onClick={() => void copyShareLink()}
                                className="report-btn-rounded inline-flex min-h-12 flex-1 items-center justify-center border border-[#D1DCE8] px-5 py-3 text-base text-[#0A1628] transition-colors hover:border-[#2DA4A9] hover:text-[#2DA4A9]"
                              >
                                {copied ? "Link Copied" : "Copy Share Link"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  ) : null}

                  {showEmailPrompt && !isTradeshowMode ? (
                    <motion.div
                      className="print-hidden fixed inset-0 z-50 flex items-center justify-center bg-[#0A1628]/55 px-4 py-6 backdrop-blur-[2px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowEmailPrompt(false)}
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
                          onClick={() => setShowEmailPrompt(false)}
                          className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center text-2xl leading-none text-[#9AA9B5] transition-colors hover:text-[#0A1628]"
                          aria-label="Close callback prompt"
                        >
                          <XMarkIcon className="h-7 w-7" aria-hidden="true" />
                        </button>

                        <div className="p-6 sm:p-8">
                          <div>
                            {emailPromptMode === "email" ? (
                              <>
                                <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">Take this report with you</p>
                                <p className="mt-3 text-2xl leading-9 text-[#0A1628]">Get your priority fix checklist by email</p>
                                <p className="mt-3 text-base leading-7 text-[#5B6776]">
                                  Enter your email and we&apos;ll send this full report plus the top fixes to tackle first.
                                </p>
                                <div className="mt-6 grid w-full grid-cols-1 gap-3">
                                  <input
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    value={engagementEmail}
                                    onChange={(event) => {
                                      setEngagementEmail(event.target.value);
                                      if (engagementPromptNotice) {
                                        setEngagementPromptNotice("");
                                      }
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void submitEngagementPrompt();
                                      }
                                    }}
                                    placeholder="Email address"
                                    className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-base text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] ${
                                      engagementPromptNotice ? "border-[#DC2626] focus:border-[#DC2626]" : "border-[#C4D3E2] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                                    }`}
                                  />
                                  {engagementPromptNotice ? <p className="-mt-1 text-left text-base text-[#B42318]">{engagementPromptNotice}</p> : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void submitEngagementPrompt()}
                                  className="report-btn-rounded mt-6 inline-flex min-h-12 w-full items-center justify-center bg-[#2DA4A9] px-5 py-3 text-base text-white transition-colors hover:bg-[#24858A] disabled:cursor-not-allowed disabled:opacity-70"
                                  disabled={isSubmittingEngagementPrompt}
                                >
                                  {isSubmittingEngagementPrompt ? "Sending..." : "Send My Report"}
                                </button>
                                <button
                                  type="button"
                                  onClick={openCallbackPromptStep}
                                  className="report-btn-rounded mt-3 inline-flex min-h-10 w-full items-center justify-center border border-[#D1DCE8] px-5 py-2 text-base text-[#0A1628] transition-colors hover:border-[#2DA4A9] hover:text-[#2DA4A9]"
                                >
                                  Prefer a callback instead?
                                </button>
                                <p className="mt-3 text-center text-xs leading-relaxed text-[#5B6776]">
                                  No spam. We only send your report and occasional tips. Unsubscribe anytime.
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">Need a second set of eyes?</p>
                                <p className="mt-3 text-2xl leading-9 text-[#0A1628]">Want us to take a look and call you back?</p>
                                <p className="mt-3 text-base leading-7 text-[#5B6776]">
                                  We&apos;ll pull up your site before we dial. Leave your name, email, and phone number and we&apos;ll reach out after reviewing the report.
                                </p>
                                <div className="mt-6 grid w-full grid-cols-1 gap-3">
                                  <input
                                    type="text"
                                    autoComplete="name"
                                    value={callbackName}
                                    onChange={(event) => {
                                      setCallbackName(event.target.value);
                                      if (callbackPromptNotice) {
                                        setCallbackPromptNotice("");
                                      }
                                    }}
                                    placeholder="Name"
                                    className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-base text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] ${
                                      callbackPromptNotice ? "border-[#DC2626] focus:border-[#DC2626]" : "border-[#C4D3E2] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                                    }`}
                                  />
                                  <input
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    value={callbackEmail}
                                    onChange={(event) => {
                                      setCallbackEmail(event.target.value);
                                      if (callbackPromptNotice) {
                                        setCallbackPromptNotice("");
                                      }
                                    }}
                                    placeholder="Email address"
                                    className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-base text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] ${
                                      callbackPromptNotice ? "border-[#DC2626] focus:border-[#DC2626]" : "border-[#C4D3E2] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                                    }`}
                                  />
                                  <input
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    value={callbackPhone}
                                    onChange={(event) => {
                                      setCallbackPhone(formatPhoneInput(event.target.value));
                                      if (callbackPromptNotice) {
                                        setCallbackPromptNotice("");
                                      }
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void submitCallbackPrompt();
                                      }
                                    }}
                                    placeholder="Phone number"
                                    className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-base text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] ${
                                      callbackPromptNotice ? "border-[#DC2626] focus:border-[#DC2626]" : "border-[#C4D3E2] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                                    }`}
                                  />
                                  {callbackPromptNotice ? <p className="-mt-1 text-left text-base text-[#B42318]">{callbackPromptNotice}</p> : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void submitCallbackPrompt()}
                                  className="report-btn-rounded mt-6 inline-flex min-h-12 w-full items-center justify-center bg-[#2DA4A9] px-5 py-3 text-base text-white transition-colors hover:bg-[#24858A] disabled:cursor-not-allowed disabled:opacity-70"
                                  disabled={isSubmittingCallbackPrompt}
                                >
                                  {isSubmittingCallbackPrompt ? "Sending..." : "Request a Callback"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEmailPromptMode("email")}
                                  className="report-btn-rounded mt-3 inline-flex min-h-10 w-full items-center justify-center border border-[#D1DCE8] px-5 py-2 text-base text-[#0A1628] transition-colors hover:border-[#2DA4A9] hover:text-[#2DA4A9]"
                                >
                                  Back to email option
                                </button>
                                <p className="mt-3 text-center text-xs leading-relaxed text-[#5B6776]">
                                  By submitting this form, you agree to hear from Bucky Solutions about this report.{' '}
                                  <a href="https://www.buckysolutions.com/privacy-policy/" target="_blank" rel="noreferrer" className="text-[#2DA4A9]">
                                    Privacy Policy
                                  </a>
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  ) : null}

                  {pendingProtectedAction ? (
                    <motion.div
                      className="print-hidden fixed inset-0 z-50 flex items-center justify-center bg-[#0A1628]/55 px-4 py-6 backdrop-blur-[2px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setPendingProtectedAction(null)}
                    >
                      <motion.div
                        className="relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-[#DCE6EE] bg-[rgba(248,250,252,0.92)] shadow-[0_24px_80px_rgba(10,22,40,0.24)] backdrop-blur-sm"
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.97 }}
                        transition={{ type: "spring", damping: 26, stiffness: 300 }}
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
                          <div>
                            <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">One quick step</p>
                            <p className="mt-3 text-2xl leading-9 text-[#0A1628]">Get your full report</p>
                            <p className="mt-3 text-base leading-7 text-[#5B6776]">
                              Enter your email and we&apos;ll send the complete breakdown — every check, what&apos;s failing, and how to fix it — straight to your inbox.
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
                              {isSubmittingLead ? "Sending..." : "Send My Free Report"}
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
                        className="relative w-full max-w-[400px] overflow-hidden rounded-2xl border border-[#E6EBF0] bg-[#fafcfd] shadow-[0_24px_80px_rgba(10,22,40,0.24)]"
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.97 }}
                        transition={{ type: "spring", damping: 26, stiffness: 300 }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setIsQrModalOpen(false)}
                          className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center text-2xl leading-none text-[#9AA9B5] transition-colors hover:text-[#0A1628]"
                          aria-label="Close QR code"
                        >
                          <XMarkIcon className="h-7 w-7" aria-hidden="true" />
                        </button>
                        <div className="border-b border-[#E6EBF0] px-6 pb-5 pt-6 sm:px-8">
                          <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">Share Report</p>
                          <p className="mt-2 text-2xl leading-9 text-[#0A1628]">Scan this QR code</p>
                          <p className="mt-2 text-base leading-7 text-[#5B6776]">Open this report instantly on another device.</p>
                        </div>
                        <div className="flex flex-col items-center px-6 pb-6 pt-6 sm:px-8">
                          {qrCodeDataUrl ? (
                            <div className="rounded-xl border border-[#E6EBF0] bg-white p-3 shadow-[0_8px_20px_rgba(10,22,40,0.08)]">
                              <Image src={qrCodeDataUrl} alt="QR code to open this audit report" width={176} height={176} className="h-[176px] w-[176px]" unoptimized />
                            </div>
                          ) : isGeneratingQrCode ? (
                            <div className="flex h-[202px] w-[202px] items-center justify-center rounded-xl border border-[#E6EBF0] bg-white text-base text-[#5B6776]">
                              Preparing QR code...
                            </div>
                          ) : (
                            <p className="text-base text-[#5B6776]">QR code unavailable right now.</p>
                          )}
                          {shareLink ? (
                            <button
                              type="button"
                              onClick={() => void copyShareLink()}
                              className="report-btn-rounded mt-5 inline-flex min-h-10 w-full items-center justify-center border border-[#D1DCE8] px-4 py-2 text-base text-[#0A1628] transition-colors hover:border-[#2DA4A9] hover:text-[#2DA4A9]"
                            >
                              {copied ? "Copied" : "Copy Share Link"}
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
                        className="relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-[#DCE6EE] bg-[rgba(248,250,252,0.92)] shadow-[0_24px_80px_rgba(10,22,40,0.24)] backdrop-blur-sm"
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.97 }}
                        transition={{ type: "spring", damping: 26, stiffness: 300 }}
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
                          {showFixContent && !showCheckHelpForm ? (
                            <>
                              <div>
                                <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">{getCheckDisplayLabel(activeCheck)}</p>
                              </div>
                              <p className="mt-3 text-xl font-medium leading-8 text-[#0A1628]">{getCheckHeadline(activeCheck)}</p>
                            </>
                          ) : null}
                          {showFixContent && !showCheckHelpForm ? (
                            <div className="mt-5">
                              <p className="text-base leading-7 text-[#5B6776]">
                                {activeCheck.status === "pass"
                                  ? activeCheckBenefit
                                  : renderInlineReviewLinkedDetails(activeCheck, activeCheckDirectFix)}
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

                          {showFixContent && showCheckHelpForm ? (
                            <div>
                              {checkHelpSubmitted ? (
                                <div className="space-y-3">
                                  <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">Request received</p>
                                  <p className="text-2xl leading-9 text-[#0A1628]">We&apos;ll follow up on this issue shortly</p>
                                  <p className="text-base leading-7 text-[#5B6776]">Thanks. We&apos;ll review this check and reach out with next steps.</p>
                                  <div className="mt-4 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setShowCheckHelpForm(false)}
                                      className="report-btn-rounded inline-flex min-h-10 items-center justify-center border border-[#D1DCE8] px-4 py-2 text-base text-[#0A1628] transition-colors hover:border-[#2DA4A9] hover:text-[#2DA4A9]"
                                    >
                                      Close
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">{getCheckDisplayLabel(activeCheck)}</p>
                                  <p className="text-2xl leading-9 text-[#0A1628]">Tell us where to reach you</p>
                                  <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                                    <input
                                      type="text"
                                      autoComplete="name"
                                      value={checkHelpName}
                                      onChange={(event) => {
                                        setCheckHelpName(event.target.value);
                                        if (checkHelpNotice) {
                                          setCheckHelpNotice("");
                                        }
                                      }}
                                      placeholder="Name"
                                      className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-base text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] ${
                                        checkHelpNotice ? "border-[#DC2626] focus:border-[#DC2626]" : "border-[#C4D3E2] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                                      }`}
                                    />
                                    <input
                                      type="tel"
                                      inputMode="tel"
                                      autoComplete="tel"
                                      value={checkHelpPhone}
                                      onChange={(event) => {
                                        setCheckHelpPhone(formatPhoneInput(event.target.value));
                                        if (checkHelpNotice) {
                                          setCheckHelpNotice("");
                                        }
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          void submitCheckHelpRequest();
                                        }
                                      }}
                                      placeholder="Phone"
                                      className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-base text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] ${
                                        checkHelpNotice ? "border-[#DC2626] focus:border-[#DC2626]" : "border-[#C4D3E2] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                                      }`}
                                    />
                                  </div>
                                  {checkHelpNotice ? <p className="text-sm text-[#B42318]">{checkHelpNotice}</p> : null}
                                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setShowCheckHelpForm(false)}
                                      className="report-btn-rounded inline-flex min-h-10 items-center justify-center border border-[#D1DCE8] px-4 py-2 text-base text-[#0A1628] transition-colors hover:border-[#2DA4A9] hover:text-[#2DA4A9]"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void submitCheckHelpRequest()}
                                      disabled={isSubmittingCheckHelp}
                                      className="report-btn-rounded inline-flex min-h-10 items-center justify-center bg-[#2DA4A9] px-4 py-2 text-base text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                      {isSubmittingCheckHelp ? "Sending..." : "Request Help"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}

                          {!showFixContent ? (
                              <div>
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

                        {showFixContent && !showCheckHelpForm ? (
                          <div className="border-t border-[#E6EBF0] px-6 py-4 sm:px-8">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <p className="hidden text-base text-[#5B6776] sm:block">
                                {activeCheck.status === "fail"
                                  ? "Need this fixed for you?"
                                  : activeCheck.status === "pass"
                                    ? "Want to strengthen this area even more?"
                                    : "Want help validating this area?"}
                              </p>
                              {activeCheck.status === "pass" ? (
                                <a
                                  href={activeCheckCta.href}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="report-btn-rounded inline-flex w-full items-center justify-center bg-[#2DA4A9] px-4 py-2 text-base text-white transition-opacity hover:opacity-90 sm:w-auto"
                                >
                                  {activeCheckCta.buttonLabel}
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowCheckHelpForm(true);
                                    setCheckHelpSubmitted(false);
                                    setCheckHelpNotice("");
                                    setCheckHelpName(name);
                                    setCheckHelpPhone("");
                                  }}
                                  className="report-btn-rounded inline-flex w-full items-center justify-center bg-[#2DA4A9] px-4 py-2 text-base text-white transition-opacity hover:opacity-90 sm:w-auto"
                                >
                                  {activeCheckCta.buttonLabel}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : null}
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
