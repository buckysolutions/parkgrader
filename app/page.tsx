"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  ChatBubbleLeftEllipsisIcon,
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
};

type ScanResponse = {
  url: string;
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

const PARTIAL_LOADING_MESSAGES = [
  "Fetching your homepage...",
  "Checking SSL certificate and redirect chain...",
  "Scanning internal links for broken pages...",
  "Running Google PageSpeed Lighthouse audit...",
  "Analyzing booking flow and trust signals...",
  "Checking maps, social, and Facebook links...",
  "Finalizing your ParkGrader score...",
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
  "ssl-valid": ShieldCheckIcon,
  "https-redirect": ShieldCheckIcon,
  "response-time": BoltIcon,
  "broken-links": LinkIcon,
  "pagespeed-mobile": DevicePhoneMobileIcon,
  "booking-platform": CalendarDaysIcon,
  "booking-cta": ArrowRightIcon,
  "tracking-pixels": ChartBarSquareIcon,
  "newsletter-capture": EnvelopeIcon,
  "pet-policy": QueueListIcon,
  "rv-hookup-specs": TruckIcon,
  "amenities-page": HomeModernIcon,
  "rate-page": ReceiptPercentIcon,
  "cancellation-policy": DocumentTextIcon,
  "photo-gallery-quality": PhotoIcon,
  "accessibility-statement": UserCircleIcon,
  "meta-title": TagIcon,
  "meta-description": NewspaperIcon,
  "gbp-sync": MapPinIcon,
  "social-presence": UsersIcon,
  "listing-signals": ClipboardDocumentListIcon,
  "facebook-link": LinkIcon,
  "mobile-viewport": DevicePhoneMobileIcon,
  "header-phone": PhoneIcon,
  "image-count": PhotoIcon,
  "listing-completeness": ClipboardDocumentListIcon,
  "rate-transparency": ReceiptPercentIcon,
  "contact-friction": PhoneIcon,
  "communication-warmth": ChatBubbleLeftEllipsisIcon,
  "seasonal-visibility": SunIcon,
  "visual-storytelling": PhotoIcon,
  "payment-flexibility": CreditCardIcon,
};

const normalizeUrl = (raw: string): string => {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `https://${value}`;
};

const formatDisplayUrl = (raw: string): string => {
  const normalized = normalizeUrl(raw);
  if (!normalized) {
    return "";
  }

  try {
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return raw.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  }
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
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
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
          Terms
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
  href: "https://www.buckysolutions.com/contact?service=website-conversion",
};

const SERVICE_CTA_BY_KEY: Record<string, ServiceCta> = {
  ssl: {
    badge: "Security Fix",
    title: "Trust and security cleanup",
    description: "Patch SSL and redirect issues so guests stop seeing trust-breaking warnings before they book.",
    buttonLabel: "Fix trust issues",
    href: "https://www.buckysolutions.com/contact?service=security",
  },
  pagespeed: {
    badge: "Speed Sprint",
    title: "Mobile speed improvement sprint",
    description: "Reduce slow load times, heavy assets, and performance bottlenecks that are costing direct bookings.",
    buttonLabel: "Improve speed",
    href: "https://www.buckysolutions.com/contact?service=pagespeed",
  },
  booking_cta: {
    badge: "Booking Conversion",
    title: "Booking path optimization",
    description: "Make booking buttons, pricing, and conversion paths obvious so high-intent visitors stop dropping out.",
    buttonLabel: "Improve booking flow",
    href: "https://www.buckysolutions.com/contact?service=booking-conversion",
  },
  booking_platform: {
    badge: "Booking System",
    title: "Direct booking setup",
    description: "Add or improve the reservation stack so guests can check availability and book without friction.",
    buttonLabel: "Set up bookings",
    href: "https://www.buckysolutions.com/contact?service=booking-platform",
  },
  tracking_pixels: {
    badge: "Tracking Setup",
    title: "Analytics and retargeting setup",
    description: "Install GA4, tag management, and retargeting pixels so traffic and campaign ROI become measurable.",
    buttonLabel: "Set up tracking",
    href: "https://www.buckysolutions.com/contact?service=tracking",
  },
  photos: {
    badge: "Visual Refresh",
    title: "Photo and visual conversion refresh",
    description: "Upgrade imagery and page presentation so guests can picture the stay and trust the experience faster.",
    buttonLabel: "Upgrade visuals",
    href: "https://www.buckysolutions.com/contact?service=visual-refresh",
  },
  google_business: {
    badge: "Visibility Boost",
    title: "Local visibility improvement",
    description: "Strengthen your Google Business Profile and discovery signals so more nearby guests actually find you.",
    buttonLabel: "Improve visibility",
    href: "https://www.buckysolutions.com/contact?service=local-visibility",
  },
  listing_signals: {
    badge: "Listing Boost",
    title: "Marketplace listing cleanup",
    description: "Tighten listing coverage and consistency across discovery channels where guests already shop.",
    buttonLabel: "Strengthen listings",
    href: "https://www.buckysolutions.com/contact?service=listings",
  },
  social: {
    badge: "Social Presence",
    title: "Social profile cleanup",
    description: "Repair or strengthen your connected social presence so trust signals support booking decisions.",
    buttonLabel: "Fix social signals",
    href: "https://www.buckysolutions.com/contact?service=social",
  },
  meta_tags: {
    badge: "Search Visibility",
    title: "Search snippet optimization",
    description: "Rewrite titles and descriptions so your search presence earns more clicks from the right guests.",
    buttonLabel: "Improve search snippets",
    href: "https://www.buckysolutions.com/contact?service=seo-foundation",
  },
  mobile: {
    badge: "Mobile UX",
    title: "Mobile usability fixes",
    description: "Fix viewport, tap targets, and mobile interaction issues that push guests away on phones.",
    buttonLabel: "Fix mobile UX",
    href: "https://www.buckysolutions.com/contact?service=mobile-ux",
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
    href: "https://www.buckysolutions.com/contact?service=security&module=ssl-valid",
  },
  "https-redirect": {
    buttonLabel: "Fix secure redirects",
    href: "https://www.buckysolutions.com/contact?service=security&module=https-redirect",
  },
  "response-time": {
    buttonLabel: "Speed up load time",
    href: "https://www.buckysolutions.com/contact?service=pagespeed&module=response-time",
  },
  "broken-links": {
    buttonLabel: "Repair broken links",
    href: "https://www.buckysolutions.com/contact?service=website-conversion&module=broken-links",
  },
  "pagespeed-mobile": {
    buttonLabel: "Improve mobile score",
    href: "https://www.buckysolutions.com/contact?service=pagespeed&module=pagespeed-mobile",
  },
  "booking-platform": {
    buttonLabel: "Upgrade booking stack",
    href: "https://www.buckysolutions.com/contact?service=booking-platform&module=booking-platform",
  },
  "booking-cta": {
    buttonLabel: "Strengthen booking CTA",
    href: "https://www.buckysolutions.com/contact?service=booking-conversion&module=booking-cta",
  },
  "tracking-pixels": {
    buttonLabel: "Set up tracking",
    href: "https://www.buckysolutions.com/contact?service=tracking&module=tracking-pixels",
  },
  "newsletter-capture": {
    buttonLabel: "Add email capture",
    href: "https://www.buckysolutions.com/contact?service=tracking&module=newsletter-capture",
  },
  "pet-policy": {
    buttonLabel: "Add policy content",
    href: "https://www.buckysolutions.com/contact?service=website-conversion&module=pet-policy",
  },
  "rv-hookup-specs": {
    buttonLabel: "Publish hookup specs",
    href: "https://www.buckysolutions.com/contact?service=website-conversion&module=rv-hookup-specs",
  },
  "amenities-page": {
    buttonLabel: "Build amenities page",
    href: "https://www.buckysolutions.com/contact?service=visual-refresh&module=amenities-page",
  },
  "rate-page": {
    buttonLabel: "Improve pricing visibility",
    href: "https://www.buckysolutions.com/contact?service=booking-conversion&module=rate-page",
  },
  "cancellation-policy": {
    buttonLabel: "Add clear policy",
    href: "https://www.buckysolutions.com/contact?service=website-conversion&module=cancellation-policy",
  },
  "photo-gallery-quality": {
    buttonLabel: "Upgrade photos",
    href: "https://www.buckysolutions.com/contact?service=visual-refresh&module=photo-gallery-quality",
  },
  "accessibility-statement": {
    buttonLabel: "Improve accessibility",
    href: "https://www.buckysolutions.com/contact?service=mobile-ux&module=accessibility-statement",
  },
  "meta-title": {
    buttonLabel: "Improve page titles",
    href: "https://www.buckysolutions.com/contact?service=seo-foundation&module=meta-title",
  },
  "meta-description": {
    buttonLabel: "Improve meta descriptions",
    href: "https://www.buckysolutions.com/contact?service=seo-foundation&module=meta-description",
  },
  "gbp-sync": {
    buttonLabel: "Improve GBP visibility",
    href: "https://www.buckysolutions.com/contact?service=local-visibility&module=gbp-sync",
  },
  "social-presence": {
    buttonLabel: "Improve social presence",
    href: "https://www.buckysolutions.com/contact?service=social&module=social-presence",
  },
  "listing-signals": {
    buttonLabel: "Strengthen listings",
    href: "https://www.buckysolutions.com/contact?service=listings&module=listing-signals",
  },
  "facebook-link": {
    buttonLabel: "Fix social links",
    href: "https://www.buckysolutions.com/contact?service=social&module=facebook-link",
  },
  "mobile-viewport": {
    buttonLabel: "Improve mobile rendering",
    href: "https://www.buckysolutions.com/contact?service=mobile-ux&module=mobile-viewport",
  },
  "header-phone": {
    buttonLabel: "Improve call conversion",
    href: "https://www.buckysolutions.com/contact?service=mobile-ux&module=header-phone",
  },
  "image-count": {
    buttonLabel: "Improve visual content",
    href: "https://www.buckysolutions.com/contact?service=visual-refresh&module=image-count",
  },
  "listing-completeness": {
    buttonLabel: "Complete listing profile",
    href: "https://www.buckysolutions.com/contact?service=listings&module=listing-completeness",
  },
  "rate-transparency": {
    buttonLabel: "Improve rate transparency",
    href: "https://www.buckysolutions.com/contact?service=booking-conversion&module=rate-transparency",
  },
  "contact-friction": {
    buttonLabel: "Reduce contact friction",
    href: "https://www.buckysolutions.com/contact?service=booking-conversion&module=contact-friction",
  },
  "communication-warmth": {
    buttonLabel: "Improve messaging tone",
    href: "https://www.buckysolutions.com/contact?service=seo-foundation&module=communication-warmth",
  },
  "seasonal-visibility": {
    buttonLabel: "Improve offer visibility",
    href: "https://www.buckysolutions.com/contact?service=booking-conversion&module=seasonal-visibility",
  },
  "visual-storytelling": {
    buttonLabel: "Strengthen storytelling",
    href: "https://www.buckysolutions.com/contact?service=visual-refresh&module=visual-storytelling",
  },
  "payment-flexibility": {
    buttonLabel: "Improve payment options",
    href: "https://www.buckysolutions.com/contact?service=booking-platform&module=payment-flexibility",
  },
};

const PASS_LEARN_CTA_BY_ID: Record<string, string> = {
  "ssl-valid": "Learn about site security",
  "https-redirect": "Learn about secure routing",
  "response-time": "Learn about fast load speed",
  "mobile-viewport": "Learn about mobile readiness",
  "meta-title": "Learn about search signage",
  "meta-description": "Learn about search snippets",
};

const PASS_BENEFIT_BY_ID: Record<string, string> = {
  "ssl-valid": "Security guard active: your site is locked and safe for guest information and card details.",
  "https-redirect": "Your website automatically sends visitors to a secure connection. This protects guest privacy and avoids trust-breaking unsafe warnings.",
  "response-time": "Fast loading: guests can open your site quickly without frustration, so more high-intent visitors stay on the booking path.",
  "mobile-viewport": "Smartphone ready: your website layout stays readable and easy to use when guests look you up from the road.",
  "meta-title": "Search engine signage: your Google listing label is clear, so the right guests can recognize your park faster.",
  "meta-description": "Your search preview explains the value of your park clearly, improving click quality from potential guests.",
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
  "meta-title",
  "meta-description",
  "communication-warmth",
  "newsletter-capture",
  "seasonal-visibility",
]);

