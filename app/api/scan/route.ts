import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type IndustryKey = "campground" | "marina" | "glamping" | "cabins";
type CheckCategory =
  | "Would a Guest Book Here?"
  | "Can a Guest Find Basic Info?"
  | "Will Google Send Guests?";

type CheckStatus = "pass" | "fail";

type Check = {
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
      "Would a Guest Book Here?": 40,
      "Can a Guest Find Basic Info?": 35,
      "Will Google Send Guests?": 25,
    },
  },
  marina: {
    label: "Marina",
    unitLabel: "slips",
    listingKeywords: ["dockwa", "marinas.com", "waterway guide", "snag-a-slip"],
    categoryWeights: {
      "Would a Guest Book Here?": 40,
      "Can a Guest Find Basic Info?": 35,
      "Will Google Send Guests?": 25,
    },
  },
  glamping: {
    label: "Glamping",
    unitLabel: "tents/domes",
    listingKeywords: ["hipcamp", "glamping hub", "canopy", "airbnb"],
    categoryWeights: {
      "Would a Guest Book Here?": 40,
      "Can a Guest Find Basic Info?": 35,
      "Will Google Send Guests?": 25,
    },
  },
  cabins: {
    label: "Cabins / Vacation Rentals",
    unitLabel: "units",
    listingKeywords: ["airbnb", "vrbo", "booking.com", "expedia"],
    categoryWeights: {
      "Would a Guest Book Here?": 40,
      "Can a Guest Find Basic Info?": 35,
      "Will Google Send Guests?": 25,
    },
  },
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
  "Roomstay",
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

const statusFromScore = (score: number): string => {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "F";
};

