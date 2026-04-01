"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type GuidedQuestion = {
  id: "property_type" | "primary_challenge" | "property_size";
  text: string;
  options: AnswerOption[];
};

type Answers = Partial<Record<GuidedQuestion["id"], AnswerOption>>;

type Benchmark = {
  avg: number;
  top25: number;
  bottom25: number;
};

type ProtectedAction = "share" | "email-share" | "sms-share" | "print" | "pdf" | "qr";

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
  answers: Answers;
  name: string;
  propertyName: string;
  email: string;
  emailConfirmation: string;
  benchmarkPercentile: number;
  savedAt: string;
  demoMode: DemoMode;
};

type DemoMode = null | "needs-work" | "good";

const PARKGRADER_LOGO = "https://assets.buckysolutions.com/bucky_logo_parkgrader.svg";

const AI_DRAFT_CHECK_IDS = new Set([
  "pet-policy",
  "cancellation-policy",
  "accessibility-statement",
  "meta-title",
  "meta-description",
  "communication-warmth",
  "newsletter-capture",
  "rate-transparency",
]);

const REPORTS_KEY = "parkgrader:reports";
const BENCHMARKS: Record<IndustryKey, Benchmark> = {
  campground: { avg: 54, top25: 72, bottom25: 38 },
  marina: { avg: 49, top25: 68, bottom25: 31 },
  glamping: { avg: 61, top25: 79, bottom25: 44 },
  cabins: { avg: 57, top25: 74, bottom25: 40 },
};
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
const CATEGORY_LABELS: Record<CheckCategory, string> = {
  "Technical Performance": "Site Reliability",
  "Booking & Conversion": "Booking Path",
  "Outdoor Hospitality Essentials": "Guest Confidence Essentials",
  "Local & Online Visibility": "First Impressions",
  "Mobile Experience": "Phone Experience",
  "Booking Psychology": "Booking Psychology",
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

const makeReportId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getBenchmarkPercentile = (industry: IndustryKey, score: number): number => {
  const benchmark = BENCHMARKS[industry];
  if (score <= benchmark.bottom25) {
    return Math.max(5, Math.round((score / benchmark.bottom25) * 25));
  }
  if (score <= benchmark.avg) {
    const ratio = (score - benchmark.bottom25) / Math.max(1, benchmark.avg - benchmark.bottom25);
    return Math.round(25 + ratio * 25);
  }
  if (score <= benchmark.top25) {
    const ratio = (score - benchmark.avg) / Math.max(1, benchmark.top25 - benchmark.avg);
    return Math.round(50 + ratio * 25);
  }
  return Math.min(99, Math.round(75 + ((score - benchmark.top25) / Math.max(1, 100 - benchmark.top25)) * 25));
};

const getPropertySizeMidpoint = (value?: string): number => {
  return PROPERTY_SIZE_OPTIONS.find((option) => option.value === value)?.midpoint ?? 50;
};

const scoreToLetterGrade = (score: number): string => {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
};

const loadReports = (): Record<string, ReportSnapshot> => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    return JSON.parse(window.localStorage.getItem(REPORTS_KEY) ?? "{}") as Record<string, ReportSnapshot>;
  } catch {
    return {};
  }
};