const CHECK_DIRECT_FIX_BY_ID: Record<string, string> = {
  "ssl-valid": "Enable SSL in your hosting panel and renew certificates automatically so browsers never show security warnings.",
  "https-redirect": "Force all HTTP traffic to HTTPS at the server level so every visitor lands on the secure version by default.",
  "response-time": "Compress oversized images, defer heavy scripts, and upgrade hosting if TTFB is slow. Aim for sub-1.2s initial response.",
  "broken-links": "Crawl internal links, fix 404s, and replace outdated URLs in nav, footer, and key CTA pages.",
  "pagespeed-mobile": "Prioritize image optimization, script reduction, and caching. Focus first on mobile LCP and CLS issues.",
  "booking-platform": "Use a modern booking engine with clear availability, transparent pricing, and low-friction checkout.",
  "booking-cta": "Place one primary booking CTA above the fold and repeat it in key sections with consistent wording.",
  "tracking-pixels": "Install GA4 and GTM, then verify events for booking clicks, form submits, and key funnel actions.",
  "newsletter-capture": "Add one simple email opt-in with a clear value proposition such as seasonal offers or local trip tips.",
  "pet-policy": "Publish a clear pet policy page with allowed pets, fees, restrictions, and any required vaccination rules.",
  "rv-hookup-specs": "List exact hookup specs per site type (30/50 amp, water, sewer) in an easy-to-scan comparison block.",
  "amenities-page": "Create one amenities page with photos, brief descriptions, and location cues so guests can self-qualify quickly.",
  "rate-page": "Show starting rates and seasonal ranges before checkout to reduce uncertainty and improve conversion quality.",
  "cancellation-policy": "Add a policy section that states deadlines, refund rules, and exceptions in plain language.",
  "photo-gallery-quality": "Replace low-quality images with bright, high-resolution photos of sites, cabins, and core amenities.",
  "accessibility-statement": "Publish accessibility details for paths, facilities, and accommodation options plus a contact path for requests.",
  "meta-title": "Use a location + property type title format and keep it concise so search users immediately understand the offer.",
  "meta-description": "Write benefit-driven descriptions that include key differentiators and a clear booking-oriented action.",
  "gbp-sync": "Complete your Google Business Profile with accurate NAP data, updated photos, categories, and regular posts.",
  "social-presence": "Keep social links active and post recent visual content so guests see current proof of experience quality.",
  "listing-signals": "Standardize listing data across key directories and ensure direct booking links resolve correctly.",
  "facebook-link": "Point social links to your active business pages and remove dead or outdated account references.",
  "mobile-viewport": "Ensure viewport is configured correctly and test on common phone sizes for readable text and tap targets.",
  "header-phone": "Make the phone number tap-to-call and visible in the mobile header for high-intent, urgent bookers.",
  "image-count": "Add more relevant hero and gallery images that match high-intent guest questions before booking.",
  "listing-completeness": "Fill every major listing section (photos, amenities, rules, policies, booking links) to maximize conversion.",
  "rate-transparency": "Expose price anchors early with nightly/weekly context so shoppers can assess fit quickly.",
  "contact-friction": "Reduce form fields, simplify contact options, and make response expectations clear.",
  "communication-warmth": "Use human, specific language and guest-focused outcomes instead of generic marketing phrases.",
  "seasonal-visibility": "Surface seasonal offers in hero and booking pathways so promotions are visible before drop-off points.",
  "visual-storytelling": "Show complete stay narratives: arrival, accommodation, amenities, and local experience cues.",
  "payment-flexibility": "Offer familiar payment options and clearly communicate accepted methods before checkout.",
};

