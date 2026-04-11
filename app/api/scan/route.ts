import { NextRequest, NextResponse } from "next/server";
import tls from "node:tls";

export const runtime = "nodejs";
export const maxDuration = 60;

type IndustryKey = "campground" | "marina" | "glamping" | "cabins";
type CheckCategory =
  | "Does Your Website Work?"
  | "Can Guests Book Online?"
  | "What Info Are You Missing?"
  | "Can Guests Find You?"
  | "Are You Losing Guests?";
type CheckStatus = "pass" | "fail" | "unknown";
type Effort = "Low" | "Medium" | "High";
type Impact = "Low" | "Medium" | "High";

type Check = {
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

type CategoryWeightMap = Record<CheckCategory, number>;
type IndustryConfig = {
  label: string;
  unitLabel: string;
  listingKeywords: string[];
  categoryWeights: CategoryWeightMap;
};

const industryConfig: Record<IndustryKey, IndustryConfig> = {
  campground: {
    label: "Campground / RV Park",
    unitLabel: "sites",
    listingKeywords: ["campendium", "thedyrt", "hipcamp", "rv life", "rvlife"],
    categoryWeights: {
      "Does Your Website Work?": 15,
      "Can Guests Book Online?": 25,
      "What Info Are You Missing?": 30,
      "Can Guests Find You?": 15,
      "Are You Losing Guests?": 15,
    },
  },
  marina: {
    label: "Marina",
    unitLabel: "slips",
    listingKeywords: ["dockwa", "marinas.com", "waterway guide", "snag-a-slip"],
    categoryWeights: {
      "Does Your Website Work?": 15,
      "Can Guests Book Online?": 25,
      "What Info Are You Missing?": 25,
      "Can Guests Find You?": 20,
      "Are You Losing Guests?": 15,
    },
  },
  glamping: {
    label: "Glamping",
    unitLabel: "tents/domes",
    listingKeywords: ["hipcamp", "glamping hub", "canopy", "airbnb"],
    categoryWeights: {
      "Does Your Website Work?": 10,
      "Can Guests Book Online?": 20,
      "What Info Are You Missing?": 35,
      "Can Guests Find You?": 20,
      "Are You Losing Guests?": 15,
    },
  },
  cabins: {
    label: "Cabins / Vacation Rentals",
    unitLabel: "units",
    listingKeywords: ["airbnb", "vrbo", "booking.com", "expedia"],
    categoryWeights: {
      "Does Your Website Work?": 15,
      "Can Guests Book Online?": 25,
      "What Info Are You Missing?": 30,
      "Can Guests Find You?": 15,
      "Are You Losing Guests?": 15,
    },
  },
};

const FAIL_IMPACT_BY_CHECK_ID: Partial<Record<string, string>> = {
  "ssl-valid": "Estimated impact: Security warnings can stop bookings before guests even view the property.",
  "https-redirect": "Estimated impact: Mixed secure/insecure routing weakens trust at the first click.",
  "response-time": "When your site takes too long to load, most people close the tab before they ever see what you offer.",
  "broken-links": "Clicking a link that goes nowhere makes your site feel abandoned — like a broken sign in front of your property.",
  "pagespeed-mobile": "Most guests are browsing on their phone. If it loads slowly, they'll book somewhere else before your page even appears.",
  "website-technology": "An outdated website doesn't just look old — it loads slowly, breaks on phones, and gives guests the impression your park is behind the times.",
  "technical-trust-security": "Browsers show security warnings on unprotected sites. Guests won't enter credit card info if they see one.",
  "canonical-redirect-hygiene": "Your site might be accessible at multiple URLs, which confuses Google and splits your search traffic.",
  "booking-platform": "Guests want to book at 10pm on a Sunday. Without an online booking system, those reservations go to a competitor.",
  "booking-cta": "If visitors can't quickly spot a 'Book Now' button, they'll move on to a park where it's obvious.",
  "date-picker-discoverability": "The first thing guests want to know is whether you have space on their dates. Make that easy to check.",
  "tracking-pixels": "Without tracking, you have no way to show ads to the people who visited your site but didn't book.",
  "pet-policy": "Pet owners won't book if they can't tell whether Fido is welcome. They'll call — or just go somewhere that says it clearly.",
  "rv-hookup-specs": "RV travelers need to know your amp service and hookup type before they'll commit. They won't guess.",
  "big-rig-readiness": "Big-rig owners skip parks that don't clearly post max length or pull-through availability.",
  "arrival-directions-clarity": "Bad GPS directions to rural properties cause frustrating arrivals and bad first impressions.",
  "amenities-page": "If guests can't see what you offer, they can't decide if your price is worth it.",
  "park-map": "Guests want to see the layout before arriving. Without a map, they can't pick the right site or plan their stay.",
  "rate-page": "Hidden pricing forces guests to call or guess. Most just leave and book somewhere that shows rates upfront.",
  "cancellation-policy": "Families planning months ahead worry about 'what if.' A clear cancellation policy turns 'maybe' into 'book.'",
  "photo-gallery-quality": "Guests are buying an experience they've never seen. Weak photos make that a hard sell.",
  "accessibility-statement": "Guests with mobility needs won't risk a trip without knowing what to expect. A statement shows you care.",
  "meta-title": "This is what shows up as the headline in Google search results. Missing or vague = fewer clicks.",
  "meta-description": "This is the 2-sentence preview under your Google listing. If it's missing, Google picks random text from your page.",
  "gbp-sync": "When someone Googles 'campground near me,' Google shows a map with photos and reviews. You need to be on it.",
  "local-review-competitiveness": "Guests compare reviews between nearby parks. If yours lag behind, they book the competitor.",
  "social-presence": "Most guests check Facebook or Instagram before booking. No social presence = less trust.",
  "mobile-viewport": "Without proper phone layout settings, your site shows up tiny and zoomed out on smartphones.",
  "header-phone": "Guests ready to call want a tap-to-call number at the top of the page. Don't make them scroll.",
  "phone-conversion-readiness": "Some guests prefer calling. Make that path easy with a visible number and clear call-to-action.",
  "rate-transparency": "Guests want to know if they can afford you before they invest time filling out forms.",
  "contact-friction": "Every missing contact option (phone, email, chat) is a guest who wanted to reach you but couldn't.",
  "trust-stack-completeness": "Secure site + cancellation policy + guest reviews = confidence to enter a credit card.",
  "seasonal-visibility": "Off-season deals drive bookings when you need them most. If they're hidden, they're not working.",
  "professional-email": "A branded email builds credibility. Guests feel more confident reaching out to info@yourpark.com than a personal address.",
  "checkin-checkout-times": "Without posted check-in and check-out times, guests either call to ask or show up at the wrong time — both create unnecessary work for you.",
  "structured-data": "Structured data tells Google to show your star rating, price range, and business details directly in search results.",
  "accessibility-score": "Poor accessibility excludes guests with disabilities and can hurt your search rankings.",
  "sitemap-presence": "Without a sitemap, search engines have to guess which pages matter — and they often miss the important ones.",
  "copyright-freshness": "An outdated copyright year makes visitors think your park might be closed or neglected.",
};

const PASS_IMPACT_BY_CHECK_ID: Partial<Record<string, string>> = {
  "pagespeed-mobile": "Your site loads fast on phones — guests can browse and book without waiting.",
  "booking-cta": "Your 'Book Now' button is easy to find. That keeps ready-to-book guests moving forward.",
  "rate-transparency": "Showing prices upfront lets guests decide quickly instead of bouncing to compare.",
};

const UNKNOWN_IMPACT_BY_CHECK_ID: Partial<Record<string, string>> = {
  "contact-friction": "Some contact methods may exist but aren't easy to find. Make sure guests can reach you their preferred way.",
  "local-review-competitiveness": "We couldn't get a clear picture of your review volume. Check your Google Business Profile directly.",
};

const getEstimatedImpactForCheck = (check: Check): string => {
  if (check.status === "pass") {
    return PASS_IMPACT_BY_CHECK_ID[check.id] ?? "This is set up well and working in your favor.";
  }

  if (check.status === "unknown") {
    return UNKNOWN_IMPACT_BY_CHECK_ID[check.id]
      ?? `We couldn't fully verify ${check.name.toLowerCase()}. Worth double-checking on your end.`;
  }

  return FAIL_IMPACT_BY_CHECK_ID[check.id] ?? "This gap could be costing you bookings from guests who are ready to reserve.";
};

const getDifficultyForCheck = (check: Check): string => {
  const difficultyMap: Record<string, string> = {
    Low: "Easy",
    Medium: "Medium",
    High: "Hard",
  };
  return `Difficulty: ${difficultyMap[check.effort] || "Medium"}`;
};

const SHARED_PROPERTY_PATTERNS = [
  /\brv park\b/i,
  /\brv resort\b/i,
  /\bcamp(?:ground|site|ing)\b/i,
  /\bglamp(?:ing)?\b/i,
  /\bmarina\b/i,
  /\bcabin(?:s)?\b/i,
  /\blodge\b/i,
  /\bresort\b/i,
  /\byurt\b/i,
  /\bdome\b/i,
  /\btiny home\b/i,
  /\bovernight stay\b/i,
  /\bbook (?:now|your stay)\b/i,
  /\bcheck availability\b/i,
  /\breserve (?:now|your stay)\b/i,
];

const INDUSTRY_PROPERTY_PATTERNS: Record<IndustryKey, RegExp[]> = {
  campground: [/\bcamp(?:ground|site|ing)\b/i, /\brv park\b/i, /\bcaravan site\b/i, /\bfull hookups?\b/i],
  marina: [/\bmarina\b/i, /\bboat slips?\b/i, /\bdockage\b/i, /\bfuel dock\b/i],
  glamping: [/\bglamp(?:ing)?\b/i, /\byurt\b/i, /\bdome\b/i, /\bsafari tent\b/i],
  cabins: [/\bcabin(?:s)?\b/i, /\blodge\b/i, /\bchalet\b/i, /\bv(?:acation)? rental\b/i],
};

const platformCatalog = [
  "Campspot",
  "Reserve America",
  "Hipcamp",
  "Campify",
  "Lodgify",
  "RezStream",
  "ResNexus",
  "RoverPass",
  "NewBook",
  "iCamp",
  "Dockwa",
  "Screnko",
  "Staylist",
  "Cloudbeds",
  "Guesty",
  // Vacation rental / cabin / resort platforms
  "Streamline",
  "streamlinevrs",
  "Rezfusion",
  "LiveRez",
  "Barefoot",
  "Track",
  "Escapia",
  "VacationRentPro",
  "Kigo",
  "Beds24",
  "Hostaway",
  "Smoobu",
  "Rentlio",
  "MyVR",
  "OwnerRez",
  "V12",
  "iTrip",
  "VRScheduler",
  "BookingSync",
  "BookingPal",
  "Firefly",
  "fireflyreservations",
];

const normalizeUrl = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = value.startsWith("http://") || value.startsWith("https://")
      ? new URL(value)
      : new URL(`https://${value}`);
    const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (!hostname) {
      return null;
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
    return fallback || null;
  }
};