const saveReportSnapshot = (snapshot: ReportSnapshot) => {
  if (typeof window === "undefined") {
    return;
  }
  const reports = loadReports();
  reports[snapshot.reportId] = snapshot;
  window.localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
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

function PolicyFooter({ fixed }: { fixed?: boolean }) {
  return (
    <footer
      className={`${fixed ? "fixed" : "relative"} bottom-4 left-1/2 z-20 -translate-x-1/2 text-xs text-[#5B6776] print-hidden`}
    >
      <div className="flex items-center gap-2 whitespace-nowrap px-1 py-1">
        <a className="hover:text-[#0A1628]" href="/privacy-policy">
          Privacy Policy
        </a>
        <span>·</span>
        <a className="hover:text-[#0A1628]" href="/cookie-policy">
          Cookie Policy
        </a>
        <span>·</span>
        <a className="hover:text-[#0A1628]" href="/terms">
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

const FIX_TEXTS: Record<string, string> = {
  "ssl-valid": "Contact your web host and ask them to enable a free SSL certificate — most offer one called 'Let's Encrypt' at no extra cost. The fix usually takes just a few minutes.",
  "https-redirect": "Ask your web host to enable an 'HTTP to HTTPS redirect' — this is usually a one-click setting in your hosting control panel and costs nothing extra.",
  "response-time": "The most common causes are a slow hosting plan or oversized images. Ask your host about upgrading your plan, or ask a developer to compress your site's photos.",
  "broken-links": "Click through your main navigation and key pages and fix or remove any links that lead to error pages. A developer can also run a full site scan in minutes.",
  "pagespeed-mobile": "The most common fixes are compressing large photos and removing slow-loading plugins. A web developer can typically resolve this in a few hours.",
  "booking-platform": "Add a booking system like Campspot, Reserve America, or RoverPass. They handle payments and reservations so guests can book anytime — even at midnight.",
  "booking-cta": "Add a large, clearly visible 'Book Now' or 'Check Availability' button to the top of your homepage. It should be the first action a visitor sees when they land on your site.",
  "tracking-pixels": "Install Google Analytics (it's free) and optionally Facebook Pixel. A web developer can add both to your site in under an hour.",
  "newsletter-capture": "Add an email sign-up form to your homepage. Services like Mailchimp are free to start and let you send seasonal deals and updates to keep guests coming back.",
  "pet-policy": "Add a 'Pet Policy' section to your site showing whether pets are allowed, any fees, size limits, and rules. This small addition often increases bookings from pet-owning guests.",
  "rv-hookup-specs": "Add a page or section clearly listing your hookup types — 30 amp, 50 amp, water, sewer, full hookup. RV travelers read this before anything else when deciding where to book.",
  "amenities-page": "Create a dedicated Amenities page listing everything your park offers — pool, showers, Wi-Fi, laundry, playground. Include a photo of each if you can.",
  "rate-page": "Add a Rates or Pricing page with your nightly, weekly, and seasonal pricing. Even a 'starting from' price builds trust and saves your guests a phone call.",
  "cancellation-policy": "Add a clear Cancellation Policy to your reservations page or FAQ. State your deadline and whether a refund is given. A visible, fair policy reduces hesitation at the booking step.",
  "photo-gallery-quality": "Book a local photographer for a half-day session. Focus on your sites, amenities, and surrounding scenery. Good photos are the single best investment you can make in your online presence.",
  "accessibility-statement": "Add a short section noting your accessibility features — paved paths, accessible restrooms, ADA facilities. Even a brief statement shows guests with mobility needs that you thought about them.",
  "meta-title": "In your website editor, update your homepage title to include your park name and location — for example, 'Bryn Mawr Ocean Resort — St. Augustine, FL.' This is the headline people see in a Google search.",
  "meta-description": "In your website editor, add a 150–160 character description of your property. Write it like a short ad: what makes you unique, where you are, and why someone should visit.",
  "gbp-sync": "Visit business.google.com and claim or create your Google Business Profile — it's completely free. Add photos, your hours, phone number, and website. This is how most local guests find campgrounds today.",
  "social-presence": "Create a free Facebook Business Page for your campground and link it from your website. Post photos and updates regularly — it shows guests you're active and worth visiting.",
  "listing-signals": "Create a free listing on The Dyrt, Hipcamp, or Campendium. Fill out your profile completely with photos and amenity details. These platforms send ready-to-book campers directly to you.",
  "facebook-link": "Check the Facebook link on your website and make sure it points to your current, active page. If your page moved or was renamed, update the link.",
  "mobile-viewport": "Ask your web developer to add one line of code to your site: the viewport meta tag. It tells phones how to display your site correctly and is one of the quickest fixes available.",
  "header-phone": "Ask your web developer to make your header phone number a tap-to-call link. On mobile, this lets guests call you with a single tap instead of having to write the number down.",
  "image-count": "Add more photos to your homepage — aim for at least 5 or 6. Clear photos of your sites, amenities, and surroundings make a real difference in whether people stay or leave.",
};

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

export default function Home() {
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
  const [isReportUnlocked, setIsReportUnlocked] = useState(false);
  const [urlInputShakeCount, setUrlInputShakeCount] = useState(0);
  const [emailInputShakeCount, setEmailInputShakeCount] = useState(0);
  const [pendingProtectedAction, setPendingProtectedAction] = useState<ProtectedAction | null>(null);
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
  const [hidePassingChecks, setHidePassingChecks] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isGeneratingAiPdf, setIsGeneratingAiPdf] = useState(false);
  const scanRequestRef = useRef(0);
  const loadingStartRef = useRef<number | null>(null);
  const reportSectionRef = useRef<HTMLElement | null>(null);

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
  const benchmarkPercentile = useMemo(() => {
    return getBenchmarkPercentile(selectedPropertyType, scanResult?.score ?? 0);
  }, [scanResult?.score, selectedPropertyType]);

  const lostRevenue = useMemo(() => {
    const propertySize = getPropertySizeMidpoint(selectedPropertySize);
    const avgRateByType: Record<IndustryKey, number> = {
      campground: 125,
      marina: 68,
      glamping: 245,
      cabins: 210,
    };
    const occupancyByType: Record<IndustryKey, number> = {
      campground: 0.58,
      marina: 0.62,
      glamping: 0.64,
      cabins: 0.6,
    };
    const annualRevenue = avgRateByType[selectedPropertyType] * propertySize * 365 * occupancyByType[selectedPropertyType];
    return Math.round(annualRevenue * ((scanResult?.lostBookingsEstimate ?? 0) / 100));
  }, [scanResult?.lostBookingsEstimate, selectedPropertySize, selectedPropertyType]);

  const letterGrade = scoreToLetterGrade(displayScore);
  const displayReportUrl = useMemo(() => formatDisplayUrl(reportUrl), [reportUrl]);
  const emailInputError = !isReportUnlocked ? leadNotice : "";
  const activeCheckCta = useMemo(() => getCheckCta(activeCheck), [activeCheck]);

  const downloadPolicyPdf = useCallback(async () => {
    if (!activeCheck || !scanResult || isGeneratingAiPdf) return;
    setIsGeneratingAiPdf(true);
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
        throw new Error(payload.message ?? "Unable to generate draft right now.");
      }
      const content = payload.fix;

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const mX = 22;
      const pageW = 210;
      const pageH = 297;
      const cW = pageW - mX * 2;

      // ── Logo ─────────────────────────────────────────────────────
      let y = 18;
      try {
        const img = document.createElement("img") as HTMLImageElement;
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
          img.src = "/parkgrader-logo.svg";
        });
        const scale = 4;
        const nW = 398; const nH = 58;
        const canvas = document.createElement("canvas");
        canvas.width = nW * scale; canvas.height = nH * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) { ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, nW, nH); }
        const logoH = 8;
        const logoW = logoH * (nW / nH);
        doc.addImage(canvas.toDataURL("image/png"), "PNG", mX, y, logoW, logoH);
        y += logoH + 8;
      } catch {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(10, 22, 40);
        doc.text("ParkGrader", mX, y);
        y += 14;
      }

      // ── Divider ───────────────────────────────────────────────────
      doc.setDrawColor(200, 212, 224);
      doc.setLineWidth(0.4);
      doc.line(mX, y, pageW - mX, y);
      y += 10;

      // ── Title ─────────────────────────────────────────────────────
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(10, 22, 40);
      doc.text(activeCheck.name, mX, y);
      y += 7;

      // URL + date in muted grey
      const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`${reportUrl} · ${today}`, mX, y);
      y += 10;

      // ── Body ──────────────────────────────────────────────────────
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(28, 38, 54);
      const lineH = 10.5 * 0.3528 * 1.7;

      for (const para of content.split(/\n{2,}/).filter(Boolean)) {
        const wrapped = doc.splitTextToSize(para.trim(), cW) as string[];
        const blockH = wrapped.length * lineH;
        if (y + blockH > pageH - 18) { doc.addPage(); y = 18; }
        for (const line of wrapped) { doc.text(line, mX, y); y += lineH; }
        y += 4;
      }

      // ── Footer ────────────────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const total: number = (doc.internal as any).getNumberOfPages() as number;
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setDrawColor(200, 212, 224);
        doc.setLineWidth(0.35);
        doc.line(mX, pageH - 12, pageW - mX, pageH - 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Generated by ParkGrader · parkgrader.com", mX, pageH - 7);
        if (total > 1) doc.text(`${p} / ${total}`, pageW - mX, pageH - 7, { align: "right" });
      }

      doc.save(`${activeCheck.id}-draft.pdf`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not generate PDF. Please try again.");
    } finally {
      setIsGeneratingAiPdf(false);
    }
  }, [activeCheck, isGeneratingAiPdf, reportUrl, scanResult]);

  const shareLink = useMemo(() => {
    if (typeof window === "undefined" || !reportId) {
      return "";
    }
    return `${window.location.origin}${window.location.pathname}?report=${reportId}`;
  }, [reportId]);

  const shareMessage = useMemo(() => {
    const scoreText = scanResult ? `Grade ${letterGrade} (${scanResult.score}/100)` : `Grade ${letterGrade}`;
    const urlText = reportUrl || "your property";
    return `My ParkGrader audit for ${urlText}: ${scoreText}. ${shareLink}`;
  }, [letterGrade, reportUrl, scanResult, shareLink]);

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

  const qrCodeLink = useMemo(() => {
    if (!shareLink) {
      return "";
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(shareLink)}`;
  }, [shareLink]);

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

  const syncReportParam = useCallback((nextReportId: string) => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set("report", nextReportId);
    const query = params.toString();
    window.history.replaceState({}, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }, []);

  const resetToLandingPage = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.history.replaceState({}, "", window.location.pathname);
    window.location.reload();
  }, []);

  const currentReportSnapshot = useMemo<ReportSnapshot | null>(() => {
    if (!scanResult || !reportId) {
      return null;
    }
    return {
      reportId,
      reportUrl,
      scanResult,
      answers,
      name,
      propertyName,
      email,
      emailConfirmation,
      benchmarkPercentile,
      savedAt: new Date().toISOString(),
      demoMode,
    };
  }, [
    answers,
    benchmarkPercentile,
    demoMode,
    email,
    emailConfirmation,
    name,
    propertyName,
    reportId,
    reportUrl,
    scanResult,
  ]);

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

    const validateAssessmentSite = useCallback(async (site: string, industry: IndustryKey): Promise<string | null> => {
      const response = await fetch(
        `/api/scan?url=${encodeURIComponent(site)}&industry=${encodeURIComponent(industry)}&validateOnly=true`,
      );
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        return payload.message ?? "Unable to validate this website.";
      }
      return null;
    }, []);

  const beginAssessment = async () => {
    const normalized = normalizeUrl(urlInput);
    if (!normalized) {
      setScanError("Please enter your URL.");
        setUrlInputShakeCount((value) => value + 1);
      return;
    }

      const validationError = await validateAssessmentSite(normalized, "campground");
      if (validationError) {
        setScanError(validationError);
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
    setFlippedCardId(null);
    setHidePassingChecks(false);
    setIsReportUnlocked(isTradeshowMode);
    loadingStartRef.current = null;
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
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
    setReportId(snapshot.reportId);
    setReportUrl(snapshot.reportUrl);
    setScanResult(snapshot.scanResult);
    setAnswers(snapshot.answers);
    setName(snapshot.name);
    setPropertyName(snapshot.propertyName);
    setEmail(snapshot.email);
    setEmailConfirmation(snapshot.emailConfirmation);
    setDemoMode(snapshot.demoMode);
    setIsReportUnlocked(Boolean(snapshot.email) || Boolean(snapshot.demoMode) || isTradeshowMode);
    syncReportParam(snapshot.reportId);
    setStep("report");
  }, [isTradeshowMode, syncReportParam]);

  useEffect(() => {
    let cancelled = false;

    const validateTradeshowAccess = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tradeshow") !== "true") {
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
    const params = new URLSearchParams(window.location.search);
    const reportParam = params.get("report");
    const demoParam = params.get("demo");

    if (reportParam) {
      const reports = loadReports();
      const snapshot = reports[reportParam];
      if (snapshot) {
        hydrateSnapshot(snapshot);
        return;
      }
    }

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
        benchmarkPercentile: getBenchmarkPercentile("campground", demoScan.score),
        savedAt: new Date().toISOString(),
        demoMode: mode,
      };
      setDemoMode(mode);
      hydrateSnapshot(snapshot);
    }
  }, [hydrateSnapshot]);

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
        syncReportParam(nextReportId);
        setIsReportUnlocked(Boolean(demoMode) || isTradeshowMode);
        setStep("report");
      },
      Math.max(0, minDelay - elapsed),
    );

    return () => window.clearTimeout(timeout);
  }, [demoMode, isScanning, isTradeshowMode, questionsComplete, reportId, scanResult, step, syncReportParam]);

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

  useEffect(() => {
    if (!currentReportSnapshot || step !== "report") {
      return;
    }
    saveReportSnapshot(currentReportSnapshot);
  }, [currentReportSnapshot, step]);

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
    syncReportParam(nextReportId);

    try {
      const payload = {
        email: normalizedEmail,
        name,
        property_name: propertyName,
        url: reportUrl,
        score: scanResult?.score ?? 0,
        property_type: selectedPropertyType,
        primary_challenge: selectedChallenge,
        property_size: selectedPropertySize ?? "25-75",
        top_fails: scanResult?.topFails ?? [],
        estimated_lost_revenue: lostRevenue,
        benchmark_percentile: benchmarkPercentile,
        scan_date: new Date().toISOString(),
        report_id: nextReportId,
      };
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { stored?: boolean; message?: string };
      if (!response.ok) {
        throw new Error(result.message ?? "Unable to save lead.");
      }
      console.log("ParkGrader email confirmation queued for", normalizedEmail, payload);
      setEmailConfirmation(`A copy of this report has been sent to ${normalizedEmail}.`);
      setLeadNotice(
        result.stored
          ? "Your details were saved successfully."
          : "Lead capture is connected, but no Airtable or HubSpot credentials are configured yet.",
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
      setEmailConfirmation(`A copy of this report has been sent to ${normalizedEmail}.`);
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

  const visibleChecks = (scanResult?.checks ?? []).filter((check) => !hidePassingChecks || check.status !== "pass");

  const detailedCategories = CATEGORY_ORDER.map((category) => ({
    category,
    checks: visibleChecks.filter((check) => check.category === category),
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
        {step === "landing" && (
          <motion.section
            key="landing"
            className="relative flex min-h-screen items-center overflow-hidden bg-[#F8FAFC] px-6 pb-24 pt-10 sm:px-10 sm:pt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TopographicPanel />
            <motion.div
              className="relative z-10 mx-auto w-full max-w-3xl"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              <div className="mx-auto max-w-[42rem] border border-[#DCE5ED] bg-[#F8FAFC] px-6 py-8 shadow-[0_10px_30px_rgba(10,22,40,0.05)] sm:px-10 sm:py-10">
                <div className="flex flex-col items-center text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#5B6776]">Website audit for parks</p>
                  <Image src={PARKGRADER_LOGO} alt="ParkGrader" width={181} height={32} className="mt-4 h-8 w-auto" />
                  <h1 className="mt-10 text-2xl leading-[0.98] text-[#0A1628] sm:text-[2.75rem]">
                    Audit your park
                  </h1>
                  <p className="mt-6 max-w-[34ch] text-base leading-7 text-[#5B6776] sm:text-xl sm:leading-8">
                    Get a clear report on booking flow, mobile experience, trust signals, and online visibility.
                  </p>
                </div>
                <div className="mx-auto mt-12 w-full max-w-[34ch]">
                  <div>
                    <motion.div
                      animate={urlInputShakeCount > 0 ? { x: [0, -10, 10, -7, 7, -3, 3, 0] } : { x: 0 }}
                      transition={{ duration: 0.4 }}
                      className={`flex h-12 flex-1 items-center rounded-none bg-white px-4 shadow-[0_2px_8px_rgba(10,22,40,0.08)] ring-1 transition-colors focus-within:ring-2 ${
                        scanError ? "ring-[#DC2626] focus-within:ring-[#DC2626]" : "ring-[#B8C6D6] focus-within:ring-[#0A1628]"
                      }`}
                    >
                      <input
                        value={urlInput}
                        onChange={(event) => {
                          setUrlInput(event.target.value);
                          if (scanError) {
                            setScanError("");
                          }
                        }}
                        placeholder="yourproperty.com"
                        className="h-full w-full bg-transparent text-base text-[#0A1628] outline-none placeholder:text-[#748295]"
                      />
                    </motion.div>
                    {scanError ? <p className="mt-2 text-sm text-[#B42318]">{scanError}</p> : null}
                  </div>
                  <p className="mt-4 text-center text-sm text-[#5B6776]">100% free. No credit card required.</p>
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
              <div className="print-hidden mx-auto mt-8 w-full max-w-[680px] text-center text-sm text-[#5B6776]">
                Question {Math.min(GUIDED_QUESTIONS.length, questionIndex + 1)} of {GUIDED_QUESTIONS.length}
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
              <p className="mt-6 text-sm text-[#5B6776] sm:text-base">Building your ParkGrader report...</p>
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
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="6.75" cy="9" r="2.25" />
                        <circle cx="17.25" cy="6.75" r="2.25" />
                        <circle cx="17.25" cy="17.25" r="2.25" />
                        <path d="M8.913 8.757l6.174-1.764" />
                        <path d="M8.913 10.743l6.174 5.514" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestProtectedAction("email-share")}
                      aria-label="Email"
                      title="Email"
                      className="inline-flex h-10 w-10 items-center justify-center transition-colors hover:text-[#2DA4A9]"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M3 7l9 6 9-6" />
                      </svg>
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
                    <button
                      type="button"
                      onClick={() => setHidePassingChecks((value) => !value)}
                      aria-label={hidePassingChecks ? "Showing issues only" : "Show issues only"}
                      title={hidePassingChecks ? "Showing issues only" : "Show issues only"}
                      className={`inline-flex h-10 w-10 items-center justify-center transition-colors ${hidePassingChecks ? "text-[#2DA4A9]" : "hover:text-[#2DA4A9]"}`}
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18" />
                        <path d="M7 12h10" />
                        <path d="M10 18h4" />
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
                        fontSize="52"
                        fontFamily="var(--font-dm-sans), sans-serif"
                        fontWeight="bold"
                        fill={displayScore >= 75 ? "#16A34A" : displayScore >= 50 ? "#D97706" : "#DC2626"}
                      >{displayScore}</text>
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
                  {detailedCategories.map(({ category, checks }, categoryIndex) => (
                    <motion.section key={category} className="pb-8 pt-6 md:pb-10 md:pt-7" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ delay: categoryIndex * 0.04 }}>
                      <div className="mb-6 flex items-center gap-4">
                        <h3 className="text-base uppercase tracking-[0.08em] text-[#0A1628] md:text-lg">{CATEGORY_LABELS[category]}</h3>
                        <div className="h-px flex-1 bg-[#E6EBF0]" />
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                        {checks.map((check, index) => (
                          <motion.article
                            key={check.id}
                            className="flip-card group relative flex min-h-[220px] flex-col cursor-pointer transition-shadow md:aspect-square md:min-h-0"
                            onClick={() => setFlippedCardId(check.id)}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.2 }}
                            transition={{ delay: index * 0.04 }}
                          >
                            <div className={`flex h-full flex-col border border-[#E6EBF0] bg-[#fafcfd] p-5 md:p-6 ${
                              check.status === "pass"
                                ? "border-t-2 border-t-[#2DA4A9]"
                                : check.status === "fail"
                                  ? "border-t-2 border-t-[#DC2626]"
                                  : "border-t-2 border-t-[#94A3B8]"
                            }`}>
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">{check.name}</p>
                              </div>
                              <p className="mt-3 text-lg leading-8 text-[#0A1628]">{check.finding}</p>
                              <p className="mt-4 text-[11px] uppercase tracking-[0.1em] text-[#94A3B8]">Why This Matters</p>
                              <p className="mt-1 text-sm leading-6 text-[#5B6776]">{check.details}</p>
                              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                                <div className="flex items-center gap-2 text-[#9AA9B5] transition-colors group-hover:text-[#2DA4A9]">
                                  <svg viewBox="0 0 16 16" className="flip-hint-icon h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10M9 4l4 4-4 4" />
                                  </svg>
                                  <span className="text-[10px] uppercase tracking-[0.08em]">
                                    {check.status === "fail" ? "Open fix details" : "Open details"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.article>
                        ))}
                      </div>
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
                          ×
                        </button>

                        <div className="p-6 sm:p-8">
                          <div className="pr-10">
                            <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">Unlock this feature</p>
                            <p className="mt-3 text-2xl leading-9 text-[#0A1628]">Enter your email to continue</p>
                            <p className="mt-3 text-sm leading-7 text-[#5B6776]">
                              Enter your email to unlock share links, QR code, print, and PDF options and receive a copy of your audit.
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
                                  className={`h-12 w-full border bg-white px-4 text-sm text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] ${
                                    emailInputError ? "border-[#DC2626] focus:border-[#DC2626]" : "border-[#C4D3E2] focus:border-[#0A1628]"
                                  }`}
                                />
                              </motion.div>
                              {emailInputError ? <p className="-mt-1 text-left text-sm text-[#B42318]">{emailInputError}</p> : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => void submitLead()}
                              className="mt-6 inline-flex min-h-12 w-full items-center justify-center bg-[#2DA4A9] px-5 py-3 text-base text-white transition-colors hover:bg-[#24858A]"
                            >
                              {isSubmittingLead ? "Unlocking..." : "Unlock features"}
                            </button>
                            <p className="mt-3 text-center text-xs leading-relaxed text-[#5B6776]">
                              We&apos;re committed to your privacy. Bucky Solutions uses the information you provide to contact you about relevant content, products, and services. You may unsubscribe from these communications at any time. For more information, see our
                              <a href="https://buckysolutions.com/privacy-policy" target="_blank" rel="noreferrer" className="ml-1 text-[#2DA4A9]">
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
                          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center text-lg text-[#9AA9B5] transition-colors hover:text-[#0A1628]"
                          aria-label="Close QR code"
                        >
                          ×
                        </button>
                        <div className="border-b border-[#E6EBF0] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9fc_100%)] px-6 py-5">
                          <p className="text-xs uppercase tracking-[0.1em] text-[#5B6776]">Share via QR</p>
                          <p className="mt-1 text-sm text-[#0A1628]">Scan to open this report instantly.</p>
                        </div>
                        <div className="flex flex-col items-center px-6 pb-6 pt-5">
                          {qrCodeLink ? (
                            <div className="border border-[#E6EBF0] bg-white p-3 shadow-[0_8px_20px_rgba(10,22,40,0.06)]">
                              <Image src={qrCodeLink} alt="QR code to open this audit report" width={176} height={176} className="h-[176px] w-[176px]" unoptimized />
                            </div>
                          ) : (
                            <p className="text-sm text-[#5B6776]">QR code unavailable right now.</p>
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
                          activeCheck.status === "fail"
                            ? "border-t-2 border-t-[#DC2626]"
                            : activeCheck.status === "pass"
                              ? "border-t-2 border-t-[#2DA4A9]"
                              : "border-t-2 border-t-[#94A3B8]"
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
                          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center text-lg text-[#9AA9B5] transition-colors hover:text-[#0A1628]"
                          aria-label="Close details"
                        >
                          ×
                        </button>

                        {!isReportUnlocked ? (
                          <div className="p-6 sm:p-8">
                            <div className="pr-10">
                              <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">{activeCheck.name}</p>
                              <p className="mt-3 text-2xl leading-9 text-[#0A1628]">Unlock this fix</p>
                              <p className="mt-3 text-sm leading-7 text-[#5B6776]">
                                Enter your email to reveal the recommended fix for this check and receive a copy of your audit.
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
                                    className={`h-12 w-full border bg-white px-4 text-sm text-[#0A1628] outline-none transition-colors placeholder:text-[#8C97A8] ${
                                      emailInputError ? "border-[#DC2626] focus:border-[#DC2626]" : "border-[#C4D3E2] focus:border-[#0A1628]"
                                    }`}
                                  />
                                </motion.div>
                                {emailInputError ? <p className="-mt-1 text-left text-sm text-[#B42318]">{emailInputError}</p> : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => void submitLead()}
                                className="mt-6 inline-flex min-h-12 w-full items-center justify-center bg-[#2DA4A9] px-5 py-3 text-base text-white transition-colors hover:bg-[#24858A]"
                              >
                                {isSubmittingLead ? "Unlocking..." : "Unlock this fix"}
                              </button>
                              <p className="mt-3 text-center text-xs leading-relaxed text-[#5B6776]">
                                We&apos;re committed to your privacy. Bucky Solutions uses the information you provide to contact you about relevant content, products, and services. You may unsubscribe from these communications at any time. For more information, see our
                                <a href="https://buckysolutions.com/privacy-policy" target="_blank" rel="noreferrer" className="ml-1 text-[#2DA4A9]">
                                  Privacy Policy.
                                </a>
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="p-6 sm:p-8">
                              <div className="pr-10">
                                <p className="text-xs uppercase tracking-[0.08em] text-[#5B6776]">{activeCheck.name}</p>

                                <p className="mt-3 text-2xl leading-9 text-[#0A1628]">{activeCheck.finding}</p>

                                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                                  <div>
                                    <p className="text-[11px] uppercase tracking-[0.1em] text-[#94A3B8]">Why This Matters</p>
                                    <p className="mt-2 text-sm leading-7 text-[#5B6776]">{activeCheck.details}</p>
                                  </div>

                                  <div>
                                    <p className="text-[11px] uppercase tracking-[0.1em] text-[#94A3B8]">
                                      {activeCheck.status === "fail"
                                        ? "How To Fix It"
                                        : activeCheck.status === "pass"
                                          ? "What To Keep Doing"
                                          : "What To Check Next"}
                                    </p>
                                    <p className="mt-2 text-sm leading-7 text-[#0A1628]">
                                      {activeCheck.status === "fail"
                                        ? (FIX_TEXTS[activeCheck.id] ?? "Contact a web developer to address this issue.")
                                        : activeCheck.status === "pass"
                                          ? "Keep this information easy to find and up to date. Strong areas like this help visitors feel confident about booking with you."
                                          : "We could not verify this signal confidently from the site scan alone. Confirm it manually in your Google Business Profile and on your live listings."}
                                    </p>

                                    {activeCheck.status === "fail" && AI_DRAFT_CHECK_IDS.has(activeCheck.id) ? (
                                      <button
                                        type="button"
                                        onClick={() => void downloadPolicyPdf()}
                                        disabled={isGeneratingAiPdf}
                                        className="mt-4 text-xs text-[#64748B] underline underline-offset-2 disabled:opacity-50"
                                      >
                                        {isGeneratingAiPdf ? "Preparing PDF..." : "Download AI draft as PDF"}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-[#E6EBF0] px-6 py-4 sm:px-8">
                              <p className="text-sm text-[#5B6776]">
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
                                className="inline-flex items-center justify-center bg-[#2DA4A9] px-4 py-2 text-sm text-white transition-opacity hover:opacity-90"
                              >
                                {activeCheckCta.buttonLabel}
                              </a>
                            </div>
                          </>
                        )}
                      </motion.div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {hidePassingChecks && detailedCategories.length === 0 ? (
                  <div className="mt-8 border border-[#E6EBF0] bg-[#fafcfd] px-5 py-4 text-sm text-[#5B6776]">
                    Nothing is currently failing. You are clear across every tracked checkpoint.
                  </div>
                ) : null}

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