const CHECK_DISPLAY_LABEL_BY_ID: Record<string, string> = {
  "ssl-valid": "Site security",
  "https-redirect": "Secure website routing",
  "response-time": "Fast loading",
  "broken-links": "Working website links",
  "pagespeed-mobile": "Phone loading speed",
  "booking-platform": "Online booking system",
  "booking-cta": "Book now visibility",
  "tracking-pixels": "Guest follow-up tracking",
  "newsletter-capture": "Guest email signup",
  "pet-policy": "Pet policy visibility",
  "rv-hookup-specs": "RV hookup details",
  "amenities-page": "Amenities visibility",
  "rate-page": "Pricing visibility",
  "cancellation-policy": "Cancellation policy visibility",
  "photo-gallery-quality": "Photo quality",
  "accessibility-statement": "Accessibility information",
  "meta-title": "Search engine signage",
  "meta-description": "Search result description",
  "gbp-sync": "Google listing strength",
  "social-presence": "Social media presence",
  "listing-signals": "Directory listing presence",
  "facebook-link": "Facebook link health",
  "mobile-viewport": "Smartphone readiness",
  "header-phone": "Tap-to-call phone number",
  "image-count": "Homepage photos",
  "listing-completeness": "Listing coverage",
  "rate-transparency": "Price clarity",
  "contact-friction": "Contact convenience",
  "communication-warmth": "Welcoming website tone",
  "seasonal-visibility": "Seasonal offer visibility",
  "visual-storytelling": "Visual sales strength",
  "payment-flexibility": "Payment flexibility",
};