const fetchWithTimeout = async (
  url: string,
  optionsOrTimeout: RequestInit | number = 10000,
  maybeTimeoutMs?: number,
): Promise<Response> => {
  const options = typeof optionsOrTimeout === "number" ? {} : optionsOrTimeout;
  const timeoutMs = typeof optionsOrTimeout === "number" ? optionsOrTimeout : (maybeTimeoutMs ?? 10000);
  const normalizedHeaders = new Headers(options.headers ?? {});

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
  searchQuery: string,
  websiteDomain: string,
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
          textQuery: searchQuery,
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

    if (!places.length) return null;

    // Try website match first, then fall back to first result.
    const normalizedDomain = websiteDomain.toLowerCase();
    let subjectPlace = places.find((p) => {
      const h = hostFromWebsiteUri(p.websiteUri);
      return h && h.toLowerCase() === normalizedDomain;
    }) ?? places[0];

    if (!subjectPlace?.id) return null;

    const detailsResponse = await fetchWithTimeout(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(subjectPlace.id)}`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": normalizedApiKey,
          "X-Goog-FieldMask": "rating,userRatingCount,websiteUri,reviews.publishTime,reviews.reviewReply",
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
      websiteUri?: string;
      reviews?: Array<{
        publishTime?: string;
        rating?: number | "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
        text?: { text?: string } | string;
        reviewReply?: { text?: { text?: string } | string } | string;
      }>;
    };

    // Verify this is the right business using the details websiteUri (more reliable than search results).
    // Only reject if the details website is set AND points to a completely different domain.
    const detailsWebsiteHost = hostFromWebsiteUri(detailsPayload.websiteUri);
    if (detailsWebsiteHost && detailsWebsiteHost.toLowerCase() !== normalizedDomain) {
      return null;
    }

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

const createCheck = (input: {
  id: string;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  evidence: string;
  finding: string;
  details: string;
  steps: string[];
  weight: number;
  impact: "High" | "Medium" | "Low";
}): Check => ({
  ...input,
  pass: input.status === "pass",
});

export async function GET(request: NextRequest) {
  const requestedUrl = request.nextUrl.searchParams.get("url") ?? "";
  const normalizedHost = normalizeUrl(requestedUrl);
  const industry = getIndustry(request.nextUrl.searchParams.get("industry"));
  const validateOnly = request.nextUrl.searchParams.get("validateOnly") === "true";
  const bookingPlatform = request.nextUrl.searchParams.get("booking_platform") ?? "";
  const primaryChallenge = request.nextUrl.searchParams.get("primary_challenge") ?? "";
  const platformDisplayNames: Record<string, string> = {
    campspot: "Campspot",
    reserveamerica: "ReserveAmerica",
    hipcamp: "Hipcamp",
    lodgify: "Lodgify",
    "rezdy-fareharbor": "Rezdy/FareHarbor",
  };
  const config = industryConfig[industry];

  if (!normalizedHost) {
    return NextResponse.json({ message: "Please provide a valid URL." }, { status: 400 });
  }

  try {
    const canonicalHost = normalizedHost;
    let websiteUrl = new URL(`https://${canonicalHost}/`);
    const timingEnabled = process.env.SCAN_DEBUG_TIMING === "true";
    const phaseTimings: Record<string, number> = {};

    // Fetch HTML
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

    // Follow redirects
    try {
      const finalUrl = new URL(homeResponse.url);
      if (finalUrl.hostname !== websiteUrl.hostname) {
        websiteUrl = new URL(`${finalUrl.protocol}//${finalUrl.hostname}/`);
      }
    } catch {
      // homeResponse.url can be empty in some runtimes
    }

    // Start parallel: PageSpeed
    const pageSpeedApiKey = process.env.PAGESPEED_API_KEY?.trim();
    const placesApiKey = process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim() || "";

    const pageSpeedPromise = pageSpeedApiKey
      ? (async () => {
          try {
            const pageSpeedUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
            pageSpeedUrl.searchParams.set("url", websiteUrl.toString());
            pageSpeedUrl.searchParams.set("strategy", "mobile");
            pageSpeedUrl.searchParams.set("category", "performance");
            pageSpeedUrl.searchParams.set("key", pageSpeedApiKey);

            const pageSpeedResponse = await fetch(pageSpeedUrl.toString());
            const payload = (await pageSpeedResponse.json()) as {
              lighthouseResult?: {
                categories?: {
                  performance?: { score?: number };
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
              return { score: null, error: normalizedError.message };
            }

            const runtimeError = payload.lighthouseResult?.runtimeError?.message;
            const rawScore = payload.lighthouseResult?.categories?.performance?.score;
            const perfScore = typeof rawScore === "number" && !Number.isNaN(rawScore) ? Math.round(rawScore * 100) : null;

            if (perfScore !== null) {
              return { score: perfScore, error: null };
            }

            return {
              score: null,
              error: runtimeError
                ? `Lighthouse returned error: ${runtimeError}`
                : "PageSpeed API did not return a usable performance score.",
            };
          } catch {
            return { score: null, error: "PageSpeed check is taking longer than expected right now." };
          }
        })()
      : Promise.resolve(null);

    // Start with hostname as the Places search query  -  will refine after parsing
    let placesSearchQuery = websiteUrl.hostname.replace(/^www\./i, "").toLowerCase();

    // Parse HTML
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

    if (validateOnly) {
      return NextResponse.json({ ok: true, url: canonicalHost });
    }

    // Build text-only version for content checks
    const textOnly = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#?[a-z0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const loweredText = textOnly.toLowerCase();

    // --- Check helpers ---

    const findWithinDistance = (
      haystack: string,
      termsA: RegExp[],
      termsB: RegExp[],
      maxDistance: number,
    ): { found: boolean; snippet: string } => {
      const positionsA: number[] = [];
      for (const pattern of termsA) {
        const matches = haystack.matchAll(new RegExp(pattern.source, "gi"));
        for (const m of matches) {
          positionsA.push(m.index!);
        }
      }

      const positionsB: number[] = [];
      for (const pattern of termsB) {
        const matches = haystack.matchAll(new RegExp(pattern.source, "gi"));
        for (const m of matches) {
          positionsB.push(m.index!);
        }
      }

      for (const posA of positionsA) {
        for (const posB of positionsB) {
          if (Math.abs(posA - posB) <= maxDistance) {
            const start = Math.max(0, Math.min(posA, posB) - 20);
            const end = Math.min(haystack.length, Math.max(posA, posB) + 80);
            return { found: true, snippet: haystack.slice(start, end).trim() };
          }
        }
      }

      return { found: false, snippet: "" };
    };

    const textMatchesPattern = (text: string, patterns: RegExp[]): { found: boolean; snippet: string } => {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          const start = Math.max(0, match.index! - 20);
          const end = Math.min(text.length, match.index! + match[0].length + 60);
          return { found: true, snippet: text.slice(start, end).trim() };
        }
      }
      return { found: false, snippet: "" };
    };

    // --- Text-based checks (no API needed) ---

    // Online Booking check  -  uses user's selected platform when available
    let bookingPlatformFound = false;
    let bookingPlatformName = "";
    let bookingUrl: string | null = null;
    let bookingLoadsOk = false;
    let bookingLoadEvidence = "";

    // Known booking platform domains  -  used by both user-directed and generic detection
    const bookingPlatformDomains: Record<string, string> = {
      "campspot.com": "Campspot",
      "reserveamerica.com": "Reserve America",
      "hipcamp.com": "Hipcamp",
      "newbook.cloud": "NewBook",
      "resnexus.com": "ResNexus",
      "roverpass.com": "RoverPass",
      "fireflyreservations.com": "Firefly",
      "icamp.com": "iCamp",
      "staylist.com": "Staylist",
      "cloudbeds.com": "Cloudbeds",
      "guestylite.com": "Guesty",
      "rezfusion.com": "Rezfusion",
      "liverez.com": "LiveRez",
      "barefoot.com": "Barefoot",
      "trackhs.com": "Track",
      "escapia.com": "Escapia",
      "beds24.com": "Beds24",
      "hostaway.com": "Hostaway",
      "smoobu.com": "Smoobu",
      "lodgify.com": "Lodgify",
      "rezstream.com": "RezStream",
      "campify.com": "Campify",
      "bookingpal.com": "BookingPal",
      "bookingsync.com": "BookingSync",
      "checkfront.com": "Checkfront",
      "fareharbor.com": "FareHarbor",
      "peek.com": "Peek",
      "xola.com": "Xola",
    };

    // If user told us "no online booking", skip detection entirely
    if (bookingPlatform === "no-online-booking") {
      bookingPlatformFound = false;
      bookingLoadEvidence = "You told us you don't have online booking set up yet";
    } else if (bookingPlatform && bookingPlatform !== "not-sure" && bookingPlatform !== "custom-build") {
      // User selected a known platform  -  try platform-specific URL patterns
      const platformUrls: Record<string, string[]> = {
        campspot: [
          `https://www.campspot.com/book/${websiteUrl.hostname}`,
          `https://book.campspot.com/${websiteUrl.hostname}`,
        ],
        reserveamerica: [
          `https://www.reserveamerica.com/`,
          `https://camping.reserveamerica.com/`,
        ],
        hipcamp: [
          `https://www.hipcamp.com/${websiteUrl.hostname}`,
        ],
        lodgify: [],
        "rezdy-fareharbor": [],
      };

      const urlsToCheck = platformUrls[bookingPlatform] ?? [];
      bookingPlatformName = platformDisplayNames[bookingPlatform] || bookingPlatform;

      // Race all platform URLs in parallel , first to respond 200 wins
      const headChecks = urlsToCheck.map((url) =>
        fetchWithTimeout(url, { method: "HEAD" }, 3000)
          .then((r) => (r.ok ? { ok: true, url } : null))
          .catch(() => null)
      );
      const results = await Promise.all(headChecks);
      const firstOk = results.find((r) => r !== null);
      if (firstOk) {
        bookingPlatformFound = true;
        bookingLoadsOk = true;
        bookingLoadEvidence = `${bookingPlatformName} booking system is reachable`;
        bookingUrl = firstOk.url;
      }

      // If no specific URL worked, try detecting the platform in page HTML
      if (!bookingPlatformFound) {
        const platformDomain = Object.entries(bookingPlatformDomains)
          .find(([, name]) => name.toLowerCase().replace(/\s/g, "") === bookingPlatform.toLowerCase())
          ?.[0];
        if (platformDomain && loweredHtml.includes(platformDomain)) {
          bookingPlatformFound = true;
          bookingLoadsOk = true;
          bookingLoadEvidence = `${bookingPlatformName} booking system detected on the page`;
        }
      }
    }

    // If we found it via platform hints, skip generic detection
    if (!bookingPlatformFound && bookingPlatform !== "no-online-booking") {

    // Scan script src and iframe src for known booking platform domains
    const scriptSrcMatches = html.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi) ?? [];
    const iframeMatches = html.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi) ?? [];

    const allEmbedTags = [...scriptSrcMatches, ...iframeMatches];
    for (const tag of allEmbedTags) {
      const srcMatch = tag.match(/src=["']([^"']+)["']/i);
      const src = srcMatch?.[1] ?? "";
      for (const [domain, name] of Object.entries(bookingPlatformDomains)) {
        if (src.toLowerCase().includes(domain)) {
          bookingPlatformFound = true;
          bookingPlatformName = name;
          break;
        }
      }
      if (bookingPlatformFound) break;
    }

    // Fallback: check for booking platform names in page text AND booking URL patterns
    if (!bookingPlatformFound) {
      for (const [domain, name] of Object.entries(bookingPlatformDomains)) {
        if (loweredHtml.includes(name.toLowerCase()) || loweredHtml.includes(domain)) {
          bookingPlatformFound = true;
          bookingPlatformName = name;
          break;
        }
      }

      // Look for booking URL paths
      const bookingPathPatterns = [
        /\/book(?:ing)?\b/i, /\/reserve\b/i, /\/checkout\b/i,
        /\/availability\b/i, /\/rooms\b/i, /\/accommodation\b/i,
      ];
      const anchors = extractAnchors(html);
      for (const href of anchors) {
        for (const pattern of bookingPathPatterns) {
          if (pattern.test(href)) {
            try {
              bookingUrl = new URL(href, websiteUrl).toString();
            } catch {
              bookingUrl = href;
            }
            break;
          }
        }
        if (bookingUrl) break;
      }
    }

    // If we found a booking platform or URL, verify it actually loads
    if (bookingPlatformFound || bookingUrl) {
      const urlToTest = bookingUrl || `https://${websiteUrl.hostname}`;
      try {
        const bookingResponse = await fetchWithTimeout(urlToTest, { method: "GET" }, 5000);
        if (bookingResponse.ok) {
          const bodySample = await bookingResponse.text().catch(() => "");
          const hasErrorPage =
            bodySample.length < 500 ||
            /404|not found|server error|unavailable/i.test(bodySample.slice(0, 1000));
          if (hasErrorPage) {
            bookingLoadsOk = false;
            bookingLoadEvidence = "The booking page returned an error or empty page";
          } else {
            bookingLoadsOk = true;
            bookingLoadEvidence = bookingPlatformName
              ? `${bookingPlatformName} booking system loaded successfully`
              : "Booking page loaded successfully";
          }
        } else {
          bookingLoadsOk = false;
          bookingLoadEvidence = `Booking page responded with an error`;
        }
      } catch {
        bookingLoadsOk = false;
        bookingLoadEvidence = "Booking page could not be reached  -  the server may be down";
      }
    }
    } // end generic booking detection

    // Check 4: tap-to-call
    const telMatch = html.match(/<a[^>]*href=["']tel:([^"']+)["'][^>]*>/i);
    const telNumber = telMatch?.[1] ?? "";
    const telDigitCount = (telNumber.match(/\d/g) ?? []).length;
    const hasClickablePhone = telDigitCount >= 10;

    const phoneTextPattern = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
    const hasPlainPhone = phoneTextPattern.test(textOnly);
    const plainPhoneMatch = textOnly.match(phoneTextPattern);

    // Extract a clean digits-only phone number from the page for Places matching
    const scrapedPhoneDigits = (() => {
      if (hasClickablePhone) return telNumber.replace(/\D/g, "").slice(0, 10);
      if (plainPhoneMatch?.[0]) return plainPhoneMatch[0].replace(/\D/g, "").slice(0, 10);
      return "";
    })();

    let tapToCallStatus: CheckStatus;
    let tapToCallEvidence: string;
    let tapToCallFinding: string;
    let tapToCallDetails: string;

    if (hasClickablePhone) {
      tapToCallStatus = "pass";
      tapToCallEvidence = "Clickable phone number found on the page";
      tapToCallFinding = "Phone number is tap-to-call ready";
      tapToCallDetails = "Guests on the road can reach you instantly.";
    } else if (hasPlainPhone) {
      tapToCallStatus = "fail";
      tapToCallEvidence = `Phone number ${plainPhoneMatch?.[0] ?? "found"} is not clickable`;
      tapToCallFinding = "Phone number isn't tappable";
      tapToCallDetails = "Guests driving to your park can't call you with one tap.";
    } else {
      tapToCallStatus = "fail";
      tapToCallEvidence = "No phone number found anywhere on the homepage";
      tapToCallFinding = "Phone number isn't tappable";
      tapToCallDetails = "Guests driving to your park can't call you with one tap.";
    }

    // Check 5: cancellation  -  two-tier: nav links → tight proximity
    let cancellationStatus: CheckStatus;
    let cancellationEvidence: string;

    const navAnchors = extractAnchors(html);
    const hasCancellationNavLink = navAnchors.some((href) =>
      /\bcancellation\b|\/policies\b|\/terms\b/i.test(href)
    );

    if (hasCancellationNavLink) {
      cancellationStatus = "pass";
      cancellationEvidence = "Dedicated cancellation or policies page linked from navigation";
    } else {
      const cancellationTightResult = findWithinDistance(
        loweredText,
        [/\bcancellation\b/i, /\bcancel\b/i],
        [/\bpolicy\b/i, /\brefund\b/i, /\bdays\b/i, /\bfee\b/i],
        75,
      );
      if (cancellationTightResult.found) {
        cancellationStatus = "pass";
        cancellationEvidence = cancellationTightResult.snippet.slice(0, 150);
      } else {
        cancellationStatus = "fail";
        cancellationEvidence = "No cancellation policy found anywhere on the homepage";
      }
    }

    // Check 6: nightly-rates
    const ratesPatterns = [
      /\$\s?\d{1,3}(?:\.\d{2})?\s*(?:\/|per)\s*(?:night|day|site|person)/i,
      /\$\s?\d{1,3}(?:\.\d{2})?\s*nightly/i,
      /from\s+\$\s?\d{1,3}/i,
      /rates?\s+(?:from|starting at|as low as)/i,
      /\$\s?\d{2,3}(?:\.\d{2})?\b/i,
    ];
    let ratesEvidence = "";
    let ratesStatus: CheckStatus = "fail";
    for (const pattern of ratesPatterns) {
      const match = textOnly.match(pattern);
      if (match) {
        const start = Math.max(0, match.index! - 30);
        const end = Math.min(textOnly.length, match.index! + match[0].length + 60);
        ratesEvidence = textOnly.slice(start, end).trim().slice(0, 150);
        ratesStatus = "pass";
        break;
      }
    }
    if (!ratesEvidence) {
      ratesEvidence = "No nightly rates found anywhere on the homepage";
    }

    // Check 7: mobile-viewport  -  responsive meta tag (always in raw HTML, never JS-rendered)
    const hasViewportMeta = /<meta[^>]*name=["']viewport["'][^>]*content=["'][^"']*width=device-width[^"']*["'][^>]*>/i.test(html)
      || /<meta[^>]*content=["'][^"']*width=device-width[^"']*["'][^>]*name=["']viewport["'][^>]*>/i.test(html);
    const mobileViewportStatus: CheckStatus = hasViewportMeta ? "pass" : "fail";
    const mobileViewportEvidence = hasViewportMeta
      ? "Responsive design settings detected  -  your site adapts to phone screens"
      : "Missing responsive settings  -  your site may appear tiny and zoomed out on phones";

    // Extract a business name from the page title for the Places search
    const cleanTitle = title
      .replace(/\s*[-–|]\s*.*$/, "")
      .replace(/\s*(?:campground|RV park|RV resort|marina|glamping|cabin|lodge|resort|hotel|motel).*$/i, "")
      .trim();
    // Try to pull city/state from the page text
    const cityStatePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/;
    const cityStateMatch = textOnly.match(cityStatePattern);
    const cityState = cityStateMatch ? `${cityStateMatch[1]}, ${cityStateMatch[2]}` : "";
    if (cleanTitle && cleanTitle.length >= 3) {
      placesSearchQuery = `${cleanTitle} ${cityState || placesSearchQuery}`.trim();
    }
    // Include phone number in the search , Google Places matches phone numbers to listings
    if (scrapedPhoneDigits.length === 10) {
      placesSearchQuery = `${placesSearchQuery} ${scrapedPhoneDigits}`;
    }
    const placesSignalsPromise = fetchPlacesBusinessSignals(
      placesSearchQuery,
      canonicalHost,
      placesApiKey,
    );

    // Detect booking platform (for response metadata)
    const detectedPlatform = platformCatalog.find((platform) => loweredHtml.includes(platform.toLowerCase())) ?? null;

    // Look up previous scan in parallel with API calls
    const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
    const previousScanPromise: Promise<unknown> = (async () => {
      if (!supabaseUrl || !serviceRoleKey) return null;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const prevResponse = await fetch(
          `${supabaseUrl}/rest/v1/parkgrader_audits?select=report_snapshot&website_url=eq.${encodeURIComponent(canonicalHost)}&order=created_at.desc&limit=1`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            signal: controller.signal,
          },
        );
        clearTimeout(timeout);
        if (prevResponse.ok) {
          const rows = (await prevResponse.json()) as { report_snapshot?: unknown }[];
          if (rows.length > 0 && rows[0].report_snapshot) {
            const snap = rows[0].report_snapshot as Record<string, unknown>;
            if (snap && typeof snap.scanResult === "object" && snap.scanResult !== null) {
              return snap.scanResult as Record<string, unknown>;
            }
          }
        }
      } catch {
        // Silently skip
      }
      return null;
    })();

    // --- Await API promises ---
    const [pageSpeedResult, placesSignals, previousScanResult] = await Promise.all([
      pageSpeedPromise,
      placesSignalsPromise,
      previousScanPromise,
    ]);

    // --- API-dependent checks ---

    // Pagespeed  -  prefer Google's API, fall back to our own response time
    const pageSpeedScore = pageSpeedResult?.score ?? null;
    const pageSpeedError = pageSpeedResult?.error ?? null;
    const pageSizeKb = Math.round(html.length / 1024);
    const responseTimeSeconds = responseTimeMs / 1000;

    let pagespeedMobileStatus: CheckStatus;
    let pagespeedMobileEvidence: string;

    if (pageSpeedScore !== null) {
      // Google PageSpeed API returned a real score
      pagespeedMobileStatus = pageSpeedScore >= 50 ? "pass" : "fail";
      pagespeedMobileEvidence = `Google PageSpeed score is ${pageSpeedScore} out of 100 on mobile`;
    } else if (responseTimeMs > 0) {
      // Fall back to our own fetch timing
      if (responseTimeSeconds < 2) {
        pagespeedMobileStatus = "pass";
        pagespeedMobileEvidence = `Your site loaded in ${responseTimeSeconds.toFixed(1)} seconds and is ${pageSizeKb} KB  -  fast enough for mobile visitors`;
      } else if (responseTimeSeconds <= 5) {
        pagespeedMobileStatus = "pass";
        pagespeedMobileEvidence = `Your site loaded in ${responseTimeSeconds.toFixed(1)} seconds and is ${pageSizeKb} KB  -  acceptable but could be faster`;
      } else {
        pagespeedMobileStatus = "fail";
        pagespeedMobileEvidence = `Your site took ${responseTimeSeconds.toFixed(1)} seconds to load and is ${pageSizeKb} KB  -  guests on slow mobile connections may leave before it finishes`;
      }
    } else {
      pagespeedMobileStatus = "fail";
      pagespeedMobileEvidence = "Could not measure your site speed  -  your server may be blocking our checks";
    }

    // Google Places  -  rating + reviews from one API call
    const gbpRating = placesSignals?.rating ?? null;
    const gbpReviewCount = placesSignals?.reviewCount ?? null;
    const placesMatched = placesSignals?.matched ?? false;

    const gbpRatingStatus: CheckStatus = placesMatched && gbpRating !== null
      ? (gbpRating >= 4.0 ? "pass" : "fail")
      : "fail";
    const gbpRatingEvidence = placesMatched && gbpRating !== null
      ? `${gbpRating} out of 5 stars on Google`
      : "Unable to confirm your Google Maps listing";

    const gbpReviewsStatus: CheckStatus = placesMatched && gbpReviewCount !== null
      ? (gbpReviewCount >= 25 ? "pass" : "fail")
      : "fail";
    const gbpReviewsEvidence = placesMatched && gbpReviewCount !== null
      ? `${gbpReviewCount} Google reviews`
      : "Unable to confirm your Google review count";

    // --- Build the check list  -  exactly 10 checks ---

    const onlineBookingStatus: CheckStatus = bookingPlatformFound && bookingLoadsOk ? "pass" : "fail";

    const checks: Check[] = [
      // Group 1: Would a Guest Book Here?
      createCheck({
        id: "online-booking",
        name: "Online Booking",
        category: "Would a Guest Book Here?",
        status: onlineBookingStatus,
        evidence: bookingPlatformFound
          ? bookingLoadEvidence
          : "No booking platform or booking page detected on this website",
        finding: onlineBookingStatus === "pass"
          ? "Guests can book online anytime"
          : bookingPlatformFound
            ? "Booking system isn't working right now"
            : "Guests can't book online",
        details: onlineBookingStatus === "pass"
          ? "You're capturing reservations around the clock."
          : "You're losing reservations every night while you sleep.",
        steps: onlineBookingStatus === "pass"
          ? ["No changes needed , your booking system is working perfectly."]
          : bookingPlatformFound
            ? [
                "Go to your booking page right now and test it yourself , can you complete a reservation?",
                "If it's broken, call your booking platform's support and have them walk you through the fix.",
                "While you wait, add a temporary note on your homepage telling guests to call or email to book.",
              ]
            : [
                "Pick an online booking system designed for campgrounds , Campspot, NewBook, and RoverPass are the big three.",
                "Most of these platforms give you a free trial and handle the setup for you.",
                "Until it's live, make your phone number huge at the top of every page so guests can still book.",
              ],
        weight: 25,
        impact: "High",
      }),
      createCheck({
        id: "nightly-rates",
        name: "Rates Upfront",
        category: "Would a Guest Book Here?",
        status: ratesStatus,
        evidence: ratesEvidence,
        finding: ratesStatus === "pass"
          ? "Rates are easy to find"
          : "Nightly rates aren't visible",
        details: ratesStatus === "pass"
          ? "Guests can decide to book without having to call you."
          : "Hidden pricing is the number one reason guests abandon and book somewhere else.",
        steps: ratesStatus === "pass"
          ? ["Your rates are visible , keep them easy to find and make sure they're up to date."]
          : [
              "Add a simple 'Rates' or 'Pricing' link to your main navigation menu , it should be visible without scrolling.",
              "If your rates vary by season or site type, just list a 'starting at' price. Something beats nothing.",
              "Don't make people call or email for pricing , most won't bother. They'll just pick a park that shows prices up front.",
            ],
        weight: 15,
        impact: "High",
      }),
      createCheck({
        id: "cancellation",
        name: "Cancellation Policy",
        category: "Would a Guest Book Here?",
        status: cancellationStatus,
        evidence: cancellationEvidence,
        finding: cancellationStatus === "pass"
          ? "Cancellation policy is visible"
          : "No cancellation policy found",
        details: cancellationStatus === "pass"
          ? "Guests book with confidence when they know the terms upfront."
          : "Guests won't commit to a booking when they don't know the refund rules.",
        steps: cancellationStatus === "pass"
          ? ["Your cancellation policy is visible , review it once a year to make sure the terms are still accurate."]
          : [
              "Write a short paragraph explaining your refund and cancellation rules. Simple language, no legal jargon.",
              "Put it on a dedicated page and link to it from your booking flow, footer, and FAQ.",
              "Make sure guests see it before they pay , this prevents chargebacks and angry reviews.",
            ],
        weight: 10,
        impact: "High",
      }),
      createCheck({
        id: "pagespeed-mobile",
        name: "Mobile Speed",
        category: "Would a Guest Book Here?",
        status: pagespeedMobileStatus,
        evidence: pagespeedMobileEvidence,
        finding: pagespeedMobileStatus === "pass"
          ? "Site loads fast on phones"
          : "Site loads too slowly on phones",
        details: pagespeedMobileStatus === "pass"
          ? "Page speed isn't costing you bookings."
          : "Over half your visitors leave before the page even appears.",
        steps: pagespeedMobileStatus === "pass"
          ? ["Your site loads quickly , keep an eye on image sizes as you add new photos."]
          : [
              "Compress your images , large photo files are the #1 speed killer. Use a free tool like TinyPNG.",
              "Remove unnecessary plugins and widgets. Every extra script slows your page down.",
              "Ask your web host if they offer a CDN or caching. Most hosts can flip a switch that speeds things up dramatically.",
            ],
        weight: 10,
        impact: "High",
      }),
      createCheck({
        id: "mobile-viewport",
        name: "Mobile Design",
        category: "Would a Guest Book Here?",
        status: mobileViewportStatus,
        evidence: mobileViewportEvidence,
        finding: mobileViewportStatus === "pass"
          ? "Site works well on phones"
          : "Site isn't built for phones",
        details: mobileViewportStatus === "pass"
          ? "Guests on mobile can browse and book without any issues."
          : "Most guests browse on mobile. A broken layout sends them somewhere else.",
        steps: mobileViewportStatus === "pass"
          ? ["Your site looks great on phones , keep it consistent across all your pages."]
          : [
              "If you use WordPress or Squarespace, your theme is almost certainly responsive , you may just need to update it.",
              "Open your site on your own phone and check every page. If text is tiny or images spill off the screen, that's what guests see too.",
              "If you hired a web developer, ask them to add a viewport meta tag , it's a one-line fix that tells phones how to display your site.",
            ],
        weight: 10,
        impact: "High",
      }),
      createCheck({
        id: "tap-to-call",
        name: "Tap-to-Call Phone",
        category: "Would a Guest Book Here?",
        status: tapToCallStatus,
        evidence: tapToCallEvidence,
        finding: tapToCallFinding,
        details: tapToCallDetails,
        steps: tapToCallStatus === "pass"
          ? ["Your phone number is tappable , make sure it stays that way on every page."]
          : plainPhoneMatch
            ? ["Wrap your phone number in a link tag so it's tappable. It takes one line of code and your web developer can do it in 30 seconds.", "Make sure the phone number appears on every page, both in the header and footer."]
            : ["Add your phone number to the header and footer of every page so it's impossible to miss.", "Make it a tap-to-call link so guests can just tap it and call. No copy and paste required."],
        weight: 10,
        impact: "High",
      }),

      // Group 2: Can a Guest Find Basic Info?

      // Group 3: Will Google Send Guests?
      createCheck({
        id: "google-rating",
        name: "Google Rating",
        category: "Will Google Send Guests?",
        status: gbpRatingStatus,
        evidence: gbpRatingEvidence,
        finding: !placesMatched
          ? "Google listing not found. Claim your free listing."
          : (gbpRating ?? 0) >= 4.0
            ? "Google rating is strong"
            : "Google rating is below 4 stars",
        details: !placesMatched
          ? "Go to business.google.com and claim your free listing. It takes 5 minutes and helps guests find you."
          : (gbpRating ?? 0) >= 4.0
            ? "A 4 star or above rating keeps you visible when guests are comparing options."
            : "Most guests filter out anything under 4 stars when comparing parks.",
        steps: !placesMatched
          ? ["Go to business.google.com and search for your park by name. Click 'Claim this business' and follow the steps.", "Once verified, fill in your hours, photos, and description. This is free and takes about 10 minutes."]
          : (gbpRating ?? 0) >= 4.0
            ? ["Your rating is solid , keep it that way by asking happy guests to leave a review at checkout."]
            : [
                "Read your most recent negative review and respond publicly. Apologize, explain what you fixed, and invite them back.",
                "Ask 5-10 of your happiest recent guests to leave an honest review. Most people are glad to help if you just ask.",
                "Don't buy fake reviews , Google catches these and it can hurt your ranking.",
              ],
        weight: 10,
        impact: "High",
      }),
      createCheck({
        id: "gbp-reviews",
        name: "Google Reviews",
        category: "Will Google Send Guests?",
        status: gbpReviewsStatus,
        evidence: gbpReviewsEvidence,
        finding: !placesMatched
          ? "Google listing not found. Claim your free listing."
          : (gbpReviewCount ?? 0) >= 25
            ? "Healthy review volume"
            : "Not enough Google reviews",
        details: !placesMatched
          ? "Claim your Google Maps listing at business.google.com. Then our scanner can check your reviews."
          : (gbpReviewCount ?? 0) >= 25
            ? "Hundreds of reviews builds instant trust with guests who have never heard of you."
            : "Parks with under 25 reviews look unproven to guests who don't know you.",
        steps: !placesMatched
          ? ["Same as above , go to business.google.com and claim your free listing first. Everything else builds from there."]
          : (gbpReviewCount ?? 0) >= 25
            ? ["You're in great shape. Keep asking guests for reviews , a steady flow looks better than a one-time burst."]
            : [
                "Print a simple card that says 'Loved your stay? Please leave us a Google review' and hand it out at checkout.",
                "Email your last 20 guests asking for a quick review. Include a direct link to your Google review page.",
                "Don't offer incentives , just ask genuinely. Most happy guests are willing if you make it easy.",
              ],
        weight: 10,
        impact: "High",
      }),
      createCheck({
        id: "ssl-https",
        name: "SSL",
        category: "Will Google Send Guests?",
        status: websiteUrl.protocol === "https:" ? "pass" : "fail",
        evidence: websiteUrl.protocol === "https:"
          ? "Your site loads over a secure HTTPS connection"
          : "Your site loads over HTTP  -  browsers show security warnings for this",
        finding: websiteUrl.protocol === "https:"
          ? "Site is secure"
          : "Site isn't secure",
        details: websiteUrl.protocol === "https:"
          ? "Guests can book and pay without any security warnings getting in the way."
          : "Browsers warn guests before they even see your page.",
        steps: websiteUrl.protocol === "https:"
          ? ["Your site is secure , no action needed."]
          : [
              "Call your web host and ask them to install an SSL certificate. Most hosts do this for free in under an hour.",
              "Once installed, make sure your site automatically redirects from http:// to https:// , your web developer can do this with one line of code.",
            ],
        weight: 10,
        impact: "High",
      }),
      createCheck({
        id: "meta-description",
        name: "Meta Description",
        category: "Will Google Send Guests?",
        status: description.length >= 50 && description.length <= 160 ? "pass" : "fail",
        evidence: description.length > 0
          ? `Meta description is ${description.length} characters long`
          : "No meta description found on the homepage",
        finding: description.length >= 50 && description.length <= 160
          ? "Google preview text is set"
          : "No Google preview text set",
        details: description.length >= 50 && description.length <= 160
          ? "Searchers can see what your park offers before they even click your link."
          : "Guests searching Google see a blank summary and click your competitor instead.",
        steps: description.length >= 50 && description.length <= 160
          ? ["Your meta description is set up correctly , review it once a year to keep it fresh."]
          : [
              "Write 1-2 sentences that describe your park: where you are, what you offer, and why someone should book. Keep it under 160 characters.",
              "Add this as a meta description tag in your homepage <head> section. Most website builders have a dedicated SEO settings box for this.",
              "Avoid keyword stuffing , write it for a human, not a search engine. 'Family campground on Lake Travis with pool, fishing, and RV hookups' beats 'campground, RV park, campsite, camping, best campground'.",
            ],
        weight: 5,
        impact: "Medium",
      }),
    ];

    // --- Scoring ---

    const categoryScores = (Object.keys(config.categoryWeights) as CheckCategory[]).map((category) => {
      const categoryChecks = checks.filter((check) => check.category === category);
      const totalCategoryWeight = config.categoryWeights[category];
      const passedWeight = categoryChecks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0);
      const totalCheckWeight = categoryChecks.reduce((sum, check) => sum + check.weight, 0);
      const score = totalCheckWeight === 0 ? 0 : Math.round((passedWeight / totalCheckWeight) * 100);
      return {
        name: category,
        score,
        passed: passedWeight,
        total: totalCheckWeight,
        categoryWeight: totalCategoryWeight,
      };
    });

    const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
    const passedWeight = checks.reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0);
    const score = totalWeight === 0 ? 0 : Math.round((passedWeight / totalWeight) * 100);

    const topFails = checks
      .filter((check) => check.status === "fail")
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((check) => check.id);

    if (timingEnabled) {
      const totalMs = Math.round(performance.now() - fetchStart + responseTimeMs);
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
      pageSpeedReportUrl: pageSpeedApiKey ? `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(websiteUrl.toString())}` : undefined,
      industry,
      industryLabel: config.label,
      unitLabel: config.unitLabel,
      score,
      status: statusFromScore(score),
      detectedPlatform,
      topFails,
      categories: categoryScores,
      checks,
      placesError: placesSignals === null && placesApiKey ? "Could not match your website to a Google Business listing. This is common and not your fault  -  your listing may use a different website address." : null,
      pagespeedError: pageSpeedError || null,
      previousScanResult: previousScanResult ?? undefined,
    });
  } catch (error) {
    const message = normalizeScanError(error);
    return NextResponse.json({ message }, { status: 500 });
  }
}