const getIndustry = (value: string | null): IndustryKey => {
  switch (value) {
    case "marina":
    case "glamping":
    case "cabins":
      return value;
    default:
      return "campground";
  }
};

const extractMeta = (html: string, property: "title" | "description"): string => {
  if (property === "title") {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return titleMatch?.[1]?.trim() ?? "";
  }

  const descriptionMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
  );
  if (descriptionMatch?.[1]) {
    return descriptionMatch[1].trim();
  }

  const inverseMatch = html.match(
    /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i,
  );
  return inverseMatch?.[1]?.trim() ?? "";
};

const isLikelyOutdoorHospitalitySite = (input: {
  hostname: string;
  title?: string;
  description?: string;
  bodySnippet?: string;
  industry: IndustryKey;
}): boolean => {
  const combined = `${input.hostname} ${input.title ?? ""} ${input.description ?? ""} ${input.bodySnippet ?? ""}`;
  const sharedHits = SHARED_PROPERTY_PATTERNS.filter((pattern) => pattern.test(combined)).length;
  const industryHits = INDUSTRY_PROPERTY_PATTERNS[input.industry].filter((pattern) => pattern.test(combined)).length;

  if (industryHits >= 1) {
    return true;
  }

  return sharedHits >= 2;
};

const extractAnchors = (html: string): string[] => {
  const matches = html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
  return Array.from(matches).map((entry) => entry[1]);
};

const extractFormActions = (html: string): string[] => {
  const matches = html.matchAll(/<form[^>]*action=["']([^"']+)["'][^>]*>/gi);
  return Array.from(matches).map((entry) => entry[1]);
};

const detectTrackingPixels = (html: string): string[] => {
  return [
    /fbq\(|connect\.facebook\.net|facebook pixel/i.test(html) ? "Facebook Pixel" : null,
    /googletagmanager\.com|gtag\(|gtm\.js/i.test(html) ? "Google Tag Manager" : null,
  ].filter((value): value is string => Boolean(value));
};

const extractImages = (html: string): Array<{ width: number | null; src: string }> => {
  const matches = Array.from(html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi));
  return matches.map((match) => {
    const tag = match[0];
    const widthMatch = tag.match(/width=["']?(\d+)/i);
    return {
      src: match[1],
      width: widthMatch ? Number(widthMatch[1]) : null,
    };
  });
};

const isInternalLink = (href: string, baseUrl: URL): boolean => {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  try {
    const resolved = new URL(href, baseUrl);
    const stripWww = (h: string) => h.replace(/^www\./, "");
    return stripWww(resolved.host) === stripWww(baseUrl.host);
  } catch {
    return false;
  }
};

const statusFromScore = (score: number): "Industry Leader" | "Above Average" | "Needs Attention" | "At Risk" | "Critical" => {
  if (score >= 80) return "Industry Leader";
  if (score >= 65) return "Above Average";
  if (score >= 50) return "Needs Attention";
  if (score >= 35) return "At Risk";
  return "Critical";
};

const fetchWithTimeout = async (
  url: string,
  optionsOrTimeout: RequestInit | number = 10000,
  maybeTimeoutMs?: number,
): Promise<Response> => {
  const options = typeof optionsOrTimeout === "number" ? {} : optionsOrTimeout;
  const timeoutMs = typeof optionsOrTimeout === "number" ? optionsOrTimeout : (maybeTimeoutMs ?? 10000);
  const normalizedHeaders = new Headers(options.headers ?? {});

  // Some hospitality websites block non-browser user-agents by default.
  if (!normalizedHeaders.has("user-agent")) {
    normalizedHeaders.set(
      "user-agent",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
  }

  if (!normalizedHeaders.has("accept")) {
    normalizedHeaders.set("accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      headers: normalizedHeaders,
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeScanError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "Unexpected scan error";
  }

  const lower = error.message.toLowerCase();
  if (lower.includes("fetch failed") || lower.includes("socket hang up")) {
    return "Unable to reach the website right now. This site may be blocking automated checks or timing out. Please retry in a moment.";
  }

  if (lower.includes("aborted") || lower.includes("timeout")) {
    return "The website took too long to respond. Please retry in a moment.";
  }

  return error.message;
};

const normalizePageSpeedError = (message?: string, status?: number): { message: string; shouldRetry: boolean } => {
  const normalized = (message ?? "").toLowerCase();

  if (status === 429 || normalized.includes("quota exceeded") || normalized.includes("resource_exhausted")) {
    return {
      message: "PageSpeed API quota is exhausted for the configured project. Google PageSpeed's website can still show a mobile score because it uses Google's own internal quota, but this app cannot fetch a live API score until your quota/key is fixed.",
      shouldRetry: false,
    };
  }

  if (normalized.includes("api key not valid") || normalized.includes("forbidden") || status === 403) {
    return {
      message: "PageSpeed API access is not authorized for the configured key. Verify the key, API enablement, and project restrictions.",
      shouldRetry: false,
    };
  }

  if (status === 500 && normalized.includes("lighthouse returned error")) {
    return {
      message: "Google's PageSpeed API could not complete a Lighthouse mobile run for this URL right now. The public PageSpeed website may still show a cached or internally retried result, but the API did not return a usable live mobile score.",
      shouldRetry: true,
    };
  }

  return {
    message: message ?? "PageSpeed API request failed.",
    shouldRetry: true,
  };
};

type PlacesBusinessSignals = {
  matched: boolean;
  reviewCount: number | null;
  rating: number | null;
  recentReviews30d: number | null;
  ownerResponses30d: number | null;
  ownerResponseRate30d: number | null;
};

const hostFromWebsiteUri = (websiteUri?: string): string => {
  if (!websiteUri) {
    return "";
  }

  try {
    return new URL(websiteUri).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
};

const fetchPlacesBusinessSignals = async (
  host: string,
  apiKey?: string,
): Promise<PlacesBusinessSignals | null> => {
  const normalizedApiKey = apiKey?.trim() ?? "";
  if (!normalizedApiKey) {
    return null;
  }

  try {
    const searchResponse = await fetchWithTimeout(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": normalizedApiKey,
          "X-Goog-FieldMask": "places.id,places.websiteUri,places.rating,places.userRatingCount",
        },
        body: JSON.stringify({
          textQuery: host,
          pageSize: 6,
          languageCode: "en",
        }),
      },
      9000,
    );

    if (!searchResponse.ok) {
      return null;
    }

    const searchPayload = (await searchResponse.json()) as {
      places?: Array<{
        id?: string;
        websiteUri?: string;
        rating?: number;
        userRatingCount?: number;
      }>;
    };

    const places = searchPayload.places ?? [];
    const subjectPlace = places.find((place) => hostFromWebsiteUri(place.websiteUri) === host) ?? places[0];
    if (!subjectPlace?.id) {
      return null;
    }

    const detailsResponse = await fetchWithTimeout(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(subjectPlace.id)}`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": normalizedApiKey,
          "X-Goog-FieldMask": "rating,userRatingCount,reviews.publishTime,reviews.reviewReply",
        },
      },
      9000,
    );

    const fallbackReviewCount =
      typeof subjectPlace.userRatingCount === "number" ? subjectPlace.userRatingCount : null;
    const fallbackRating = typeof subjectPlace.rating === "number" ? subjectPlace.rating : null;

    if (!detailsResponse.ok) {
      return {
        matched: true,
        reviewCount: fallbackReviewCount,
        rating: fallbackRating,
        recentReviews30d: null,
        ownerResponses30d: null,
        ownerResponseRate30d: null,
      };
    }

    const detailsPayload = (await detailsResponse.json()) as {
      rating?: number;
      userRatingCount?: number;
      reviews?: Array<{
        publishTime?: string;
        reviewReply?: { text?: { text?: string } | string } | string;
      }>;
    };

    const reviewCount =
      typeof detailsPayload.userRatingCount === "number"
        ? detailsPayload.userRatingCount
        : fallbackReviewCount;
    const rating =
      typeof detailsPayload.rating === "number"
        ? detailsPayload.rating
        : fallbackRating;

    const reviews = detailsPayload.reviews ?? [];
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentReviews = reviews.filter((review) => {
      const publishTime = review.publishTime ? Date.parse(review.publishTime) : Number.NaN;
      return Number.isFinite(publishTime) && publishTime >= thirtyDaysAgo;
    });
    const ownerResponses30d = recentReviews.filter((review) => {
      if (typeof review.reviewReply === "string") {
        return review.reviewReply.trim().length > 0;
      }
      if (review.reviewReply && typeof review.reviewReply === "object") {
        const nested = review.reviewReply.text;
        if (typeof nested === "string") {
          return nested.trim().length > 0;
        }
        if (nested && typeof nested === "object" && typeof nested.text === "string") {
          return nested.text.trim().length > 0;
        }
      }
      return false;
    }).length;

    const recentReviews30d = recentReviews.length;
    const ownerResponseRate30d = recentReviews30d > 0
      ? Math.round((ownerResponses30d / recentReviews30d) * 100)
      : null;

    return {
      matched: true,
      reviewCount,
      rating,
      recentReviews30d,
      ownerResponses30d,
      ownerResponseRate30d,
    };
  } catch {
    return null;
  }
};

const evaluateHumanWrittenContent = (html: string): {
  status: CheckStatus;
  finding: string;
  details: string;
} => {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const words = text.match(/[a-z][a-z'-]{2,}/g) ?? [];
  if (words.length < 120) {
    return {
      status: "pass",
      finding: "Not enough on-page text to fully evaluate writing style — not penalizing.",
      details: "Your homepage has limited text, which isn't necessarily a problem. Add more descriptive copy if you want a deeper writing quality analysis.",
    };
  }

  const uniqueRatio = new Set(words).size / words.length;

  // Only flag truly spammy repetition, not normal hospitality language
  const repetitivePhrases = [
    /\b(?:book now)\b/gi,
    /\b(?:ultimate experience)\b/gi,
    /\b(?:unforgettable stay)\b/gi,
    /\b(?:nestled in nature)\b/gi,
    /\b(?:world[- ]class amenities)\b/gi,
    /\b(?:state[- ]of[- ]the[- ]art)\b/gi,
  ].reduce((sum, pattern) => sum + (text.match(pattern)?.length ?? 0), 0);

  // Only flag obvious SEO-stuffing patterns, not normal industry terms
  const optimizedTerms = [
    "best campground",
    "top rated",
    "near me",
    "#1 rated",
    "number one",
  ];
  const optimizedCount = optimizedTerms.reduce((sum, term) => sum + (text.match(new RegExp(term, "gi"))?.length ?? 0), 0);
  const optimizedDensity = optimizedCount / words.length;

  const aiProbability = Math.max(
    0,
    Math.min(
      1,
      ((1 - uniqueRatio) * 0.8) + (repetitivePhrases * 0.03) + (optimizedDensity * 6),
    ),
  );
  const probabilityPercent = Math.round(aiProbability * 100);

  if (aiProbability >= 0.50) {
    return {
      status: "fail",
      finding: `Writing pattern appears heavily templated (${probabilityPercent}% AI-style probability).`,
      details: "The copy sounds generic and repetitive. Add real details about your property — what makes your park different from the one down the road?",
    };
  }

  if (aiProbability >= 0.35) {
    return {
      status: "fail",
      finding: `Writing style appears partly templated (${probabilityPercent}% AI-style probability).`,
      details: "Some sections feel authentic, others sound like a template. Tighten it up with specific details guests would actually care about.",
    };
  }

  return {
    status: "pass",
    finding: `Content appears mostly human and property-specific (${probabilityPercent}% AI-style probability).`,
    details: "The writing tone looks natural and trustworthy for guests comparing multiple parks.",
  };
};

type AiContentResult = {
  petPolicy: { found: boolean; noPets: boolean; summary: string };
  cancellationPolicy: { found: boolean; summary: string };
  rvHookupSpecs: { found: boolean; summary: string };
  bigRigReadiness: { maxLength: boolean; siteType: boolean; summary: string };
  arrivalDirections: { found: boolean; gpsWarning: boolean; summary: string };
  checkinCheckoutTimes: { found: boolean; summary: string };
  accessibilityStatement: { found: boolean; summary: string };
  humanWrittenContent: { appearsHuman: boolean; summary: string };
  parkMap: { found: boolean; summary: string };
};

const evaluateContentWithAI = async (
  fullSiteText: string,
  geminiApiKey: string,
): Promise<AiContentResult | null> => {
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
  // Truncate to ~30k chars to stay within token limits while capturing enough content.
  const truncated = fullSiteText.slice(0, 30000);

  const prompt = `You are an auditor for outdoor hospitality websites (campgrounds, RV parks, glamping, marinas, cabins). Analyze the following website text and answer each question with a JSON object. Be generous — if the content is present in ANY form, mark it as found.

WEBSITE TEXT:
---
${truncated}
---

Answer these 9 questions about the website content. Return ONLY valid JSON, no markdown fences, no explanation.

{
  "petPolicy": {
    "found": true/false (is there ANY mention of pets, dogs, pet policy, pet-friendly, no pets, leash rules, dog park, pet fee, etc.?),
    "noPets": true/false (does the site explicitly say no pets allowed? false if pets are welcome or no mention),
    "summary": "one sentence describing what was found"
  },
  "cancellationPolicy": {
    "found": true/false (is there ANY mention of cancellation, refund, no-refund, nonrefundable, cancel reservation, etc.?),
    "summary": "one sentence"
  },
  "rvHookupSpecs": {
    "found": true/false (is there ANY mention of 30 amp, 50 amp, full hookup, water/electric, sewer hookup, electric hookup, etc.?),
    "summary": "one sentence"
  },
  "bigRigReadiness": {
    "maxLength": true/false (is there mention of max RV length, rig length limit, or specific footage like '45 ft max'?),
    "siteType": true/false (is there mention of pull-through or back-in sites?),
    "summary": "one sentence"
  },
  "arrivalDirections": {
    "found": true/false (is there a directions page, 'getting here' section, arrival instructions, or 'how to get here'?),
    "gpsWarning": true/false (is there a GPS warning, low clearance, bridge clearance, avoid certain roads, RV route advice?),
    "summary": "one sentence"
  },
  "checkinCheckoutTimes": {
    "found": true/false (are specific check-in and/or check-out TIMES posted with actual hours like '3pm check-in' or 'check-out by 11am'?),
    "summary": "one sentence"
  },
  "accessibilityStatement": {
    "found": true/false (is there ANY mention of accessibility, ADA, wheelchair accessible sites, accessible facilities, mobility needs?),
    "summary": "one sentence"
  },
  "humanWrittenContent": {
    "appearsHuman": true/false (does the main body copy appear to be written by a real person about THIS specific property, rather than generic AI-generated template text?),
    "summary": "one sentence explaining why"
  },
  "parkMap": {
    "found": true/false (is there a park map, campground map, site map showing the property layout, interactive map of the grounds, or downloadable PDF map of the property?),
    "summary": "one sentence"
  }
}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 800,
          },
        }),
      },
    );
    clearTimeout(timeout);

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) return null;

    // Strip markdown fences if present.
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(jsonText) as AiContentResult;
    return parsed;
  } catch {
    return null;
  }
};

