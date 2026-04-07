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
  | "Technical Performance"
  | "Booking & Conversion"
  | "Outdoor Hospitality Essentials"
  | "Local & Online Visibility"
  | "Mobile Experience"
  | "Booking Psychology";
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

const PARKGRADER_LOGO = "https://assets.buckysolutions.com/bucky_logo_parkgrader.svg";

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
  "Technical Performance",
  "Booking & Conversion",
  "Outdoor Hospitality Essentials",
  "Local & Online Visibility",
  "Mobile Experience",
  "Booking Psychology",
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
  "Technical Performance": BoltIcon,
  "Booking & Conversion": CalendarDaysIcon,
  "Outdoor Hospitality Essentials": HomeModernIcon,
  "Local & Online Visibility": MagnifyingGlassIcon,
  "Mobile Experience": DevicePhoneMobileIcon,
  "Booking Psychology": SparklesIcon,
};

const PAIN_LEVEL_ICON_BY_KEY: Record<PainLevel, HeroIcon> = {
  "money-losers": ExclamationCircleIcon,
  "maintenance-needed": ClockIcon,
  watchlist: QueueListIcon,
  "working-well": CheckCircleIcon,
};

const CHECK_ICON_BY_ID: Record<string, HeroIcon> = {
  "technical-trust-security": ShieldCheckIcon,
  "ssl-valid": ShieldCheckIcon,
  "https-redirect": ShieldCheckIcon,
  "response-time": BoltIcon,
  "broken-links": LinkIcon,
  "pagespeed-mobile": DevicePhoneMobileIcon,
  "canonical-redirect-hygiene": GlobeAltIcon,
  "booking-platform": CalendarDaysIcon,
  "booking-engine-health": BoltIcon,
  "booking-cta": ArrowRightIcon,
  "date-picker-discoverability": CalendarDaysIcon,
  "tracking-pixels": ChartBarSquareIcon,
  "abandonment-recovery-readiness": ChartBarSquareIcon,
  "newsletter-capture": EnvelopeIcon,
  "pet-policy": QueueListIcon,
  "rv-hookup-specs": TruckIcon,
  "big-rig-readiness": TruckIcon,
  "wifi-quality-claims": BoltIcon,
  "arrival-directions-clarity": MapPinIcon,
  "ev-extra-vehicle-policy": CreditCardIcon,
  "amenities-page": HomeModernIcon,
  "rate-page": ReceiptPercentIcon,
  "cancellation-policy": DocumentTextIcon,
  "photo-gallery-quality": PhotoIcon,
  "accessibility-statement": UserCircleIcon,
  "meta-title": TagIcon,
  "meta-description": NewspaperIcon,
  "gbp-sync": MapPinIcon,
  "local-review-competitiveness": MapPinIcon,
  "social-presence": UsersIcon,
  "listing-signals": ClipboardDocumentListIcon,
  "facebook-link": LinkIcon,
  "mobile-viewport": DevicePhoneMobileIcon,
  "header-phone": PhoneIcon,
  "mobile-tap-targets": DevicePhoneMobileIcon,
  "phone-conversion-readiness": PhoneIcon,
  "image-count": PhotoIcon,
  "listing-completeness": ClipboardDocumentListIcon,
  "rate-transparency": ReceiptPercentIcon,
  "contact-friction": PhoneIcon,
  "trust-stack-completeness": ShieldCheckIcon,
  "local-search-intent-coverage": MagnifyingGlassIcon,
  "visual-proof-relevance": PhotoIcon,
  "visual-trust": PhotoIcon,
  "seasonal-visibility": SunIcon,
  "visual-storytelling": PhotoIcon,
  "payment-flexibility": CreditCardIcon,
  "structured-data": GlobeAltIcon,
  "accessibility-score": UserCircleIcon,
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
      id: "ssl-valid",
      name: "SSL certificate",
      category: "Technical Performance",
      status: "pass",
      pass: true,
      finding: "Certificate is valid and secure.",
      details: "Guests can trust the booking flow from the first click.",
      weight: 1,
      effort: "Low",
      impact: "High",
      serviceKey: "ssl",
    },
    {
      id: "pagespeed-mobile",
      name: "Mobile performance",
      category: "Technical Performance",
      status: good ? "pass" : "fail",
      pass: good,
      finding: good ? "Mobile performance score 84." : "Mobile performance score 39.",
      details: good
        ? "The experience loads quickly enough to support direct bookings."
        : "A slow mobile experience is pushing high-intent guests away before they inquire.",
      weight: 1,
      effort: "Medium",
      impact: "High",
      serviceKey: "pagespeed",
    },
    {
      id: "booking-cta",
      name: "Primary booking CTA",
      category: "Booking & Conversion",
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
      category: "Booking & Conversion",
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
      id: "photo-gallery-quality",
      name: "Photo gallery quality",
      category: "Outdoor Hospitality Essentials",
      status: good ? "pass" : "fail",
      pass: good,
      finding: good ? "9 strong visual assets found." : "Only 3 strong visual assets found.",
      details: good
        ? "The stay is well merchandised visually."
        : "Guests cannot picture the experience well enough to feel confident booking.",
      weight: 1,
      effort: "Medium",
      impact: "High",
      serviceKey: "photos",
    },
    {
      id: "rate-page",
      name: "Rates or pricing visibility",
      category: "Outdoor Hospitality Essentials",
      status: good ? "pass" : "fail",
      pass: good,
      finding: good ? "Pricing information is visible." : "No visible pricing information found.",
      details: good
        ? "Guests can self-qualify quickly."
        : "Hiding pricing often increases bounce and inquiry fatigue.",
      weight: 1,
      effort: "Low",
      impact: "High",
      serviceKey: "booking_cta",
    },
    {
      id: "gbp-sync",
      name: "Google Business Profile",
      category: "Local & Online Visibility",
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
      name: "Mobile viewport meta",
      category: "Mobile Experience",
      status: good ? "pass" : "fail",
      pass: good,
      finding: good ? "Viewport meta tag detected." : "Viewport meta tag is missing.",
      details: good
        ? "Phones are receiving proper responsive layout instructions."
        : "Mobile visitors are likely dealing with zoom and layout issues.",
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
      "Technical Performance": 15,
      "Booking & Conversion": 25,
      "Outdoor Hospitality Essentials": 25,
      "Local & Online Visibility": 20,
      "Mobile Experience": 15,
      "Booking Psychology": 10,
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
          "Your visual storytelling is not doing enough work.",
          "Hidden pricing is forcing visitors to bounce.",
        ],
    topFails: good ? ["tracking-pixels"] : ["pagespeed-mobile", "booking-cta", "photo-gallery-quality"],
    categories,
    checks,
  };
};

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
      className={`${fixed ? "fixed" : "relative"} bottom-4 left-1/2 z-20 -translate-x-1/2 text-xs text-[#5B6776] print-hidden`}
    >
      <div className="flex items-center gap-2 whitespace-nowrap px-1 py-1">
        <a className="hover:text-[#0A1628]" href="https://www.buckysolutions.com/privacy-policy/" target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
        <span>·</span>
        <a className="hover:text-[#0A1628]" href="https://www.buckysolutions.com/cookie-policy/" target="_blank" rel="noreferrer">
          Cookie Policy
        </a>
        <span>·</span>
        <a className="hover:text-[#0A1628]" href="https://www.buckysolutions.com/terms-and-conditions/" target="_blank" rel="noreferrer">
          Terms and Conditions
        </a>
      </div>
    </footer>
  );
}