const getCheckDisplayLabel = (check?: ScanCheck | null): string => {
  if (!check) {
    return "";
  }

  return CHECK_DISPLAY_LABEL_BY_ID[check.id] ?? check.name;
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
  const [slowScanModalOpen, setSlowScanModalOpen] = useState(false);
  const [slowScanEmailInput, setSlowScanEmailInput] = useState("");
  const [slowScanEmailSubmitted, setSlowScanEmailSubmitted] = useState(false);
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
  const [partialLoadingMessageIndex, setPartialLoadingMessageIndex] = useState(0);
  const [collapsedPainGroups, setCollapsedPainGroups] = useState<Partial<Record<PainLevel, boolean>>>({});
  const [isHydratingSharedReport, setIsHydratingSharedReport] = useState(() => Boolean(getReportIdFromPathname(pathname ?? "")));
  const scanRequestRef = useRef(0);
  const loadingStartRef = useRef<number | null>(null);
  const reportSectionRef = useRef<HTMLElement | null>(null);
  const capturedAuditReportsRef = useRef<Set<string>>(new Set());
  const hydratedFromSavedReportRef = useRef(false);
  const saveAuditSessionRef = useRef<((leadEmail?: string, options?: SaveAuditSessionOptions) => Promise<{ stored: boolean; emailSent: boolean; email: string }>) | null>(null);
  const slowScanCapturedEmailRef = useRef("");

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

  const letterGrade = scoreToLetterGrade(displayScore);
  const displayReportUrl = useMemo(() => formatDisplayUrl(reportUrl), [reportUrl]);
  const emailInputError = !isReportUnlocked ? leadNotice : "";
  const activeCheckCta = useMemo(() => getCheckCtaForStatus(activeCheck), [activeCheck]);
  const activeCheckNeedsAi = useMemo(
    () => Boolean(activeCheck && WRITING_HEAVY_CHECK_IDS.has(activeCheck.id)),
    [activeCheck],
  );
  const activeCheckDirectFix = useMemo(() => {
    if (!activeCheck) {
      return "";
    }
    return (
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

  const showFixContent = isReportUnlocked;

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
      setAiFixDraftByCheckId((prev) => ({ ...prev, [activeCheck.id]: nextDraft }));
      await saveAuditSessionRef.current?.(undefined, { sendEmailCopy: false });
    } catch (error) {
      setAiFixError(error instanceof Error ? error.message : "Unable to generate AI fix right now.");
    } finally {
      setIsGeneratingAiFix(false);
    }
  }, [activeCheck, aiFixDraftByCheckId, isGeneratingAiFix, reportUrl, scanResult]);

  useEffect(() => {
    setAiFixError("");
    setAiFixCopied(false);
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
        aiFixDraftByCheckId,
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

      const response = await fetch("/api/lead", {
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
      name,
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
    setFlippedCardId(null);
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
    setAnswers(snapshot.answers);
    setName(snapshot.name);
    setPropertyName(snapshot.propertyName);
    setEmail(snapshot.email);
    setEmailConfirmation(snapshot.emailConfirmation);
    setDemoMode(snapshot.demoMode);
    setIsReportUnlocked(Boolean(snapshot.email) || Boolean(snapshot.demoMode) || isTradeshowMode);
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

    const interval = window.setInterval(() => {
      setPartialLoadingMessageIndex((value) => (value + 1) % PARTIAL_LOADING_MESSAGES.length);
    }, 3500);

    const slowTimeout = window.setTimeout(() => {
      setSlowScanModalOpen(true);
    }, 35000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(slowTimeout);
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
        const capturedEmail = slowScanCapturedEmailRef.current;
        await saveAuditSession(capturedEmail || undefined, { sendEmailCopy: Boolean(capturedEmail) });
      } catch (error) {
        capturedAuditReportsRef.current.delete(reportId);
        console.error("ParkGrader audit capture failed", error);
      }
    })();
  }, [demoMode, reportId, reportUrl, saveAuditSession, scanResult, step]);

  useEffect(() => {
    if (step !== "partial" && step !== "report") {
      return;
    }
    let frame = 0;
    const totalFrames = 36;
    const interval = window.setInterval(() => {
      frame += 1;
      const nextValue = Math.round(((scanResult?.score ?? 0) * frame) / totalFrames);
      setDisplayScore(nextValue);
      if (frame >= totalFrames) {
        window.clearInterval(interval);
        setDisplayScore(scanResult?.score ?? 0);
      }
    }, 26);
    return () => window.clearInterval(interval);
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

  const visibleChecks = scanResult?.checks ?? [];

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
                  className="pointer-events-none absolute left-6 top-6 z-20 h-8 w-auto sm:left-10 sm:top-8"
                />
                <div className="print-hidden absolute right-6 top-6 z-20 flex items-center gap-3 sm:right-10 sm:top-8">
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
                  <Image src={PARKGRADER_LOGO} alt="ParkGrader" width={181} height={32} className="mx-auto h-8 w-auto" />
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
                  {PARTIAL_LOADING_MESSAGES[partialLoadingMessageIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
            <PolicyFooter fixed />
            <AnimatePresence>
              {slowScanModalOpen && (
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="w-full max-w-sm bg-white px-8 py-7 shadow-xl"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                  >
                    {slowScanEmailSubmitted ? (
                      <>
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E6F7F8]">
                          <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#2DA4A9]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                        </div>
                        <p className="text-center text-base font-medium text-[#0A1628]">Got it! We&apos;ll email your report.</p>
                        <p className="mt-1 text-center text-sm text-[#5B6776]">Sent to <span className="font-medium text-[#0A1628]">{slowScanCapturedEmailRef.current}</span></p>
                        <button type="button" onClick={() => setSlowScanModalOpen(false)} className="mt-5 w-full border border-[#D1DCE8] py-2 text-sm text-[#5B6776] transition-colors hover:border-[#2DA4A9] hover:text-[#2DA4A9]">
                          Keep waiting
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-base font-semibold text-[#0A1628]">Still working on it&hellip;</p>
                        <p className="mt-1 text-sm text-[#5B6776]">Google&apos;s Lighthouse audit can take up to 45 seconds. Enter your email and we&apos;ll send the report the moment it&apos;s ready.</p>
                        <input
                          type="email"
                          value={slowScanEmailInput}
                          onChange={(e) => setSlowScanEmailInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && slowScanEmailInput.trim()) {
                              slowScanCapturedEmailRef.current = slowScanEmailInput.trim().toLowerCase();
                              setSlowScanEmailSubmitted(true);
                            }
                          }}
                          placeholder="your@email.com"
                          className="mt-4 w-full border border-[#D1DCE8] px-4 py-2 text-sm text-[#0A1628] outline-none focus:border-[#2DA4A9]"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={!slowScanEmailInput.trim()}
                          onClick={() => {
                            slowScanCapturedEmailRef.current = slowScanEmailInput.trim().toLowerCase();
                            setSlowScanEmailSubmitted(true);
                          }}
                          className="mt-3 w-full bg-[#0A1628] py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a2d4a] disabled:opacity-40"
                        >
                          Email me the report
                        </button>
                        <button type="button" onClick={() => setSlowScanModalOpen(false)} className="mt-3 w-full text-sm text-[#94A3B8] hover:text-[#5B6776]">
                          No thanks, I&apos;ll keep waiting
                        </button>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        {step === "report" && scanResult && (
          <motion.section ref={reportSectionRef} key="report" className="report-page min-h-screen bg-[#F8FAFC]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="px-6 pb-16 pt-12 sm:px-10">
              <div className="mx-auto max-w-[760px]">
                <div className="flex items-center justify-between gap-4">
                  <button type="button" onClick={resetToLandingPage} className="inline-flex cursor-pointer items-center" aria-label="Back to ParkGrader start page">
                    <Image src={PARKGRADER_LOGO} alt="ParkGrader" width={181} height={32} className="h-8 w-auto" />
                  </button>
                  <div className="print-hidden flex flex-wrap items-center justify-end gap-1 text-right text-[#0A1628]">
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
                        stroke={displayScore >= 75 ? "#16A34A" : displayScore >= 50 ? "#D97706" : "#DC2626"}
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
                        fontSize="60"
                        fontFamily="ParkGraderGoogleSansGrade"
                        fontWeight="700"
                        fill={displayScore >= 75 ? "#16A34A" : displayScore >= 50 ? "#D97706" : "#DC2626"}
                      >{letterGrade}</text>
                    </svg>
                    </div>
                  </div>
                  <p className="mx-auto mt-3 max-w-[220px] break-all text-center text-xs text-[#5B6776]">{displayReportUrl}</p>
                </motion.div>

                {isTradeshowMode ? (
                  <p className="print-hidden mt-6 text-center text-xs uppercase tracking-[0.12em] text-[#5B6776]">Tradeshow mode enabled</p>
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
                            onClick={() => setFlippedCardId(check.id)}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                          >
                            <div className={`flex h-full flex-col border border-[#E6EBF0] bg-[#fafcfd] p-5 md:p-6 ${
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
                              <p className="mt-5 text-lg leading-8 text-[#0A1628]">{check.finding}</p>
                              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                                <div className="flex items-center gap-2 text-[#9AA9B5] transition-colors group-hover:text-[#2DA4A9]">
                                  <ArrowRightIcon className="flip-hint-icon h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  <span className="text-[10px] uppercase tracking-[0.08em]">
                                    {check.status === "fail" ? "Open fix details" : "Open benefit details"}
                                  </span>
                                </div>
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
                            <Image src={PARKGRADER_LOGO} alt="ParkGrader" width={181} height={32} className="mx-auto h-8 w-auto" />
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
                            <Image src={PARKGRADER_LOGO} alt="ParkGrader" width={181} height={32} className="mx-auto h-8 w-auto" />
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
                              <p className="mt-3 text-xl leading-8 text-[#0A1628]">{activeCheck.finding}</p>
                            </>
                          ) : null}
                          {showFixContent ? (
                            <div className="mt-5 border-t border-[#E6EBF0] pt-4">
                              <p className="text-[11px] uppercase tracking-[0.1em] text-[#94A3B8]">
                                {activeCheck.status === "pass" ? "How this helps you" : "How to fix it"}
                              </p>
                              <p className="mt-2 text-base leading-7 text-[#5B6776]">
                                {activeCheck.status === "pass" ? activeCheckBenefit : activeCheckDirectFix}
                              </p>

                              {isReportUnlocked && activeCheckNeedsAi ? (
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
                                          className="ai-generate-button inline-flex items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          <span className="ai-generate-button__label">{isGeneratingAiFix ? "Generating..." : "Generate with AI"}</span>
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </>
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
                          <div className="flex items-center justify-between border-t border-[#E6EBF0] px-6 py-4 sm:px-8">
                            <p className="text-base text-[#5B6776]">
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
                              className="inline-flex items-center justify-center bg-[#2DA4A9] px-4 py-2 text-base text-white transition-opacity hover:opacity-90"
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