const getSslData = async (
  host: string,
): Promise<{ valid: boolean; daysUntilExpiry: number; timedOut?: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
        timeout: 12000,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        if (!cert?.valid_to) {
          resolve({ valid: false, daysUntilExpiry: 0, error: "No certificate found" });
          return;
        }

        const expiresAt = new Date(cert.valid_to).getTime();
        const now = Date.now();
        const daysUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));
        resolve({ valid: daysUntilExpiry > 0, daysUntilExpiry });
      },
    );

    socket.on("error", (error) => {
      const msg = error.message.toLowerCase();
      // Connection timeouts and resets on slow servers are not proof of bad SSL.
      const isTransient = msg.includes("timeout") || msg.includes("etimedout") || msg.includes("econnreset") || msg.includes("socket hang up");
      resolve({ valid: false, daysUntilExpiry: 0, timedOut: isTransient, error: error.message });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ valid: false, daysUntilExpiry: 0, timedOut: true, error: "TLS timeout" });
    });
  });
};

const createCheck = (input: {
  id: string;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  finding: string;
  details: string;
  weight?: number;
  effort?: Effort;
  impact?: Impact;
  serviceKey?: string;
}): Check => {
  return {
    weight: 1,
    effort: "Medium",
    impact: "Medium",
    serviceKey: "default",
    ...input,
    pass: input.status === "pass",
  };
};