function TopographicPanel() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.75),rgba(248,250,252,0.96)_52%,rgba(248,250,252,1)_100%)]" />
      <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 800 800" preserveAspectRatio="none">
        {Array.from({ length: 16 }).map((_, index) => (
          <path
            key={index}
            d={`M -50 ${30 + index * 50} C 100 ${index * 30}, 300 ${100 + index * 24}, 850 ${40 + index * 46}`}
            stroke="#D8E0EA"
            strokeWidth="1"
            fill="none"
            opacity="0.9"
          />
        ))}
      </svg>
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
  "ssl-valid": {
    buttonLabel: "Harden site security",
    href: "https://www.buckysolutions.com/services/cybersecurity/",
  },
  "https-redirect": {
    buttonLabel: "Fix secure redirects",
    href: "https://www.buckysolutions.com/services/cybersecurity/",
  },
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
  "canonical-redirect-hygiene": {
    buttonLabel: "Fix URL setup",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "technical-trust-security": {
    buttonLabel: "Fix trust + security setup",
    href: "https://www.buckysolutions.com/services/cybersecurity/",
  },
  "booking-platform": {
    buttonLabel: "Upgrade booking stack",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "booking-engine-health": {
    buttonLabel: "Fix booking uptime",
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
  "tracking-pixels": {
    buttonLabel: "Set up tracking",
    href: "https://www.buckysolutions.com/services/vendor-management/",
  },
  "abandonment-recovery-readiness": {
    buttonLabel: "Set up recovery tracking",
    href: "https://www.buckysolutions.com/services/vendor-management/",
  },
  "newsletter-capture": {
    buttonLabel: "Add email capture",
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
  "wifi-quality-claims": {
    buttonLabel: "Clarify Wi-Fi quality",
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
  "rate-page": {
    buttonLabel: "Improve pricing visibility",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "cancellation-policy": {
    buttonLabel: "Add clear policy",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "photo-gallery-quality": {
    buttonLabel: "Upgrade photos",
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
  "listing-signals": {
    buttonLabel: "Strengthen listings",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "facebook-link": {
    buttonLabel: "Fix social links",
    href: "https://www.buckysolutions.com/services/vendor-management/",
  },
  "mobile-viewport": {
    buttonLabel: "Improve mobile rendering",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "header-phone": {
    buttonLabel: "Improve call conversion",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "mobile-tap-targets": {
    buttonLabel: "Improve mobile tap targets",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "phone-conversion-readiness": {
    buttonLabel: "Improve phone booking path",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "image-count": {
    buttonLabel: "Improve visual content",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "listing-completeness": {
    buttonLabel: "Complete listing profile",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "rate-transparency": {
    buttonLabel: "Improve rate transparency",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "contact-friction": {
    buttonLabel: "Reduce contact friction",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "trust-stack-completeness": {
    buttonLabel: "Strengthen trust signals",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "local-search-intent-coverage": {
    buttonLabel: "Improve local search basics",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "visual-proof-relevance": {
    buttonLabel: "Improve key proof photos",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "seasonal-visibility": {
    buttonLabel: "Improve offer visibility",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "visual-storytelling": {
    buttonLabel: "Strengthen storytelling",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
  "payment-flexibility": {
    buttonLabel: "Improve payment options",
    href: "https://www.buckysolutions.com/services/booking-automation/",
  },
  "structured-data": {
    buttonLabel: "Add structured data",
    href: "https://www.buckysolutions.com/services/local-seo/",
  },
  "accessibility-score": {
    buttonLabel: "Improve accessibility",
    href: "https://www.buckysolutions.com/services/website-management/",
  },
};

const PASS_LEARN_CTA_BY_ID: Record<string, string> = {
  "ssl-valid": "Learn about site security",
  "https-redirect": "Learn about secure routing",
  "response-time": "Learn about fast load speed",
  "broken-links": "Learn about link health",
  "pagespeed-mobile": "Learn about mobile speed",
  "canonical-redirect-hygiene": "Learn about URL consistency",
  "technical-trust-security": "Learn about trust signals",
  "mobile-viewport": "Learn about mobile readiness",
  "meta-title": "Learn about search signage",
  "meta-description": "Learn about search snippets",
  "booking-platform": "Learn about booking systems",
  "booking-engine-health": "Learn about booking uptime",
  "booking-cta": "Learn about booking visibility",
  "date-picker-discoverability": "Learn about date pickers",
  "tracking-pixels": "Learn about guest tracking",
  "abandonment-recovery-readiness": "Learn about recovery tracking",
  "newsletter-capture": "Learn about email capture",
  "pet-policy": "Learn about pet policies",
  "rv-hookup-specs": "Learn about hookup specs",
  "big-rig-readiness": "Learn about rig readiness",
  "wifi-quality-claims": "Learn about Wi-Fi claims",
  "arrival-directions-clarity": "Learn about arrival directions",
  "ev-extra-vehicle-policy": "Learn about vehicle policies",
  "amenities-page": "Learn about amenity pages",
  "rate-page": "Learn about pricing pages",
  "cancellation-policy": "Learn about cancellation policies",
  "photo-gallery-quality": "Learn about photo quality",
  "accessibility-statement": "Learn about accessibility",
  "gbp-sync": "Learn about Google listings",
  "local-review-competitiveness": "Learn about review strategy",
  "social-presence": "Learn about social presence",
  "listing-signals": "Learn about listing strength",
  "facebook-link": "Learn about social links",
  "header-phone": "Learn about call conversion",
  "mobile-tap-targets": "Learn about tap targets",
  "phone-conversion-readiness": "Learn about phone bookings",
  "image-count": "Learn about visual content",
  "listing-completeness": "Learn about listing profiles",
  "rate-transparency": "Learn about rate clarity",
  "contact-friction": "Learn about contact ease",
  "trust-stack-completeness": "Learn about trust signals",
  "local-search-intent-coverage": "Learn about local search",
  "visual-proof-relevance": "Learn about proof photos",
  "seasonal-visibility": "Learn about seasonal offers",
  "visual-storytelling": "Learn about storytelling",
  "visual-trust": "Learn about visual trust",
  "payment-flexibility": "Learn about payment options",
  "booking-click-depth": "Learn about booking depth",
  "availability-visibility": "Learn about availability",
  "fee-transparency": "Learn about fee clarity",
  "onsite-guest-proof": "Learn about guest proof",
  "authentic-photography": "Learn about authentic photos",
  "structured-data": "Learn about structured data",
  "accessibility-score": "Learn about accessibility",
};

const PASS_BENEFIT_BY_ID: Record<string, string> = {
  "ssl-valid": "Security guard active: your site is locked and safe for guest information and card details.",
  "https-redirect": "Your website automatically sends visitors to a secure connection. This protects guest privacy and avoids trust-breaking unsafe warnings.",
  "response-time": "Fast loading: guests can open your site quickly without frustration, so more high-intent visitors stay on the booking path.",
  "mobile-viewport": "Smartphone ready: your website layout stays readable and easy to use when guests look you up from the road.",
  "meta-title": "Search engine signage: your Google listing label is clear, so the right guests can recognize your park faster.",
  "meta-description": "Your search preview explains the value of your park clearly, improving click quality from potential guests.",
  "broken-links": "All internal links are working correctly. Guests and search engines can navigate your site without hitting dead ends.",
  "pagespeed-mobile": "Your site loads quickly on mobile devices, keeping road-tripping guests engaged instead of bouncing to a competitor.",
  "canonical-redirect-hygiene": "Your URL structure is clean and consistent, so search engines index one authoritative version of your site.",
  "technical-trust-security": "Your technical trust stack is solid — SSL, HTTPS, and canonical tags are all aligned and working together.",
  "booking-platform": "You have an online booking system in place. Guests can check dates and reserve without needing to call or email.",
  "booking-engine-health": "Your booking page loads reliably and responds quickly, so guests aren't blocked when they're ready to pay.",
  "booking-cta": "Your booking button is clearly visible, making it easy for motivated guests to start a reservation right away.",
  "date-picker-discoverability": "Guests can quickly find where to check available dates, reducing friction at the most critical step.",
  "tracking-pixels": "Analytics tracking is installed, giving you visibility into how guests find your site and what they do before booking.",
  "abandonment-recovery-readiness": "Booking-step events are in place so you can follow up with guests who start but don't finish reservations.",
  "newsletter-capture": "You're collecting guest emails, which means you can fill shoulder-season openings and build repeat bookings over time.",
  "pet-policy": "Your pet policy is published and easy to find. Pet owners can self-qualify before booking, reducing pre-trip calls.",
  "rv-hookup-specs": "Hookup specifications are clearly listed, helping RV travelers confirm compatibility before driving to your property.",
  "big-rig-readiness": "Big-rig details like max length and pull-through availability are visible, so large-rig owners can book with confidence.",
  "wifi-quality-claims": "Wi-Fi quality claims are clearly stated, helping remote workers and streaming-dependent guests set the right expectations.",
  "arrival-directions-clarity": "Clear arrival directions are published, helping guests navigate confidently and start their stay without stress.",
  "ev-extra-vehicle-policy": "Vehicle and EV policies are visible, reducing checkout hesitation and pre-booking support calls.",
  "amenities-page": "Amenity information is easy to find, giving guests the details they need to picture their stay and commit to booking.",
  "rate-page": "Pricing is visible and transparent, so guests can evaluate your property without needing to contact you first.",
  "cancellation-policy": "Your cancellation policy is published and clear, building trust and reducing booking hesitation.",
  "photo-gallery-quality": "Your photos are high quality and representative, helping guests picture the experience before they arrive.",
  "accessibility-statement": "Accessibility information is available, helping guests with mobility or access needs plan their visit.",
  "gbp-sync": "Your Google Business Profile is active and consistent with your website, strengthening local search visibility.",
  "local-review-competitiveness": "Your review volume and ratings are competitive locally, supporting trust and search ranking in your area.",
  "social-presence": "Active social profiles are linked from your site, giving guests additional proof that your property is real and active.",
  "listing-signals": "Directory listing signals are healthy, keeping your property visible across the channels where guests discover new parks.",
  "facebook-link": "Your Facebook link is working and reachable, maintaining a connected social presence that supports guest trust.",
  "header-phone": "A phone number is prominently displayed, giving guests a direct line when they're ready to book or have questions.",
  "mobile-tap-targets": "Tap targets on your mobile site are properly sized, making navigation easy for guests browsing on their phones.",
  "phone-conversion-readiness": "Your phone booking path is smooth and accessible, capturing guests who prefer to reserve by phone.",
  "image-count": "Your site has strong visual content volume, giving guests enough imagery to feel confident about booking.",
  "listing-completeness": "Your listing profiles are thorough and complete, maximizing your visibility on discovery platforms.",
  "rate-transparency": "Rates are clearly displayed before checkout, building trust and reducing abandoned bookings.",
  "contact-friction": "Contacting you is simple and low-friction, so guests with questions can reach you quickly and book faster.",
  "trust-stack-completeness": "Key trust signals — reviews, security, and policies — are visible where guests need them most.",
  "local-search-intent-coverage": "Your homepage clearly states what you are and where you are, helping local searchers find you faster.",
  "visual-proof-relevance": "Key proof photos cover the essentials guests care about — sites, bathrooms, amenities, and arrival.",
  "seasonal-visibility": "Current promotions and seasonal offers are prominently displayed, helping convert price-sensitive searchers.",
  "visual-storytelling": "Your visual content tells the story of the guest experience, helping visitors imagine their stay and commit to booking.",
  "visual-trust": "Your images look authentic and recent, building trust that what guests see online matches what they'll find on arrival.",
  "payment-flexibility": "Multiple payment options are available at checkout, reducing the chance guests abandon over payment limitations.",
  "booking-click-depth": "Guests can go from your homepage to a completed booking in just a few clicks, minimizing drop-off along the way.",
  "availability-visibility": "Date availability is easy to check, so guests comparing parks can quickly see if you have open sites for their trip.",
  "fee-transparency": "All fees are disclosed before the final payment screen, so guests feel informed and are less likely to abandon checkout.",
  "onsite-guest-proof": "Real guest reviews are displayed on your site, building trust faster than anything you could write yourself.",
  "authentic-photography": "Your photos look genuine and property-specific, giving guests confidence that the real experience matches the website.",
  "structured-data": "Structured data is present on your site, helping Google display rich search results with stars, pricing, and business details.",
  "accessibility-score": "Your site scores well on accessibility, making it usable for guests with disabilities and improving overall user experience.",
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
  "Technical Performance": 0,
  "Booking & Conversion": 1,
  "Outdoor Hospitality Essentials": 2,
  "Local & Online Visibility": 3,
  "Mobile Experience": 4,
  "Booking Psychology": 5,
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
  "ssl-valid":
    "Your hosting company can turn this on for free in most cases — it's often a one-click option in your control panel. Search for \"SSL certificate\" in your hosting dashboard, or call your host and ask them to enable it. Once it's on, your site address will start with https:// and browsers will stop showing the \"Not Secure\" warning to your guests.",
  "https-redirect":
    "Even with SSL turned on, your site might still load the old http:// version for some visitors. Ask your web person or host to add a redirect that automatically sends everyone to the secure https:// version. This is usually a one-line change to a file called .htaccess, or a toggle in your hosting settings.",
  "response-time":
    "Large photo files are the #1 cause of slow websites. Compress your images before uploading using a free tool like Squoosh. Ask your host if they offer caching — it's usually free and makes a huge difference for repeat visitors.",
  "broken-links":
    "Broken links often happen when you update a page or rename something and forget to update the links pointing to it. Walk through your main navigation, footer, and any 'Book Now' buttons and click each one to make sure they still work. A free tool like Dead Link Checker (deadlinkchecker.com) can scan your whole site automatically and list every broken link in one report.",
  "pagespeed-mobile":
    "The fastest way to fix this is to share the PageSpeed report below with your web developer or hosting provider. They'll see exactly which files are slowing you down and how to fix them. If you're doing it yourself, focus on compressing photos, removing unused plugins, and turning off auto-play videos.",
  "canonical-redirect-hygiene":
    "Ask your web person to pick one official website address (for example, https://www.yourpark.com) and force all other versions to redirect to it. Then set your canonical tag to that same exact address on each page. This keeps Google and guests from seeing multiple versions of the same page.",
  "technical-trust-security":
    "Treat this as one cleanup task: make sure your SSL is valid, force all traffic to HTTPS, and set canonical tags to your one preferred host. Ask your web person to confirm all three are aligned so guests always land on one secure version of your site.",
  "booking-platform":
    "Guests expect to be able to check dates and reserve online without having to call or email first. If you don't have an online booking system, popular options for campgrounds and RV parks include Campspot, CampLife, and Rezdy. Many connect directly to your website. If you're not sure where to start, contact one of those providers and ask for a demo — setup is usually straightforward.",
  "booking-engine-health":
    "Click your main booking link from your homepage on both phone and desktop and make sure it opens fast and works every time. If it fails or hangs, contact your booking provider support and your website host with a screenshot and the exact time it happened. A simple uptime monitor can alert you if the booking page goes down again.",
  "booking-cta":
    "Every page on your site should have one clear button that says something like \"Reserve Your Site\" or \"Check Availability\" — and it should be easy to spot without scrolling. Place it near the top of the page in a color that stands out. If your site only has a phone number or a contact form, guests who prefer booking online will leave.",
  "date-picker-discoverability":
    "Put a date picker or a clear 'Check Availability' button near the top of your homepage so guests can start right away. Do not hide date search behind multiple clicks or deep menu pages. People comparing parks quickly will leave if they cannot check dates in a few seconds.",
  "tracking-pixels":
    "Without tracking in place, you have no way of knowing how guests found your site or what they did before booking. Google Analytics is free and takes about 15 minutes to set up — search \"install Google Analytics\" and follow the step-by-step guide, or have your web person add a small snippet of code to every page. Once it's running, you can see things like how many people visited, where they came from, and which pages they left from.",
  "abandonment-recovery-readiness":
    "Set up tracking for key booking steps like 'begin checkout' and 'booking complete' so you can follow up with people who quit halfway. Some booking vendors fire these events in ways that source scans cannot see, so ask your booking vendor or web person to confirm the events in GA4 DebugView and Meta Test Events. Once this is in place, you can run simple reminder ads to bring interested guests back.",
  "newsletter-capture":
    "An email list is one of the most reliable ways to fill open sites, especially in shoulder seasons. Add a simple signup form to your homepage with a short reason to join — something like \"Get early access to seasonal deals and local trip ideas.\" If writing that sounds annoying, use AI to draft the headline and signup copy for you, then paste it onto your site. Free tools like Mailchimp or Constant Contact let you collect emails and send newsletters without any technical setup.",
  "pet-policy":
    "Pet owners look for pet-friendly parks before booking, so make it obvious on your site what pets are allowed, any size or breed limits, any extra fees, and leash rules. If you do not want to write that yourself, hit the AI button below and let it draft the policy for you.",
  "rv-hookup-specs":
    "RV travelers need to know if your hookups match their rig before they drive hours to get there. List the details for each site type: 30-amp or 50-amp power, water hookup, sewer connection (full hookup, water and electric only, dry camping, etc.), and max rig length if there's a limit. A simple table or bullet list on your site pages is enough — don't make guests call to find out.",
  "big-rig-readiness":
    "Add two details right next to site selection: maximum rig length and whether each site is pull-through or back-in. Big-rig owners will skip booking if they cannot confirm fit in seconds.",
  "wifi-quality-claims":
    "If you offer Wi-Fi, say how good it is in plain language: for example 'Streaming-friendly at main sites' or 'Good for email and browsing.' If you know your speed range, include it so remote workers can self-qualify.",
  "arrival-directions-clarity":
    "Create a short 'Getting Here' section with the exact entrance instructions and any GPS warnings (like low-clearance bridges or roads to avoid). This prevents stressful arrivals and angry first impressions.",
  "ev-extra-vehicle-policy":
    "Publish a simple vehicle policy page that answers two common questions: EV charging rules and extra vehicle fees/limits. Clear rules reduce pre-booking calls and checkout hesitation.",
  "amenities-page":
    "A clear amenities page helps guests picture their stay and decide to book. List everything you offer — pool, bathhouses, laundry, fire pits, store, dog park, playground, Wi-Fi — and for each one, add a photo and a short note like the hours or location. Guests who can visualize the experience are much more likely to book.",
  "rate-page":
    "Guests who can't find your prices often don't call to ask — they just leave. Show your nightly or weekly rates on the site with a basic breakdown by site type (tent, RV full hookup, cabin, etc.) and note any seasonal changes. You don't need to list every fee, but showing a starting price helps guests know whether they're in the right place before they spend time trying to book.",
  "cancellation-policy":
    "Guests won't book if they're afraid of losing money on a non-refundable reservation. Put your cancellation policy in plain language on your site: how many days ahead someone needs to cancel, whether they get a full refund or a credit, and whether there are exceptions for weather or emergencies. If needed, use AI to write a plain-English version for you, then paste it onto your site. Link to your policy from the booking page so guests see it before they pay.",
  "photo-gallery-quality":
    "Bad photos are one of the biggest reasons guests choose a competitor. Every photo on your site should be taken in good natural light (not at night or on a cloudy day), shot horizontally, and show the best parts of your property. At minimum, you want photos of your best RV sites, cabins or glamping units, the bathhouse, common areas, and your entry or welcome sign. A local real estate or event photographer can shoot a full property set for $200–$500 and the difference is almost always worth it.",
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
  "listing-signals":
    "This check looks for directory signals on your site, not a live scan of The Dyrt, Campendium, Hipcamp, or RV Life. If you are not listed on those platforms yet, claim or create profiles there, keep your address, phone, and website consistent, and add real photos so guests can find you more easily.",
  "facebook-link":
    "The Facebook link on your site is pointing to a page that no longer works or doesn't exist. Log in to Facebook and find your official business page URL, then update the link on your website to match. If you don't have an active Facebook page for your park, either remove the icon from your site or create a page — a broken social link makes your site look abandoned.",
  "mobile-viewport":
    "When a site doesn't display correctly on phones, text appears tiny, buttons are too small to tap, and guests have to pinch and zoom just to read anything. This is usually a settings issue rather than a big redesign. If your site is on a platform like Squarespace, Wix, or WordPress, open the mobile preview and check how each page looks. Ask your web person to confirm that the mobile viewport tag is set correctly — it's a quick fix.",
  "header-phone":
    "When guests are looking up your park on their phone, they often want to call right away. Make sure your phone number is visible at the top of the page on mobile — ideally as a tappable link that opens the dialer automatically. On most website platforms, you can add a click-to-call link by formatting your phone number like this: tel:+18005551234. Your web person can also add a sticky header bar with a call button that follows guests as they scroll.",
  "mobile-tap-targets":
    "On phones, make your main 'Book' and 'Call' buttons large enough to tap easily with one thumb. Keep space around them so guests do not hit the wrong link by mistake. Preview your site on a real phone and make sure booking actions are easy to tap without zooming.",
  "phone-conversion-readiness":
    "Put your phone number at the top of mobile pages and make it tap-to-call. Add simple wording like 'Call now for same-day availability' near the number so guests know what to do. If people have to search for your number or copy-paste it, you lose calls.",
  "image-count":
    "Your homepage doesn't have enough photos to give guests a feel for the experience. Most guests want to see the actual sites, the bathhouse, any recreation areas, and the general vibe of the property before booking. Aim for at least 6–10 photos on your homepage or gallery. You don't need a professional shoot — a recent smartphone photo in good daylight is much better than no photo.",
  "listing-completeness":
    "Empty sections in your online listings signal to guests (and to booking platforms) that your park is incomplete or undermanaged. Log in to each platform where you have a listing — your booking engine, Google, The Dyrt, Hipcamp, etc. — and fill in every section: description, photos, amenities, rules, cancellation policy, and rates. Platforms reward complete listings with better visibility in search results.",
  "rate-transparency":
    "Guests often abandon a booking when the price jumps unexpectedly at checkout. To avoid this, show your nightly rate early — before guests click into the booking flow. If there's a cleaning fee, reservation fee, or tax, mention the approximate total somewhere visible so the final number isn't a surprise. Even a line like \"Sites from $45/night, fees apply\" builds more trust than showing a price for the first time at payment.",
  "contact-friction":
    "If the only way to contact you is a long form with 8 fields, many guests won't bother. Simplify your contact page to just the basics — name, email, and message. Better yet, also show a phone number, your typical response time, and a link to your booking page for guests who just want to reserve. The easier you make it to reach you, the more inquiries you'll get.",
  "trust-stack-completeness":
    "Show your key trust signals in obvious places: secure site (https), clear cancellation policy, and real guest reviews. Guests should not need to dig for these basics before paying. A few trust signals in the booking path can make the difference between hesitation and reservation.",
  "local-search-intent-coverage":
    "Make sure your homepage and Google listing clearly say what you are and where you are. Include your property type and location in your page title and main intro text, and keep your map listing active with fresh photos and reviews. This helps nearby searchers find you faster.",
  "seasonal-visibility":
    "If you're running a summer special or a fall deal, make sure guests can actually see it. Put your current promotion near the top of your homepage where it's impossible to miss — not buried in a blog post or a footer banner. Something as simple as a bold headline that says \"Book by July 4th and save 15%\" with a direct link to availability is enough to move reservations. If you need help writing the offer, use AI to generate the promo text and paste it onto your homepage.",
  "visual-storytelling":
    "Guests book the experience, not just the site. Beyond showing photos of your RV hookups, show what it feels like to stay there: a campfire at dusk, kids at the playground, people relaxing by the pool, the view from your best site. A short video walk-through or a photo series that follows the journey from arrival to evening can do more for bookings than a dozen spec photos.",
  "visual-proof-relevance":
    "Make sure your photos prove the essentials guests care about: where they will stay, bathroom quality, amenities, and what arrival looks like. If one of those is missing, add 2-3 clear real photos for that section. Real proof photos reduce doubt and help people book with confidence.",
  "visual-trust":
    "Replace generic or stock-looking images with real, recent photos of your actual sites, bathhouse, amenities, and entrance. Real visuals build trust much faster than polished but generic imagery.",
  "payment-flexibility":
    "If your booking system only accepts one or two payment types, some guests will abandon checkout when their preferred method isn't available. Check your booking settings and enable credit card, debit card, and if possible PayPal or Apple Pay. If you accept checks or cash for walk-ins, mention that on your site too. The more options you offer, the fewer guests you lose at the final step.",
  "booking-click-depth":
    "Count how many clicks it takes from your homepage to actually completing a reservation — if it's more than 3 or 4, you're losing guests along the way. Simplify by putting a \"Check Availability\" button on your homepage that links directly into your booking calendar. Remove any unnecessary intermediate pages or steps that add friction before a guest can select their dates.",
  "availability-visibility":
    "Guests who can't quickly see whether you have open dates for their trip will move on to the next park. Put a date picker or an availability calendar near the top of your homepage so guests can check right away without hunting for it. Even a simple \"Check Availability\" button that links to your booking calendar is better than burying it under multiple menu levels.",
  "fee-transparency":
    "Guests don't mind paying fees — they mind being surprised by them. Show your cleaning fee, reservation fee, or any other mandatory charges on your rates page or booking page before the final payment screen. A simple line like \"A $15 reservation fee applies\" is all it takes. When guests feel informed, they're more likely to complete the booking instead of abandoning it.",
  "onsite-guest-proof":
    "Real guest reviews build trust faster than anything you can write yourself. The easiest fix is to copy a handful of your best Google or TripAdvisor reviews and display them on your homepage with the guest's first name and star rating. You can also embed a Google Reviews widget directly into your site. Guests who see recent positive reviews from real people are far more likely to book.",
  "authentic-photography":
    "Stock-looking photos — perfect sunsets, models by a fire — make guests wonder if your park actually looks that way. Replace them with real photos of your actual property: your specific sites, your real bathhouse, your actual view. Even a well-lit smartphone photo of the real thing is more convincing than a polished stock image. Guests book based on what they expect to find when they arrive.",
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
  "ssl-valid": "Site security",
  "https-redirect": "Secure website routing",
  "response-time": "Fast loading",
  "broken-links": "Working website links",
  "pagespeed-mobile": "Phone loading speed",
  "canonical-redirect-hygiene": "Website URL consistency",
  "booking-platform": "Online booking system",
  "booking-engine-health": "Booking page health",
  "booking-cta": "Book now visibility",
  "date-picker-discoverability": "Date picker visibility",
  "tracking-pixels": "Guest follow-up tracking",
  "abandonment-recovery-readiness": "Booking recovery tracking",
  "newsletter-capture": "Guest email signup",
  "pet-policy": "Pet policy visibility",
  "rv-hookup-specs": "RV hookup details",
  "big-rig-readiness": "Big-rig readiness",
  "wifi-quality-claims": "Wi-Fi quality clarity",
  "arrival-directions-clarity": "Arrival directions clarity",
  "ev-extra-vehicle-policy": "EV and extra-vehicle policy",
  "amenities-page": "Amenities visibility",
  "rate-page": "Pricing visibility",
  "cancellation-policy": "Cancellation policy visibility",
  "photo-gallery-quality": "Photo quality",
  "accessibility-statement": "Accessibility information",
  "meta-title": "Search engine signage",
  "meta-description": "Search result description",
  "gbp-sync": "Google listing strength",
  "local-review-competitiveness": "Local review competitiveness",
  "social-presence": "Social media presence",
  "listing-signals": "Directory listing signals",
  "facebook-link": "Facebook link health",
  "mobile-viewport": "Smartphone readiness",
  "header-phone": "Tap-to-call phone number",
  "mobile-tap-targets": "Phone tap button size",
  "phone-conversion-readiness": "Phone booking readiness",
  "image-count": "Homepage photos",
  "listing-completeness": "Listing coverage",
  "rate-transparency": "Price clarity",
  "contact-friction": "Contact convenience",
  "trust-stack-completeness": "Booking trust signals",
  "local-search-intent-coverage": "Local search basics",
  "visual-proof-relevance": "Proof photo coverage",
  "visual-trust": "Visual trust",
  "seasonal-visibility": "Seasonal offer visibility",
  "visual-storytelling": "Visual sales strength",
  "payment-flexibility": "Payment flexibility",
  "booking-click-depth": "Booking click count",
  "availability-visibility": "Availability visible early",
  "fee-transparency": "Fee transparency",
  "onsite-guest-proof": "On-site guest proof",
  "authentic-photography": "Authentic photography",
  "structured-data": "Structured data for search",
  "accessibility-score": "Accessibility score",
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
    case "canonical-redirect-hygiene":
      return p ? "Website URL setup is clean" : f ? "Website URL setup needs cleanup" : "Website URL setup needs review";
    case "response-time":
      return p ? "Website responds quickly" : f ? "Website is slow to respond" : "Website response is borderline";
    case "booking-engine-health":
      return p ? "Booking page is up and running" : f ? "Booking page may be down" : "Booking page health needs review";
    case "date-picker-discoverability":
      return p ? "Guests can start date search quickly" : f ? "Date search is hard to find" : "Date search visibility needs review";
    case "big-rig-readiness":
      return p ? "Big-rig details are clearly posted" : f ? "Big-rig details are missing" : "Big-rig details are partially visible";
    case "wifi-quality-claims":
      return p ? "Wi-Fi quality is clearly explained" : f ? "Wi-Fi quality is unclear" : "Wi-Fi is mentioned but not qualified";
    case "arrival-directions-clarity":
      return p ? "Arrival directions are clear" : f ? "Arrival directions are hard to find" : "Arrival instructions need more detail";
    case "ev-extra-vehicle-policy":
      return p ? "Vehicle policies are clearly posted" : f ? "Vehicle policies are missing" : "Vehicle policies are only partially posted";
    case "abandonment-recovery-readiness":
      return p ? "Can recover unfinished bookings" : f ? "Can't recover unfinished bookings" : "Booking recovery events are unverified";
    case "booking-cta":
      return p ? "Book now button is easy to find" : f ? "Book now button is hard to find" : "Book now button could be clearer";
    case "booking-click-depth":
      return p ? "Guests can book in just a few clicks" : f ? "Too many clicks required to book" : "Booking takes a few too many clicks";
    case "booking-platform":
      return p ? "Guests can book online" : f ? "No online booking found" : "Online booking needs review";
    case "local-review-competitiveness":
      return p ? "Review strength looks competitive" : f ? "Review strength trails local competition" : "Review competitiveness is borderline";
    case "availability-visibility":
      return p ? "Guests can see open dates easily" : f ? "Open dates are hard to find" : "Availability could be more visible";
    case "fee-transparency":
      return p ? "All fees are shown up front" : f ? "Guests see surprise fees" : "Fee timing could be clearer";
    case "onsite-guest-proof":
      return p ? "Guest reviews are showing" : f ? "No guest reviews found on the site" : "Guest reviews could be more visible";
    case "visual-trust":
      return p ? "Photos build strong trust" : f ? "Photos may be hurting trust" : "Photos are decent but not fully convincing";
    case "authentic-photography":
      return p ? "Photos look real and personal" : f ? "Photos look too stock or generic" : "Photos could feel more personal";
    case "rate-page":
    case "rate-transparency":
      return p ? "Nightly rates are easy to find" : f ? "Nightly rates are hard to find" : "Pricing could be easier to find";
    case "cancellation-policy":
      return p ? "Cancellation policy is easy to find" : f ? "No cancellation policy found" : "Cancellation policy is hard to find";
    case "ssl-valid":
      return p ? "Site has a valid security certificate" : f ? "Site is missing a security certificate" : "Security certificate needs attention";
    case "https-redirect":
      return p ? "Site loads securely by default" : f ? "Site doesn't always load securely" : "Secure site routing needs attention";
    case "broken-links":
      return p ? "No broken links found" : f ? "Some links on the site are broken" : "One or more links may be broken";
    case "tracking-pixels":
      return p ? "Ad retargeting is active" : f ? "Ad retargeting isn't set up" : "Ad retargeting needs attention";
    case "newsletter-capture":
      return p ? "Email signup form is present" : f ? "No email signup form found" : "Email signup could be more visible";
    case "pet-policy":
      return p ? "Pet policy is clearly posted" : f ? "Pet policy is missing or unclear" : "Pet policy could be clearer";
    case "rv-hookup-specs":
      return p ? "RV hookup details are listed" : f ? "RV hookup details are missing" : "RV hookup info could be clearer";
    case "amenities-page":
      return p ? "Amenities are clearly listed" : f ? "Amenities aren't listed anywhere" : "Amenities page could be improved";
    case "photo-gallery-quality":
      return p ? "Photo gallery looks inviting" : f ? "Photo gallery needs better photos" : "Photo gallery could be stronger";
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
    case "listing-signals":
      return p ? "Directory signals found on site" : f ? "No directory signals found on site" : "Directory signals need attention";
    case "facebook-link":
      return p ? "Facebook page link is working" : f ? "Facebook page link is broken" : "Facebook link needs attention";
    case "mobile-viewport":
      return p ? "Site looks good on phones" : f ? "Site doesn't display well on phones" : "Phone display needs attention";
    case "header-phone":
      return p ? "Phone number is easy to tap" : f ? "Phone number is hard to tap on mobile" : "Clickable phone number needs attention";
    case "mobile-tap-targets":
      return p ? "Phone buttons are easy to tap" : f ? "Phone buttons are hard to tap" : "Phone button tap size needs work";
    case "phone-conversion-readiness":
      return p ? "Phone call path is conversion-ready" : f ? "Phone call path is weak" : "Phone call path needs tuning";
    case "image-count":
      return p ? "Homepage has plenty of photos" : f ? "Homepage doesn't have enough photos" : "More homepage photos would help";
    case "listing-completeness":
      return p ? "Online listings look complete" : f ? "Online listings are incomplete" : "Online listings need more detail";
    case "contact-friction":
      return p ? "Easy to get in touch" : f ? "Hard to get in touch" : "Contact info could be easier to find";
    case "trust-stack-completeness":
      return p ? "Trust signals are strong" : f ? "Trust signals are too weak" : "Trust signals are incomplete";
    case "local-search-intent-coverage":
      return p ? "Local search basics are covered" : f ? "Local search basics are missing" : "Local search basics need review";
    case "visual-proof-relevance":
      return p ? "Photos cover what guests care about" : f ? "Important proof photos are missing" : "Proof photo coverage is partial";
    case "seasonal-visibility":
      return p ? "Seasonal deals are easy to spot" : f ? "No seasonal deals visible to guests" : "Seasonal offers could be more visible";
    case "visual-storytelling":
      return p ? "Photos and visuals sell the experience" : f ? "Photos and visuals don't sell the experience" : "Visuals could do more to attract guests";
    case "payment-flexibility":
      return p ? "Multiple payment options available" : f ? "Very few payment options available" : "Payment options could be expanded";
    case "structured-data":
      return p ? "Rich search data is in place" : f ? "No structured data found for search engines" : "Structured data is partially set up";
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
  const [isLandingFaqOpen, setIsLandingFaqOpen] = useState(false);
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
  const [hasShownEngagementPrompt, setHasShownEngagementPrompt] = useState(false);
  const [hasClosedSecondIssue, setHasClosedSecondIssue] = useState(false);
  const [secondIssueCloseScrollY, setSecondIssueCloseScrollY] = useState<number | null>(null);
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
      "Prioritize this issue in your next sprint, implement the smallest high-impact change first, then re-run the audit."
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
                  className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 sm:left-10 sm:top-8 sm:translate-x-0"
                />
                <div className="print-hidden absolute right-6 top-6 z-20 hidden items-center gap-3 sm:right-10 sm:top-8 sm:flex">
                  <button
                    type="button"
                    aria-label="Language selector"
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-[#AEBCCA] bg-white/75 px-5 text-base font-normal text-[#0A1628] backdrop-blur-sm transition-colors hover:border-[#2DA4A9]"
                  >
                    <GlobeAltIcon className="h-5 w-5" aria-hidden="true" />
                    <span>English</span>
                    <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLandingFaqOpen(true)}
                    className="inline-flex h-12 items-center justify-center rounded-full border border-[#AEBCCA] bg-white/75 px-7 text-base font-normal text-[#0A1628] backdrop-blur-sm transition-colors hover:border-[#2DA4A9]"
                  >
                    FAQ
                  </button>
                </div>
              </>
            ) : null}
            {isLandingFaqOpen ? (
              <motion.div
                className="print-hidden fixed inset-0 z-50 flex items-center justify-center bg-[#0A1628]/55 px-4 py-6 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsLandingFaqOpen(false)}
              >
                <motion.div
                  className="relative w-full max-w-[680px] overflow-hidden border border-[#DDE7F0] bg-[#F8FAFC] shadow-[0_24px_80px_rgba(10,22,40,0.24)]"
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 18, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setIsLandingFaqOpen(false)}
                    className="absolute right-3 top-3 inline-flex h-12 w-12 items-center justify-center text-3xl leading-none text-[#9AA9B5] transition-colors hover:text-[#0A1628]"
                    aria-label="Close FAQ"
                  >
                    <XMarkIcon className="h-7 w-7" aria-hidden="true" />
                  </button>
                  <div className="border-b border-[#E6EBF0] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9fc_100%)] px-6 py-6 sm:px-8">
                    <p className="text-lg font-normal text-[#0A1628]">Frequently Asked Questions</p>
                    <p className="mt-2 text-base text-[#435468]">Quick answers about how ParkGrader works.</p>
                  </div>
                  <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-7">
                    <div>
                      <p className="text-base font-medium text-[#0A1628]">How long does the audit take?</p>
                      <p className="mt-2 text-base leading-7 text-[#435468]">Most audits are ready in about 10-20 seconds.</p>
                    </div>
                    <div>
                      <p className="text-base font-medium text-[#0A1628]">Is this really free?</p>
                      <p className="mt-2 text-base leading-7 text-[#435468]">Yes. There is no credit card required to run an audit.</p>
                    </div>
                    <div>
                      <p className="text-base font-medium text-[#0A1628]">What does ParkGrader check?</p>
                      <p className="mt-2 text-base leading-7 text-[#435468]">We analyze booking flow, mobile experience, trust signals, and online visibility.</p>
                    </div>
                    <div>
                      <p className="text-base font-medium text-[#0A1628]">Will this change my website?</p>
                      <p className="mt-2 text-base leading-7 text-[#435468]">No. ParkGrader is read-only and does not modify your site.</p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
            <motion.div
              className="relative z-10 mx-auto w-full max-w-3xl"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              <div className="mx-auto max-w-[42rem] border border-[#DCE5ED] bg-[#F8FAFC] px-6 py-8 shadow-[0_10px_30px_rgba(10,22,40,0.05)] sm:px-10 sm:py-10">
                <div className="flex flex-col items-center text-center">
                  <h1 className="mt-10 text-2xl leading-[0.98] text-[#0A1628] sm:text-[2.75rem]">
                    Audit your park
                  </h1>
                  <p className="mt-6 max-w-[34ch] text-base leading-7 text-[#5B6776] sm:text-xl sm:leading-8">
                    Get a clear report on booking flow, mobile experience, trust signals, and online visibility.
                  </p>
                </div>
                <div className="mx-auto mt-12 w-full max-w-[34ch]">
                  <div className="text-left">
                    <motion.div
                      animate={urlInputShakeCount > 0 ? { x: [0, -10, 10, -7, 7, -3, 3, 0] } : { x: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      {isTradeshowMode ? (
                        <div className="relative">
                          <input
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
                            className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-base font-medium text-[#0A1628] text-center outline-none transition-colors placeholder:text-[#8C97A8] ${
                              scanError ? "border-[#DC2626]" : "border-[#C4D3E2] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
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
                          className={`h-12 w-full border-0 border-b-2 bg-transparent px-0 pb-2 text-base font-medium text-[#0A1628] text-center outline-none transition-colors placeholder:text-[#8C97A8] ${
                            scanError ? "border-[#DC2626]" : "border-[#C4D3E2] hover:border-[#2DA4A9] focus:border-[#2DA4A9]"
                          }`}
                        />
                      )}
                    </motion.div>
                    {scanError ? <p className="mt-2 text-base text-[#B42318]">{scanError}</p> : null}
                  </div>
                  <p className="mt-4 text-center text-base text-[#5B6776]">100% free. No credit card required.</p>
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={beginAssessment}
                    className="mx-auto mt-10 block min-h-12 w-full max-w-[260px] rounded-2xl bg-[#2DA4A9] px-6 py-3 text-base font-medium text-white transition-colors hover:bg-[#24858A]"
                  >
                    Get free audit
                  </motion.button>
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