export async function GET(request: NextRequest) {
  const requestedUrl = request.nextUrl.searchParams.get("url") ?? "";
  const normalizedHost = normalizeUrl(requestedUrl);
  const industry = getIndustry(request.nextUrl.searchParams.get("industry"));
  const validateOnly = request.nextUrl.searchParams.get("validateOnly") === "true";
  const config = industryConfig[industry];

  if (!normalizedHost) {
    return NextResponse.json({ message: "Please provide a valid URL." }, { status: 400 });
  }

  try {
    const canonicalHost = normalizedHost;
    let websiteUrl = new URL(`https://${canonicalHost}/`);
    const scanStartedAt = performance.now();
    const timingEnabled = process.env.SCAN_DEBUG_TIMING === "true";
    const phaseTimings: Record<string, number> = {};
    const measure = async <T>(label: string, task: () => Promise<T>): Promise<T> => {
      const startedAt = performance.now();
      try {
        return await task();
      } finally {
        if (timingEnabled) {
          phaseTimings[label] = Math.round(performance.now() - startedAt);
        }
      }
    };

    // Start SSL + HTTP redirect checks immediately (they don't depend on HTML).
    const httpVersion = new URL(websiteUrl.toString());
    httpVersion.protocol = "http:";
    const sslAndRedirectPromise = measure("sslAndRedirectCheck", async () => {
      return Promise.all([
        getSslData(websiteUrl.hostname),
        fetchWithTimeout(httpVersion.toString(), 12000).catch(() => null),
      ]);
    });

    const fetchStart = performance.now();
    let homeResponse: Response;
    try {
      homeResponse = await fetchWithTimeout(websiteUrl.toString());
    } catch (primaryError) {
      const fallbackUrl = new URL(websiteUrl.toString());
      fallbackUrl.hostname = `www.${websiteUrl.hostname}`;
      try {
        homeResponse = await fetchWithTimeout(fallbackUrl.toString());
        websiteUrl = fallbackUrl;
      } catch {
        throw primaryError;
      }
    }
    const responseTimeMs = Math.round(performance.now() - fetchStart);
    if (timingEnabled) {
      phaseTimings.homepageFetch = responseTimeMs;
    }

    // Follow redirects: update websiteUrl to match the final response URL so all
    // subsequent fetches, subpage crawls, and comparisons use the correct host/path.
    try {
      const finalUrl = new URL(homeResponse.url);
      if (finalUrl.hostname !== websiteUrl.hostname) {
        websiteUrl = new URL(`${finalUrl.protocol}//${finalUrl.hostname}/`);
      }
    } catch {
      // homeResponse.url can be empty in some runtimes — keep existing websiteUrl.
    }

    // Start PageSpeed immediately after URL is confirmed — it only needs the URL, not HTML.
    const pageSpeedApiKey = process.env.PAGESPEED_API_KEY?.trim();
    const pageSpeedReportUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(websiteUrl.toString())}`;

    const pageSpeedPromise = pageSpeedApiKey
      ? (async () => {
          // --- CrUX: grab mobile traffic % (informational only, not used for scoring) ---
          let cruxMobileTrafficPercent: number | null = null;
          try {
            const cruxController = new AbortController();
            const cruxTimeout = setTimeout(() => cruxController.abort(), 3000);
            const cruxEndpoint = `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${pageSpeedApiKey}`;
            const cruxHeaders = { "Content-Type": "application/json" };

            const primaryOrigin = websiteUrl.origin;
            const host = websiteUrl.hostname;
            const altOrigin = host.startsWith("www.")
              ? `${websiteUrl.protocol}//${host.slice(4)}`
              : `${websiteUrl.protocol}//www.${host}`;

            for (const origin of [primaryOrigin, altOrigin]) {
              const resp = await fetch(cruxEndpoint, {
                method: "POST",
                headers: cruxHeaders,
                body: JSON.stringify({ origin }),
                signal: cruxController.signal,
              });
              if (resp.ok) {
                const cruxData = (await resp.json()) as {
                  record?: { metrics?: { form_factors?: { fractions?: { phone?: number } } } };
                };
                const phoneFraction = cruxData.record?.metrics?.form_factors?.fractions?.phone;
                if (typeof phoneFraction === "number") {
                  cruxMobileTrafficPercent = Math.round(phoneFraction * 100);
                  console.log(`[crux] Mobile traffic: ${cruxMobileTrafficPercent}% for ${origin}`);
                  break;
                }
              }
            }
            clearTimeout(cruxTimeout);
          } catch {
            // CrUX failed or timed out — no mobile traffic stat, that's fine
          }

          // --- Lighthouse: authoritative mobile speed score ---
          try {
            const pageSpeedUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
            pageSpeedUrl.searchParams.set("url", websiteUrl.toString());
            pageSpeedUrl.searchParams.set("strategy", "mobile");
            pageSpeedUrl.searchParams.set("category", "performance");
            pageSpeedUrl.searchParams.append("category", "accessibility");
            pageSpeedUrl.searchParams.set("key", pageSpeedApiKey);

            const pageSpeedResponse = await fetch(pageSpeedUrl.toString());
            const payload = (await pageSpeedResponse.json()) as {
              lighthouseResult?: {
                categories?: {
                  performance?: { score?: number };
                  accessibility?: { score?: number };
                };
                runtimeError?: { message?: string };
              };
              error?: { message?: string };
            };

            if (!pageSpeedResponse.ok) {
              const normalizedError = normalizePageSpeedError(
                payload.error?.message ?? `PageSpeed API returned ${pageSpeedResponse.status}.`,
                pageSpeedResponse.status,
              );
              return { score: null, accessibilityScore: null, error: normalizedError.message, mobileTrafficPercent: cruxMobileTrafficPercent };
            }

            const runtimeError = payload.lighthouseResult?.runtimeError?.message;
            const rawScore = payload.lighthouseResult?.categories?.performance?.score;
            const rawA11yScore = payload.lighthouseResult?.categories?.accessibility?.score;

            const perfScore = typeof rawScore === "number" && !Number.isNaN(rawScore) ? Math.round(rawScore * 100) : null;
            const a11yScore = typeof rawA11yScore === "number" && !Number.isNaN(rawA11yScore) ? Math.round(rawA11yScore * 100) : null;

            if (perfScore !== null) {
              return { score: perfScore, accessibilityScore: a11yScore, error: null, mobileTrafficPercent: cruxMobileTrafficPercent };
            }

            return {
              score: null,
              accessibilityScore: a11yScore,
              error: runtimeError
                ? `Lighthouse returned error: ${runtimeError}`
                : "PageSpeed API did not return a usable performance score.",
              mobileTrafficPercent: cruxMobileTrafficPercent,
            };
          } catch {
            return { score: null, accessibilityScore: null, error: "PageSpeed check is taking longer than expected right now.", mobileTrafficPercent: cruxMobileTrafficPercent };
          }
        })()
      : Promise.resolve(null);

    const placesApiKey = process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim() || "";
    const placesSignalsPromise = fetchPlacesBusinessSignals(
      websiteUrl.hostname.replace(/^www\./i, "").toLowerCase(),
      placesApiKey,
    );

    const html = await homeResponse.text();
    const loweredHtml = html.toLowerCase();
    const title = extractMeta(html, "title");
    const description = extractMeta(html, "description");

    const bodySnippet = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 2500);

    if (!isLikelyOutdoorHospitalitySite({
      hostname: websiteUrl.hostname,
      title,
      description,
      bodySnippet,
      industry,
    })) {
      return NextResponse.json(
        {
          message: "ParkGrader only supports campground, RV park, marina, glamping, and cabin property websites.",
        },
        { status: 400 },
      );
    }

    if (validateOnly) {
      return NextResponse.json({ ok: true, url: canonicalHost });
    }

    const links = extractAnchors(html);
    const images = extractImages(html);

    // Await SSL + redirect results (started before homepage fetch).
    const [sslData, httpResponse] = await sslAndRedirectPromise;
    const redirectedToHttps =
      httpResponse?.url?.startsWith("https://") ||
      httpResponse?.headers.get("location")?.startsWith("https://") ||
      false;
    // If the HTTP fetch timed out / failed entirely, we can't confirm redirect status.
    const httpRedirectUnknown = httpResponse === null;

    const hasViewport = /<meta[^>]*name=["']viewport["'][^>]*>/i.test(html);
    const detectedPlatform = platformCatalog.find((platform) => loweredHtml.includes(platform.toLowerCase())) ?? null;
    const bookingCallToAction = /book now|reserve now|book your stay|check availability|reserve|book online|make a reservation|find a site|search availability|book a site|book a cabin|book a slip/i.test(html);

    const facebookLink = links.find((href) => href.toLowerCase().includes("facebook.com")) ?? null;
    const instagramLink = links.find((href) => href.toLowerCase().includes("instagram.com")) ?? null;
    const mapLink = links.find((href) => /google\.[^/]+\/maps|maps\.app\.goo\.gl|g\.page/i.test(href)) ?? null;
    const hasEmbeddedMap = /maps\.google|google maps|maps\.googleapis/i.test(html);
    const reviewCountMatch = html.match(/reviewCount["']?\s*[:=]\s*["']?(\d+)/i);
    const websiteReviewCount = reviewCountMatch ? Number(reviewCountMatch[1]) : null;

    const headerMatch = html.match(/<header[\s\S]*?<\/header>/i);
    const headerHtml = headerMatch?.[0] ?? "";
    const phoneMatch = headerHtml.match(/(\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
    const hasClickableHeaderPhone = /href=["']tel:/i.test(headerHtml);

    const homepageTrackingPixels = detectTrackingPixels(html);

    const internalLinks = links
      .filter((href) => isInternalLink(href, websiteUrl))
      .map((href) => new URL(href, websiteUrl).toString());
    const uniqueInternalLinks = Array.from(new Set(internalLinks)).slice(0, 6);

    // Fetch key subpages so content checks can look beyond the homepage.
    // Priority tiers ensure policy-critical pages are fetched before informational ones.
    const subpagePriority: [RegExp, number][] = [
      [/\/(rules|policies|faq|support|.*-rules|.*-policies)/i, 1],         // Most likely to contain cancellation, check-in/out, vehicle rules
      [/\/(rates?|pricing|amenities|activities|recreation)/i, 2], // Pricing and feature info
      [/\/(pet|hookup|camp-?site|cabin|accommodation|.*-pet)/i, 3],     // Property-specific details
      [/\/(directions|getting-?here|arrival)/i, 4],               // Arrival info
      [/\/(about|contact)/i, 5],                                  // Least policy-relevant
    ];
    const contentSubpageUrls = internalLinks
      .filter((href) => subpagePriority.some(([pattern]) => pattern.test(href)))
      .sort((a, b) => {
        const aPriority = subpagePriority.find(([p]) => p.test(a))?.[1] ?? 99;
        const bPriority = subpagePriority.find(([p]) => p.test(b))?.[1] ?? 99;
        return aPriority - bPriority;
      })
      .slice(0, 6);
    const uniqueContentSubpageUrls = Array.from(new Set(contentSubpageUrls));

    const runContentSubpageFetch = async (): Promise<string> => {
      const results = await Promise.all(
        uniqueContentSubpageUrls.map(async (link) => {
          try {
            const response = await fetchWithTimeout(link, 6000);
            if (!response.ok) return "";
            const text = await response.text();
            return text.toLowerCase();
          } catch {
            return "";
          }
        }),
      );
      return results.join(" ");
    };

    // Only count images with an explicit large width OR no width attribute but a src that looks like a real photo (not icon/logo).
    const highQualityImageCount = images.filter((image) => {
      if (image.width !== null) return image.width >= 400;
      // No width attr: exclude likely icons/logos/tiny assets
      return !/icon|logo|badge|sprite|favicon|pixel|spacer|arrow|button/i.test(image.src);
    }).length;

    const hrefContains = (parts: string[]) => links.some((href) => parts.some((part) => href.toLowerCase().includes(part)));
    const keywordContains = (parts: string[]) => parts.some((part) => loweredHtml.includes(part));

    const ratesFound = hrefContains(["/rates", "/pricing", "/reservations"]) || keywordContains(["rates", "pricing", "$", "nightly"]);
    const bookingLinks = links.filter((href) => /book|reserve|availability|campspot|hipcamp|reserveamerica|roverpass|dockwa|resnexus|newbook|lodgify|streamline|rezfusion|roverpass|staylist/i.test(href));
    // Also detect inline booking forms (date-picker widgets with no outbound <a> link).
    const hasInlineBookingForm = /<form[^>]*>[\s\S]*?(?:arrival|departure|check[ -]?in|check[ -]?out|select dates|adults|children|guests)[\s\S]*?<\/form>/i.test(html);
    const primaryBookingLink = bookingLinks[0] ? new URL(bookingLinks[0], websiteUrl).toString() : null;
    const hasExternalBookingLink = (() => {
      if (!primaryBookingLink) return false;
      try {
        const bookingHost = new URL(primaryBookingLink).hostname.replace(/^www\./, "").toLowerCase();
        const siteHost = new URL(websiteUrl).hostname.replace(/^www\./, "").toLowerCase();
        if (bookingHost === siteHost) return false;
        // Exclude generic form/doc/social platforms that aren't real booking engines.
        const nonBookingDomains = [
          "google.com", "docs.google.com", "forms.google.com", "drive.google.com",
          "facebook.com", "instagram.com", "twitter.com", "x.com", "youtube.com",
          "typeform.com", "jotform.com", "wufoo.com", "surveymonkey.com",
          "mailchimp.com", "constantcontact.com", "hubspot.com",
          "paypal.com", "venmo.com", "cashapp.com", "zelle.com",
          "linkedin.com", "tiktok.com", "pinterest.com",
        ];
        return !nonBookingDomains.some((d) => bookingHost === d || bookingHost.endsWith(`.${d}`));
      } catch { return false; }
    })();
    const canonicalMatch =
      html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i) ??
      html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
    let canonicalUrl: URL | null = null;
    if (canonicalMatch?.[1]) {
      try {
        canonicalUrl = new URL(canonicalMatch[1], websiteUrl);
      } catch {
        canonicalUrl = null;
      }
    }
    const onsiteGuestProofVisible = (html.match(/testimonial|guest review|guest said|what guests say|five-star|5-star|★★★★★|review/gi) || []).length >= 2 || /reviewCount|aggregateRating|testimonial/i.test(html);

    const hasDateSignalsOnHomepage = /check[ -]?in|check[ -]?out|arrival|departure|select dates|date picker|availability calendar|search availability/i.test(loweredHtml);
    const hasTapFriendlyBookingSignal = hasViewport && bookingCallToAction;
    const hasTapFriendlyCallSignal = hasClickableHeaderPhone;
    const callIntentSignal = /call now|tap to call|speak with us|call us/i.test(loweredHtml);

    // Structured data detection.
    const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
    const jsonLdText = jsonLdBlocks.join(" ").toLowerCase();
    const hasLocalBusinessSchema = /localbusiness|lodgingbusiness|campground|rv ?park|boatyard|accommoda/i.test(jsonLdText);
    const hasAggregateRating = /aggregaterating/i.test(jsonLdText);
    const hasPriceSchema = /offers|pricerange|price/i.test(jsonLdText);
    const structuredDataScore = [hasLocalBusinessSchema, hasAggregateRating, hasPriceSchema].filter(Boolean).length;

    let pageSpeedScore: number | null = null;
    let pageSpeedStatus: CheckStatus = "fail";
    let pageSpeedFinding = "Phone loading speed could not be confirmed — treating as needs improvement.";
    let pageSpeedDetails = "We couldn't get a live speed score from Google. This often happens with slower sites.";

    // Run PageSpeed, Facebook, and map reachability checks in parallel.

    const runMapCheck = async (): Promise<boolean> => {
      if (!mapLink) return false;
      try {
        // Google Maps redirects/blocks bot fetches — any HTTP response means the link is structurally valid.
        await fetchWithTimeout(new URL(mapLink, websiteUrl).toString(), 6000);
        return true;
      } catch {
        return false;
      }
    };

    const runBookingLandingCheck = async (): Promise<{ html: string; reachable: boolean; responseTimeMs: number | null; statusCode: number | null }> => {
      if (!primaryBookingLink) return { html: "", reachable: false, responseTimeMs: null, statusCode: null };
      const startedAt = performance.now();
      try {
        const response = await fetchWithTimeout(primaryBookingLink, 7000);
        const elapsed = Math.round(performance.now() - startedAt);
        const landingHtml = await response.text();
        // Any HTTP response (including 4xx bot-blocks) means the server is up.
        // Only a network/timeout failure (caught below) = truly unreachable.
        const health = { reachable: true, responseTimeMs: elapsed, statusCode: response.status };

        // Many booking engines only expose conversion tracking after one more in-flow click.
        const landingBaseUrl = new URL(primaryBookingLink);
        const nextStepCandidates = [
          ...extractAnchors(landingHtml),
          ...extractFormActions(landingHtml),
        ]
          .map((href) => {
            try {
              return new URL(href, landingBaseUrl).toString();
            } catch {
              return null;
            }
          })
          .filter((href): href is string => Boolean(href))
          .filter((href) => {
            try {
              const parsed = new URL(href);
              return parsed.host === landingBaseUrl.host;
            } catch {
              return false;
            }
          })
          .filter((href) => /checkout|book|reserve|availability|guest|payment|confirm|thank|cart|step/i.test(href));

        const nextStepUrl = Array.from(new Set(nextStepCandidates))[0] ?? null;
        if (!nextStepUrl) {
          return { ...health, html: landingHtml.toLowerCase() };
        }

        try {
          const nextStepResponse = await fetchWithTimeout(nextStepUrl, 5000);
          const nextStepHtml = await nextStepResponse.text();
          return { ...health, html: `${landingHtml}\n${nextStepHtml}`.toLowerCase() };
        } catch {
          return { ...health, html: landingHtml.toLowerCase() };
        }
      } catch {
        return { html: "", reachable: false, responseTimeMs: null, statusCode: null };
      }
    };

    const runBrokenLinkCheck = async (): Promise<number> => {
      let broken = 0;
      await Promise.all(
        uniqueInternalLinks.map(async (link) => {
          try {
            const response = await fetchWithTimeout(link, 6000);
            // 403/401 often means bot-blocking, not a real broken link.
            // Only count definitive client/server errors as broken.
            if (!response.ok && response.status !== 403 && response.status !== 401) broken += 1;
          } catch {
            // Timeouts and network errors on slow sites are NOT broken links.
            // Only count as broken if we can't reach anything (handled above via status codes).
          }
        }),
      );
      return broken;
    };

    const [pageSpeedResult, mapReachable, bookingLandingResult, brokenCount, placesSignals, subpageText, sitemapReachable] = await Promise.all([
      pageSpeedPromise,
      measure("mapLinkCheck", runMapCheck),
      measure("bookingLandingCheck", runBookingLandingCheck),
      measure("internalLinkScan", runBrokenLinkCheck),
      measure("placesBusinessSignals", () => placesSignalsPromise),
      measure("contentSubpageFetch", runContentSubpageFetch),
      measure("sitemapCheck", async () => {
        try {
          const res = await fetchWithTimeout(new URL("/sitemap.xml", websiteUrl).toString(), 4000);
          const text = await res.text();
          return text.includes("<urlset") || text.includes("<sitemapindex");
        } catch { return false; }
      }),
    ]);
    const bookingLandingHtml = bookingLandingResult.html;
    const fullSiteText = `${loweredHtml} ${subpageText}`;
    const deepSurface = `${loweredHtml} ${bookingLandingHtml} ${subpageText}`;

    // --- AI-powered content evaluation (single Gemini call for 9 content checks) ---
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
    const aiContentPromise = geminiApiKey
      ? measure("aiContentEval", () => evaluateContentWithAI(fullSiteText, geminiApiKey))
      : Promise.resolve(null);

    // Re-evaluate content checks with subpage context (regex fallback).
    const deepKeywordContains = (parts: string[]) => parts.some((part) => fullSiteText.includes(part));
    const regexRvHookupFound = deepKeywordContains(["30 amp", "50 amp", "full hookup", "full hook-up", "water/electric", "sewer"]);
    const regexPetPolicyFound = hrefContains(["/pets", "/pet-policy", "/pet"]) || deepKeywordContains(["pet policy", "dogs welcome", "pets welcome", "no pets", "pet-friendly", "pet friendly", "pets allowed", "pets are not", "dog park", "dog wash", "dog run", "pet area", "pet station", "bark park", "dog friendly", "leash", "pet fee"]);
    const regexNoPetsPolicy = deepKeywordContains(["no pets", "pets are not allowed", "pets are not permitted", "no dogs"]) && !deepKeywordContains(["pets welcome", "dogs welcome", "pet-friendly", "pet friendly"]);
    const regexCancellationFound = deepKeywordContains(["cancellation", "cancelation", "refund policy", "no refund", "non-refundable", "nonrefundable", "cancel your reservation", "cancel reservation", "cancel booking"]) || hrefContains(["/cancel", "/cancellation", "/refund"]);
    const amenitiesFound = hrefContains(["/amenities", "/activities", "/recreation"]) || deepKeywordContains(["amenities", "activities", "recreation", "pool", "playground"]);
    const regexAccessibilityFound = hrefContains(["/accessibility"]) || deepKeywordContains(["accessibility statement", "accessibility"]);

    // Wait for AI content evaluation to complete.
    const aiContent = await aiContentPromise;

    // Merge AI results with regex fallbacks — AI wins when available, regex is backup.
    const petPolicyFound = aiContent?.petPolicy?.found ?? regexPetPolicyFound;
    const noPetsPolicy = aiContent?.petPolicy?.noPets ?? regexNoPetsPolicy;
    const cancellationFound = aiContent?.cancellationPolicy?.found ?? regexCancellationFound;
    const rvHookupFound = aiContent?.rvHookupSpecs?.found ?? regexRvHookupFound;
    const accessibilityFound = aiContent?.accessibilityStatement?.found ?? regexAccessibilityFound;
    const aiHumanContent = aiContent?.humanWrittenContent ?? null;

    // Copyright year freshness — detect outdated footer copyright.
    const currentYear = new Date().getFullYear();
    const copyrightMatches = html.match(/(?:©|&copy;|copyright)[\s®™(c)]*?(\d{4})/gi) ?? [];
    const copyrightYears = copyrightMatches.map((m) => parseInt(m.match(/(\d{4})/)![1], 10)).filter((y) => y >= 2000 && y <= currentYear);
    const latestCopyrightYear = copyrightYears.length > 0 ? Math.max(...copyrightYears) : null;

    // Professional email detection (informational — never penalizes).
    const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
    const personalEmailDomains = ["gmail.com", "yahoo.com", "hotmail.com", "aol.com", "outlook.com", "icloud.com", "me.com", "live.com", "msn.com", "verizon.net", "comcast.net", "att.net", "sbcglobal.net", "bellsouth.net", "charter.net", "cox.net", "earthlink.net", "juno.com", "protonmail.com", "mail.com", "ymail.com", "rocketmail.com", "frontier.com", "windstream.net"];
    const siteEmails = emailMatches.filter((em) => !personalEmailDomains.some((d) => em.toLowerCase().endsWith(`@${d}`)));
    const personalEmails = emailMatches.filter((em) => personalEmailDomains.some((d) => em.toLowerCase().endsWith(`@${d}`)));
    const hasBrandedEmail = siteEmails.length > 0;
    const foundPersonalDomain = personalEmails.length > 0 ? personalEmails[0]!.split("@")[1] : null;

    let accessibilityScore: number | null = null;
    let mobileTrafficPercent: number | null = null;
    if (pageSpeedResult && pageSpeedResult.score !== null) {
      pageSpeedScore = pageSpeedResult.score;
      accessibilityScore = pageSpeedResult.accessibilityScore ?? null;
      mobileTrafficPercent = pageSpeedResult.mobileTrafficPercent ?? null;
      pageSpeedStatus = pageSpeedScore >= 60 ? "pass" : "fail";
      pageSpeedFinding =
        pageSpeedStatus === "pass"
          ? "Your site is loading at a healthy speed on phones."
          : "Your site is loading slower than it should on phones.";
      pageSpeedDetails =
        pageSpeedStatus === "pass"
          ? "Your online experience is loading fast enough for most mobile shoppers."
          : "A slow mobile experience is one of the fastest ways to lose high-intent guests.";
    } else if (pageSpeedApiKey) {
      accessibilityScore = pageSpeedResult?.accessibilityScore ?? null;
      mobileTrafficPercent = pageSpeedResult?.mobileTrafficPercent ?? null;
      pageSpeedStatus = "fail";
      pageSpeedFinding = "Phone loading speed could not be confirmed — treating as needs improvement.";
      pageSpeedDetails = pageSpeedResult?.error ?? "Google couldn't return a speed score for this site. This usually means the site is too slow to test.";
    }

    const responseTimeStatus: CheckStatus = responseTimeMs < 3000
      ? "pass"
      : "fail";
    const responseTimeFinding = `Your server responded in ${responseTimeMs}ms.`;
    const responseTimeDetails = responseTimeMs < 3000
      ? "Response time is healthy — your site starts loading quickly."
      : "Your site is taking too long to start loading. Most visitors leave if they wait more than a couple seconds.";
    const mobileViewportStatus: CheckStatus = !hasViewport
      ? "fail"
      : "pass";
    const reviewCount = placesSignals?.reviewCount ?? websiteReviewCount;
    const hasGoogleBusinessPresence = Boolean(mapLink || hasEmbeddedMap || placesSignals?.matched);
    const humanContentSignal = evaluateHumanWrittenContent(html);

    // Outdated technology detection.
    const outdatedSignals: string[] = [];
    if (/jquery[\/.-]?1\./i.test(html)) outdatedSignals.push("jQuery 1.x");
    if (/bootstrap[\/.-]?[23]\./i.test(html) && !/bootstrap[\/.-]?[4-9]\./i.test(html)) outdatedSignals.push("Bootstrap 2 or 3");
    const wpGeneratorMatch = html.match(/<meta[^>]*name=["']generator["'][^>]*content=["']WordPress\s+([0-9.]+)["']/i);
    if (wpGeneratorMatch) {
      const wpVersion = parseFloat(wpGeneratorMatch[1]!);
      if (wpVersion > 0 && wpVersion < 5.0) outdatedSignals.push(`WordPress ${wpGeneratorMatch[1]}`);
    }
    if (/<!--\s*Starter Template for Bootstrap\s*-->|<!--\s*HTML5shiv|<!--\[if lt IE/i.test(html)) outdatedSignals.push("IE-era HTML patterns");
    if (/<table[^>]*(?:width|cellpadding|cellspacing|bgcolor)=/i.test(html) && !/<table[^>]*role=["']presentation["']/i.test(html)) {
      const tableLayoutCount = (html.match(/<table[^>]*(?:width|cellpadding|cellspacing|bgcolor)=/gi) || []).length;
      if (tableLayoutCount >= 2) outdatedSignals.push("table-based layout");
    }
    if (/font-family:\s*(?:Times New Roman|Comic Sans|Papyrus)/i.test(html)) outdatedSignals.push("outdated fonts");
    if (/<marquee|<blink|<center>/i.test(html)) outdatedSignals.push("deprecated HTML tags");
    const outdatedTechCount = outdatedSignals.length;

    const photoWeight = industry === "glamping" ? 2 : 1;
    const socialWeight = industry === "glamping" ? 2 : 1;
    const rvWeight = industry === "campground" ? 2 : 1;

    // Booking Psychology Signals
    const phoneInHeader = phoneMatch !== null;
    const hasEmailLink = /href=["']mailto:/i.test(html);
    const hasBookingForm = /<form[\s\S]*?<\/form>/i.test(html) || /checkout|booking|reservation/i.test(html);
    const hasLiveChat = /tidio|intercom|drift|crisp|livechat|zendesk|olark/i.test(html);
    const contactFrictionScore = [phoneInHeader, hasEmailLink, hasBookingForm, hasLiveChat].filter(Boolean).length;

    const pricesVisible = ratesFound || /\$[0-9]|from \$|starting at|per night|nightly/i.test(html);
    const rateTransparency = pricesVisible ? "pass" : "fail";

    const seasonalKeywords = ["early bird", "off-season", "shoulder season", "group rate", "weekly discount", "monthly rate", "special offer", "promo"];
    const hasSeasonalPromo = seasonalKeywords.some((keyword) => loweredHtml.includes(keyword));


    const trackingPixels = Array.from(new Set([
      ...homepageTrackingPixels,
      ...detectTrackingPixels(bookingLandingHtml),
    ]));
    const scannedHostNormalized = websiteUrl.hostname.replace(/^www\./i, "").toLowerCase();
    const canonicalHostNormalized = canonicalUrl?.hostname.replace(/^www\./i, "").toLowerCase() ?? null;
    const canonicalRedirectHealthy = redirectedToHttps && Boolean(
      canonicalUrl &&
      canonicalUrl.protocol === "https:" &&
      // Accept www vs non-www match (both point to the same property).
      (canonicalHostNormalized === scannedHostNormalized ||
       canonicalHostNormalized === scannedHostNormalized.replace(/^www\./, "") ||
       `www.${canonicalHostNormalized}` === scannedHostNormalized),
    );
    // If SSL timed out or HTTP redirect timed out, those signals are unknown — not false.
    const sslConfirmedValid = sslData.valid;
    const sslTimedOut = sslData.timedOut === true;
    const securitySignals = [sslConfirmedValid, redirectedToHttps, canonicalRedirectHealthy].filter(Boolean).length;
    const trustStackScore = [sslConfirmedValid || sslTimedOut, redirectedToHttps || httpRedirectUnknown, cancellationFound, onsiteGuestProofVisible].filter(Boolean).length;
    const regexMaxLengthInfo = /max(?:imum)?\s*(?:rv|rig|vehicle)?\s*length|up to\s*\d{2,3}\s*(?:ft|feet)|\d{2,3}\s*(?:ft|feet)\s*(?:max|maximum)|rig\s*length/i.test(deepSurface);
    const regexSiteTypeInfo = /pull[ -]?through|pullthrough|back[ -]?in|backin/i.test(deepSurface);
    const regexArrivalSection = hrefContains(["/directions", "/getting-here", "/arrival"]) || deepKeywordContains(["directions", "getting here", "arrival instructions", "how to get here"]);
    const regexGpsPitfallWarning = /low\s*clearance|bridge\s*clearance|avoid\s+.*road|do not use\s+gps|use\s+main\s+entrance|truck\s*route|rv\s*route/i.test(fullSiteText);
    const regexCheckInOutTimes = /check[ -]?in\s*(?:time|:|\bat\b|begins|starts|is)\s*\d|check[ -]?out\s*(?:time|:|\bat\b|by|is)\s*\d|\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.)\s*check[ -]?in|\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.)\s*check[ -]?out|check[ -]?in.*\d{1,2}.*check[ -]?out.*\d{1,2}/i.test(fullSiteText);
    const regexParkMap = hrefContains(["/map", "/park-map", "/campground-map", "/site-map", "/property-map"]) || deepKeywordContains(["park map", "campground map", "site map", "property map", "resort map"]);

    // Merge AI results with regex fallbacks for remaining content checks.
    const hasMaxLengthInfo = aiContent?.bigRigReadiness?.maxLength ?? regexMaxLengthInfo;
    const hasSiteTypeInfo = aiContent?.bigRigReadiness?.siteType ?? regexSiteTypeInfo;
    const hasArrivalSection = aiContent?.arrivalDirections?.found ?? regexArrivalSection;
    const gpsPitfallWarning = aiContent?.arrivalDirections?.gpsWarning ?? regexGpsPitfallWarning;
    const hasCheckInOutTimes = aiContent?.checkinCheckoutTimes?.found ?? regexCheckInOutTimes;
    const hasParkMap = aiContent?.parkMap?.found ?? regexParkMap;

    const checks: Check[] = [
      createCheck({
        id: "technical-trust-security",
        name: "Technical trust & security",
        category: "Does Your Website Work?",
        status: (sslTimedOut || httpRedirectUnknown)
          // If we couldn't reach the server to check SSL, give benefit of the doubt — the site loaded over HTTPS.
          ? "pass"
          : !sslConfirmedValid || !redirectedToHttps
            ? "fail"
            : canonicalUrl && !canonicalRedirectHealthy
              ? "fail"
              // No canonical tag but SSL + redirect are good = pass.
              : "pass",
        finding: (sslTimedOut || httpRedirectUnknown)
          ? "SSL and HTTPS appear to be working (site loaded securely)."
          : `${securitySignals} of 3 trust-and-security signals detected (SSL, HTTPS redirect, canonical alignment).`,
        details: (sslTimedOut || httpRedirectUnknown)
          ? "Your site loaded over HTTPS, which means SSL is working. The redirect check was slow but no security issues were detected."
          : !sslConfirmedValid || !redirectedToHttps
            ? "Your site is missing basic security. Browsers will show a warning to visitors, and most will leave immediately. Get SSL enabled and force HTTPS."
            : canonicalUrl && !canonicalRedirectHealthy
              ? `Your canonical URL (${canonicalUrl.toString()}) doesn't match your secure address. This confuses Google and can split your search traffic.`
              : "Security and URL setup look good.",
        effort: "Low",
        impact: "High",
        serviceKey: "ssl",
      }),
      createCheck({
        id: "response-time",
        name: "Server response time",
        category: "Does Your Website Work?",
        status: responseTimeStatus,
        finding: responseTimeFinding,
        details: responseTimeDetails,
        effort: "Medium",
        impact: "High",
        serviceKey: "pagespeed",
      }),
      createCheck({
        id: "broken-links",
        name: "Broken links",
        category: "Does Your Website Work?",
        status: brokenCount === 0 ? "pass" : "fail",
        finding:
          brokenCount === 0
            ? "No broken links found on your homepage."
            : `${brokenCount} broken link${brokenCount > 1 ? "s" : ""} found on your homepage.`,
        details:
          brokenCount === 0
            ? "All tested links are working."
            : "Broken links make your site feel abandoned — like a pothole in your driveway. Fix or remove them.",
        effort: "Medium",
        impact: "Medium",
        serviceKey: "pagespeed",
      }),
      createCheck({
        id: "pagespeed-mobile",
        name: "Phone loading speed",
        category: "Does Your Website Work?",
        status: pageSpeedStatus,
        finding: pageSpeedFinding,
        details: pageSpeedDetails,
        effort: "Medium",
        impact: "High",
        serviceKey: "pagespeed",
      }),
      createCheck({
        id: "human-written-content",
        name: "Human-written content",
        category: "Does Your Website Work?",
        status: aiHumanContent
          ? (aiHumanContent.appearsHuman ? "pass" : "fail")
          : humanContentSignal.status,
        finding: aiHumanContent
          ? (aiHumanContent.appearsHuman
              ? `Content appears human-written. ${aiHumanContent.summary}`
              : `Content appears heavily templated or AI-generated. ${aiHumanContent.summary}`)
          : humanContentSignal.finding,
        details: aiHumanContent
          ? (aiHumanContent.appearsHuman
              ? "The writing tone looks natural and trustworthy for guests comparing multiple parks."
              : "The copy sounds generic and repetitive. Add real details about your property — what makes your park different from the one down the road?")
          : humanContentSignal.details,
        effort: "Medium",
        impact: "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "website-technology",
        name: "Website technology",
        category: "Does Your Website Work?",
        status: outdatedTechCount === 0 ? "pass" : "fail",
        finding: outdatedTechCount === 0
          ? "No outdated website technology detected."
          : `Outdated technology detected: ${outdatedSignals.join(", ")}.`,
        details: outdatedTechCount === 0
          ? "Your site is built on modern technology that supports fast loading and mobile-friendly design."
          : outdatedTechCount >= 2
            ? "Your website is built on technology that's years out of date. This typically causes slow loading, broken layouts on phones, and security risks. A site this outdated usually needs a rebuild rather than a patch."
            : "Your site has some older technology that could cause issues with speed or mobile display. It may be worth reviewing with a web professional.",
        effort: "High",
        impact: "High",
        serviceKey: "website_rebuild",
      }),
      createCheck({
        id: "copyright-freshness",
        name: "Copyright year",
        category: "Does Your Website Work?",
        status: latestCopyrightYear === null ? "fail" : latestCopyrightYear >= currentYear - 1 ? "pass" : "fail",
        finding: latestCopyrightYear === null
          ? "No copyright year found on the page."
          : latestCopyrightYear >= currentYear - 1
            ? `Copyright year is current (${latestCopyrightYear}).`
            : `Copyright year is ${latestCopyrightYear} — ${currentYear - latestCopyrightYear} years out of date.`,
        details: latestCopyrightYear === null
          ? "A visible copyright year signals your site is actively maintained. Without one, guests may wonder if the park is still operating."
          : latestCopyrightYear >= currentYear - 1
            ? "Your footer shows a current year, signaling the site is actively maintained."
            : "When a guest sees an old copyright year, their first thought is 'Is this place still open?' It takes 30 seconds to update and makes a real difference in first impressions.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "website_rebuild",
      }),
      createCheck({
        id: "booking-platform",
        name: "Online booking system",
        category: "Can Guests Book Online?",
        status: detectedPlatform || hasInlineBookingForm || hasExternalBookingLink ? "pass" : "fail",
        finding: detectedPlatform
          ? `Detected ${detectedPlatform}.`
          : hasInlineBookingForm
            ? "A booking widget was found on your homepage."
            : hasExternalBookingLink
              ? "Online booking link found (external reservation system)."
              : "No online booking system found.",
        details: detectedPlatform || hasInlineBookingForm || hasExternalBookingLink
          ? "Guests can reserve online. That's table stakes in 2026."
          : "Guests want to book at 10pm on a Sunday when you're not by the phone. Without online booking, those reservations go to a competitor who has one.",
        effort: "High",
        impact: "High",
        serviceKey: "booking_cta",
      }),
      createCheck({
        id: "booking-cta",
        name: "Book Now button",
        category: "Can Guests Book Online?",
        status: bookingCallToAction ? "pass" : "fail",
        finding: bookingCallToAction
          ? "'Book Now' or similar button found."
          : "No clear 'Book Now' button found.",
        details: bookingCallToAction
          ? "Guests can quickly find where to reserve."
          : "Your website needs a big, obvious 'Book Now' button. If visitors can't find it in 3 seconds, they'll go to a park where it's easier.",
        effort: "Low",
        impact: "High",
        serviceKey: "booking_cta",
      }),
      createCheck({
        id: "date-picker-discoverability",
        name: "Date picker visibility",
        category: "Can Guests Book Online?",
        status: hasDateSignalsOnHomepage ? "pass" : "fail",
        finding: hasDateSignalsOnHomepage
          ? "Date or availability selection found on the homepage."
          : "No date picker found on the homepage.",
        details: hasDateSignalsOnHomepage
          ? "Guests can start checking dates right away."
          : "Put a 'Check Availability' box or date picker near the top of your homepage. The first thing guests want to know is whether you have space on their dates.",
        effort: "Low",
        impact: "High",
        serviceKey: "booking_cta",
      }),

      createCheck({
        id: "tracking-pixels",
        name: "Ad retargeting setup",
        category: "Can Guests Book Online?",
        status: trackingPixels.length > 0 ? "pass" : "fail",
        finding:
          trackingPixels.length > 0
            ? `Found ${trackingPixels.join(" and ")}.`
            : "No Facebook Pixel or Google Tag Manager found.",
        details:
          trackingPixels.length > 0
            ? "You can show ads to people who visited but didn't book."
            : "Right now, visitors leave your site and you have no way to remind them to come back. Install Facebook Pixel or Google Tag Manager so you can retarget them.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "tracking_pixels",
      }),
      createCheck({
        id: "pet-policy",
        name: "Pet policy",
        category: "What Info Are You Missing?",
        status: petPolicyFound ? "pass" : "fail",
        finding: petPolicyFound
          ? noPetsPolicy
            ? "Pet policy found — your property does not allow pets."
            : "Pet policy found — pets appear to be welcome."
          : "No pet policy found on the website.",
        details:
          petPolicyFound
            ? noPetsPolicy
              ? "Clear 'no pets' policy helps avoid awkward conversations at check-in. Make sure it's easy to find."
              : "Pet owners can see they're welcome before booking."
            : "40% of RV travelers bring their dog. If you allow pets, say so clearly. If not, say that too — it saves everyone time.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "rv-hookup-specs",
        name: "RV hookup details",
        category: "What Info Are You Missing?",
        status: rvHookupFound ? "pass" : "fail",
        finding: rvHookupFound
          ? "Hookup specifications found (amps, sewer, water, etc.)."
          : "No hookup specifications found.",
        details:
          rvHookupFound
            ? "RV guests can check if your sites fit their rig before booking."
            : "RV travelers need to see 30 amp, 50 amp, full hookup details. Without this, they call — or just book somewhere that lists it.",
        weight: rvWeight,
        effort: "Low",
        impact: industry === "campground" ? "High" : "Low",
        serviceKey: "default",
      }),
      createCheck({
        id: "big-rig-readiness",
        name: "Big rig info",
        category: "What Info Are You Missing?",
        status: hasMaxLengthInfo || hasSiteTypeInfo ? "pass" : "fail",
        finding: hasMaxLengthInfo || hasSiteTypeInfo
          ? `Big-rig details found: ${[hasMaxLengthInfo ? "max length" : null, hasSiteTypeInfo ? "pull-through/back-in" : null].filter(Boolean).join(" and ")}.`
          : "No big-rig details found (max length or pull-through/back-in).",
        details: hasMaxLengthInfo || hasSiteTypeInfo
          ? "Class A motorhome owners can check if they'll fit before making the trip."
          : "Post your max rig length and whether you have pull-through sites. Big-rig guests won't gamble on fitting.",
        effort: "Low",
        impact: industry === "campground" ? "High" : "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "arrival-directions-clarity",
        name: "Arrival directions",
        category: "What Info Are You Missing?",
        status: hasArrivalSection ? "pass" : "fail",
        finding: hasArrivalSection
          ? gpsPitfallWarning
            ? "Arrival directions found with GPS/route warnings — great detail."
            : "Arrival directions found on your site."
          : "No arrival directions found on the website.",
        details: hasArrivalSection
          ? gpsPitfallWarning
            ? "Guests are less likely to get lost or arrive frustrated."
            : "Guests can find how to get to you. Consider adding GPS warnings or RV-safe route tips if your location is tricky to find."
          : "Add a 'Getting Here' page with your entrance location, GPS tips, and any route warnings. Bad directions cause terrible first impressions.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "amenities-page",
        name: "Amenities listed",
        category: "What Info Are You Missing?",
        status: amenitiesFound ? "pass" : "fail",
        finding: amenitiesFound
          ? "Amenities or activities content found."
          : "No amenities or activities content found.",
        details:
          amenitiesFound
            ? "Guests can see what the stay includes."
            : "If guests can't see what you offer (pool, playground, store, laundry), they can't decide if your price is worth it. List your amenities clearly.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "photos",
      }),
      createCheck({
        id: "park-map",
        name: "Park map",
        category: "What Info Are You Missing?",
        status: hasParkMap ? "pass" : "fail",
        finding: hasParkMap
          ? "A park or property map is available on your site."
          : "No park map found on the website.",
        details: hasParkMap
          ? "Guests can see the layout before they arrive — that helps them pick the right site and reduces confusion on check-in day."
          : "Guests want to see where they'll be staying. A simple map showing site locations, amenities, and key landmarks helps them choose the right spot and feel confident booking.",
        effort: "Medium",
        impact: "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "cancellation-policy",
        name: "Cancellation policy",
        category: "What Info Are You Missing?",
        status: cancellationFound ? "pass" : "fail",
        finding: cancellationFound
          ? "Cancellation or refund policy found."
          : "No cancellation policy found.",
        details:
          cancellationFound
            ? "Guests can understand the rules before committing money."
            : "Families book months ahead and worry about 'what if something comes up.' A clear cancellation policy often tips someone from 'thinking about it' to clicking 'Reserve.'",
        effort: "Low",
        impact: "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "checkin-checkout-times",
        name: "Check-in / check-out times",
        category: "What Info Are You Missing?",
        status: hasCheckInOutTimes ? "pass" : "fail",
        finding: hasCheckInOutTimes
          ? "Check-in and check-out times are posted."
          : "No check-in or check-out times found.",
        details: hasCheckInOutTimes
          ? "Guests know when they can arrive and when they need to leave — that prevents confusion and phone calls."
          : "Guests planning a trip need to know when they can arrive and when they need to leave. Post your check-in and check-out times clearly on your site. This prevents phone calls and avoids guests showing up before their site is ready.",
        effort: "Low",
        impact: "Low",
        serviceKey: "default",
      }),
      createCheck({
        id: "accessibility-statement",
        name: "Accessibility info",
        category: "What Info Are You Missing?",
        status: accessibilityFound ? "pass" : "fail",
        finding: accessibilityFound
          ? "Accessibility information found."
          : "No accessibility statement found.",
        details:
          accessibilityFound
            ? "Guests with mobility needs can plan their visit with confidence."
            : "Guests with limited mobility — or those traveling with elderly family — need to know what to expect. A simple statement shows you've thought about their needs.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "meta-title",
        name: "Google page title",
        category: "Can Guests Find You?",
        status: title.length > 0 ? "pass" : "fail",
        finding: title ? `Title found: "${title.length > 60 ? title.slice(0, 57) + "..." : title}"` : "Page title is missing.",
        details:
          title.length > 0
            ? "This shows up as the headline in Google search results."
            : "Without a title, Google shows a generic heading for your site. Set a clear title like 'Pine Ridge Campground | Full Hookups Near Lake George.'",
        effort: "Low",
        impact: "Medium",
        serviceKey: "meta_tags",
      }),
      createCheck({
        id: "meta-description",
        name: "Google search preview",
        category: "Can Guests Find You?",
        status: description.length > 0 ? "pass" : "fail",
        finding: description
          ? `Preview text found (${description.length} characters).`
          : "Search preview text is missing.",
        details:
          description.length > 0
            ? "Google has a preview description to show searchers."
            : "This is the 2-sentence preview beneath your Google listing. Without it, Google grabs random text from your page — usually something unhelpful.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "meta_tags",
      }),
      createCheck({
        id: "gbp-sync",
        name: "Google Business Profile",
        category: "Can Guests Find You?",
        status: hasGoogleBusinessPresence ? "pass" : "fail",
        finding: !hasGoogleBusinessPresence
          ? "No Google Business Profile signal found."
          : reviewCount !== null && reviewCount < 15
            ? `Google Business Profile found with ${reviewCount} reviews — aim for 15+ to build trust.`
            : "Google Business Profile looks active.",
        details: hasGoogleBusinessPresence
          ? reviewCount !== null && reviewCount < 15
            ? "Your Google listing is visible. Keep asking happy guests to leave reviews — 15+ makes a real difference."
            : "Your Google listing is visible and has enough reviews to build trust."
          : "When someone Googles 'campground near me,' Google shows a map with photos, hours, and reviews. If your profile is missing or weak, you simply won't appear.",
        effort: "Low",
        impact: "High",
        serviceKey: "google_business",
      }),
      createCheck({
        id: "local-review-competitiveness",
        name: "Review strength",
        category: "Can Guests Find You?",
        status: reviewCount === null
          ? "pass"
          : placesSignals != null && placesSignals.recentReviews30d != null && placesSignals.ownerResponseRate30d != null && placesSignals.recentReviews30d >= 3 && placesSignals.ownerResponseRate30d === 0
            ? "fail"
            : reviewCount >= 20
              ? "pass"
              : "fail",
        finding: reviewCount === null
          ? "Review count could not be read — not penalizing."
          : placesSignals != null && placesSignals.recentReviews30d != null && placesSignals.ownerResponses30d != null && placesSignals.ownerResponseRate30d != null
            ? `${reviewCount} total reviews. ${placesSignals.recentReviews30d} in the last 30 days, ${placesSignals.ownerResponseRate30d}% responded to by you.`
          : `About ${reviewCount} Google reviews. Target: 40+ for strong local competitiveness.`,
        details: reviewCount === null
          ? "We couldn't pull your review count from Google on this scan. Check your Google Business Profile directly."
          : placesSignals != null && placesSignals.ownerResponseRate30d != null && placesSignals.ownerResponseRate30d === 0 && (placesSignals.recentReviews30d ?? 0) > 0
            ? "You have recent reviews that haven't been responded to. Google rewards parks that respond to reviews — it improves your ranking and shows guests you care."
            : reviewCount >= 40
              ? "Your review volume is competitive. Keep asking happy guests to leave reviews."
              : "Ask every happy guest to leave a Google review. Even a simple 'We'd love a review!' card at checkout makes a difference.",
        effort: "Medium",
        impact: "High",
        serviceKey: "google_business",
      }),
      createCheck({
        id: "social-presence",
        name: "Social media",
        category: "Can Guests Find You?",
        status: facebookLink || instagramLink ? "pass" : "fail",
        finding:
          facebookLink || instagramLink
            ? `Found ${[facebookLink ? "Facebook" : null, instagramLink ? "Instagram" : null].filter(Boolean).join(" and ")} links on your site.`
            : "No Facebook or Instagram links found.",
        details:
          facebookLink || instagramLink
            ? "Guests can find you on social media and see that you're active."
            : "Most guests check Facebook or Instagram before booking. A connected social page shows you're real, responsive, and worth the visit.",
        weight: socialWeight,
        effort: "Low",
        impact: industry === "glamping" ? "High" : "Low",
        serviceKey: "social",
      }),
      createCheck({
        id: "structured-data",
        name: "Rich search data",
        category: "Can Guests Find You?",
        status: structuredDataScore >= 2 ? "pass" : "fail",
        finding: structuredDataScore >= 2
          ? `${structuredDataScore} of 3 structured data signals found.`
          : structuredDataScore === 1
            ? "Only 1 of 3 structured data signals found — not enough for rich search results."
            : "No structured data found.",
        details: structuredDataScore >= 2
          ? "Google can show your star rating, price range, and business type directly in search results."
          : "Ask your web person to add 'JSON-LD structured data' for your business. It tells Google to show star ratings and price ranges right in the search results — free extra visibility.",
        effort: "Medium",
        impact: "High",
        serviceKey: "meta_tags",
      }),
      createCheck({
        id: "sitemap-presence",
        name: "XML sitemap",
        category: "Can Guests Find You?",
        status: sitemapReachable ? "pass" : "fail",
        finding: sitemapReachable
          ? "XML sitemap found at /sitemap.xml."
          : "No XML sitemap found.",
        details: sitemapReachable
          ? "Search engines can efficiently crawl and index all your pages."
          : "Without a sitemap, Google has to discover your pages by following links — and it often misses important ones like your rates page or amenities. Most website platforms can generate one automatically.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "meta_tags",
      }),
      createCheck({
        id: "mobile-viewport",
        name: "Phone layout",
        category: "Are You Losing Guests?",
        status: mobileViewportStatus,
        finding: !hasViewport
          ? "Your site is missing phone layout settings."
          : "Phone layout settings detected.",
        details:
          !hasViewport
            ? "Without this, your site shows up tiny and zoomed out on smartphones — text too small to read, buttons too small to tap. Most phone visitors will leave immediately."
            : "Your site sends proper layout instructions to phones.",
        effort: "Low",
        impact: "High",
        serviceKey: "mobile",
      }),
      createCheck({
        id: "phone-conversion-readiness",
        name: "Phone call setup",
        category: "Are You Losing Guests?",
        status: [Boolean(phoneMatch), hasClickableHeaderPhone, callIntentSignal].filter(Boolean).length >= 2 ? "pass" : "fail",
        finding: `${[Boolean(phoneMatch), hasClickableHeaderPhone, callIntentSignal].filter(Boolean).length} of 3 phone-call signals found.`,
        details: [Boolean(phoneMatch), hasClickableHeaderPhone, callIntentSignal].filter(Boolean).length >= 2
          ? "Guests who prefer calling can reach you easily."
          : "Put a tap-to-call phone number at the top of your page. Many guests — especially older ones — want to call. Make it one tap to connect.",
        effort: "Low",
        impact: "High",
        serviceKey: "mobile",
      }),
      createCheck({
        id: "accessibility-score",
        name: "Accessibility score",
        category: "Are You Losing Guests?",
        status: accessibilityScore === null ? "pass" : accessibilityScore >= 70 ? "pass" : "fail",
        finding: accessibilityScore !== null
          ? `Accessibility score: ${accessibilityScore}/100.`
          : "Accessibility score not available — not penalizing.",
        details: accessibilityScore === null
          ? "Google couldn't return an accessibility score on this run. This isn't a problem with your site."
          : accessibilityScore >= 70
            ? "Your site works well for guests using screen readers and assistive devices."
            : "Guests with disabilities may struggle to use your site. Common fixes: better color contrast, descriptive image labels, and proper heading structure.",
        effort: "Medium",
        impact: "Medium",
        serviceKey: "mobile",
      }),
      createCheck({
        id: "photo-gallery-quality",
        name: "Photo gallery",
        category: "Are You Losing Guests?",
        status: highQualityImageCount >= 6 ? "pass" : "fail",
        finding: highQualityImageCount >= 6
          ? `${highQualityImageCount} quality images found on your site.`
          : highQualityImageCount > 0
            ? `Only ${highQualityImageCount} quality image${highQualityImageCount > 1 ? "s" : ""} found — aim for 6+.`
            : "No quality images found on your homepage.",
        details: highQualityImageCount >= 6
          ? "Guests can see what the experience looks like before booking. Good photos sell the stay."
          : "Guests are buying an experience they've never seen. Parks with 6+ quality photos convert significantly better than those with just a logo and a stock image. Show your best sites, amenities, and scenery.",
        effort: "Medium",
        impact: industry === "glamping" ? "High" : "Medium",
        serviceKey: "photos",
      }),
      createCheck({
        id: "rate-transparency",
        name: "Pricing visible",
        category: "Are You Losing Guests?",
        status: rateTransparency as CheckStatus,
        finding: pricesVisible ? "Pricing is visible on your site." : "No clear pricing found.",
        details: pricesVisible
          ? "Guests can see if they can afford you before investing time in the booking process."
          : "Hidden pricing forces guests to call or fill out a form just to find out if they can afford your park. Most will just leave. Show starting rates.",
        effort: "Low",
        impact: "High",
        serviceKey: "rate_page",
      }),
      createCheck({
        id: "contact-friction",
        name: "Contact options",
        category: "Are You Losing Guests?",
        status: contactFrictionScore >= 2 ? "pass" : "fail",
        finding: `${contactFrictionScore} of 4 contact methods found (phone, email, booking form, live chat).`,
        details:
          contactFrictionScore >= 2
            ? "Guests can reach you in multiple ways."
            : "Add a visible phone number, email link, and/or online form. Every missing option is a guest who wanted to reach you but couldn't.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "booking_cta",
      }),
      createCheck({
        id: "trust-stack-completeness",
        name: "Trust signals",
        category: "Are You Losing Guests?",
        status: trustStackScore >= 3 ? "pass" : "fail",
        finding: `${trustStackScore} of 4 trust signals found (secure site, HTTPS, cancellation policy, guest reviews).`,
        details: trustStackScore >= 3
          ? "Guests have enough trust cues to feel safe entering credit card info."
          : "Before someone gives you money online, they need to trust you. Make sure these are visible: secure padlock, cancellation policy, and real guest reviews.",
        effort: "Low",
        impact: "High",
        serviceKey: "booking_cta",
      }),
      createCheck({
        id: "professional-email",
        name: "Business email",
        category: "Are You Losing Guests?",
        status: "pass",
        finding: hasBrandedEmail
          ? "A branded business email is visible on your site."
          : foundPersonalDomain
            ? `A personal email (${foundPersonalDomain}) was found. Consider adding a branded one like info@yourpark.com.`
            : "No email address found on your site to evaluate.",
        details: hasBrandedEmail
          ? "A branded email builds trust — guests know they're contacting a real business."
          : foundPersonalDomain
            ? "A branded email like info@yourpark.com costs a few dollars a month and instantly looks more professional. Not penalizing — just a tip."
            : "Consider adding a visible email address so guests can reach you.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "seasonal-visibility",
        name: "Seasonal deals",
        category: "Are You Losing Guests?",
        status: hasSeasonalPromo ? "pass" : "fail",
        finding: hasSeasonalPromo ? "Seasonal offers or deals found." : "No seasonal offers or deals found.",
        details: hasSeasonalPromo
          ? "Off-season deals and early-bird pricing help fill slow periods."
          : "Add early-bird discounts, off-season rates, or weekly/monthly specials. These drive bookings during your slowest months when you need them most.",
        effort: "Medium",
        impact: "Medium",
        serviceKey: "rates",
      }),
    ];


    const categoryScores = (Object.keys(config.categoryWeights) as CheckCategory[]).map((category) => {
      const categoryChecks = checks.filter((check) => check.category === category);
      const totalWeight = categoryChecks.reduce((sum, check) => sum + check.weight, 0);
      const passedWeight = categoryChecks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0);
      const score = totalWeight === 0 ? 0 : Math.round((passedWeight / totalWeight) * 100);
      return {
        name: category,
        score,
        passed: passedWeight,
        total: totalWeight,
        categoryWeight: config.categoryWeights[category],
      };
    });

    const score = Math.round(
      categoryScores.reduce((sum, category) => sum + (category.score * category.categoryWeight) / 100, 0),
    );

    let lostBookingsEstimate = 0;
    const lostRevenueDrivers: string[] = [];
    if (responseTimeMs > 1800) {
      lostBookingsEstimate += 6;
      lostRevenueDrivers.push(`Your online experience is slower than ideal at ${responseTimeMs}ms.`);
    }
    if (!bookingCallToAction) {
      lostBookingsEstimate += 9;
      lostRevenueDrivers.push("Guests are not seeing a clear booking path.");
    }
    if (!hasViewport) {
      lostBookingsEstimate += 7;
      lostRevenueDrivers.push("Mobile visitors may be struggling with layout and zoom issues.");
    }
    if (trackingPixels.length === 0) {
      lostBookingsEstimate += 5;
      lostRevenueDrivers.push("You cannot retarget visitors who leave before booking.");
    }
    if (highQualityImageCount < 6) {
      lostBookingsEstimate += industry === "glamping" ? 8 : 4;
      lostRevenueDrivers.push("Your visual storytelling is not doing enough work to sell the stay.");
    }
    if (!ratesFound) {
      lostBookingsEstimate += 5;
      lostRevenueDrivers.push("Hidden pricing forces too many visitors to bounce before they inquire.");
    }
    if (lostBookingsEstimate === 0) {
      lostBookingsEstimate = score >= 80 ? 5 : 9;
      lostRevenueDrivers.push("A few smaller experience issues are still leaving money on the table.");
    }
    lostBookingsEstimate = Math.min(35, lostBookingsEstimate);

    const enrichedChecks = checks.map((check) => ({
      ...check,
      estimatedImpact: getEstimatedImpactForCheck(check),
      benchmark: getDifficultyForCheck(check),
    }));

    const topFails = checks
      .filter((check) => check.status === "fail")
      .sort((left, right) => {
        const impactScore = { Low: 1, Medium: 2, High: 3 };
        const effortScore = { Low: 1, Medium: 2, High: 3 };
        return impactScore[right.impact] - impactScore[left.impact] || effortScore[left.effort] - effortScore[right.effort];
      })
      .slice(0, 5)
      .map((check) => check.id);

    if (timingEnabled) {
      const totalMs = Math.round(performance.now() - scanStartedAt);
      console.info(
        "[scan-timing]",
        JSON.stringify({
          host: canonicalHost,
          totalMs,
          responseTimeMs,
          phaseTimings,
        }),
      );
    }

    return NextResponse.json({
      url: canonicalHost,
      pageSpeedReportUrl,
      accessibilityScore,
      mobileTrafficPercent,
      industry,
      industryLabel: config.label,
      unitLabel: config.unitLabel,
      score,
      status: statusFromScore(score),
      detectedPlatform,
      lostBookingsEstimate,
      lostRevenueDrivers,
      topFails,
      categories: categoryScores,
      checks: enrichedChecks,
    });
  } catch (error) {
    const message = normalizeScanError(error);
    return NextResponse.json({ message }, { status: 500 });
  }
}
