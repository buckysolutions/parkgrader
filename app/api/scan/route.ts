import { NextRequest, NextResponse } from "next/server";
import tls from "node:tls";

export const runtime = "nodejs";

type IndustryKey = "campground" | "marina" | "glamping" | "cabins";
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
      "Technical Performance": 15,
      "Booking & Conversion": 25,
      "Outdoor Hospitality Essentials": 25,
      "Local & Online Visibility": 20,
      "Mobile Experience": 15,
      "Booking Psychology": 10,
    },
  },
  marina: {
    label: "Marina",
    unitLabel: "slips",
    listingKeywords: ["dockwa", "marinas.com", "waterway guide", "snag-a-slip"],
    categoryWeights: {
      "Technical Performance": 15,
      "Booking & Conversion": 20,
      "Outdoor Hospitality Essentials": 20,
      "Local & Online Visibility": 25,
      "Mobile Experience": 20,
      "Booking Psychology": 10,
    },
  },
  glamping: {
    label: "Glamping",
    unitLabel: "tents/domes",
    listingKeywords: ["hipcamp", "glamping hub", "canopy", "airbnb"],
    categoryWeights: {
      "Technical Performance": 10,
      "Booking & Conversion": 20,
      "Outdoor Hospitality Essentials": 30,
      "Local & Online Visibility": 20,
      "Mobile Experience": 20,
      "Booking Psychology": 10,
    },
  },
  cabins: {
    label: "Cabins / Vacation Rentals",
    unitLabel: "units",
    listingKeywords: ["airbnb", "vrbo", "booking.com", "expedia"],
    categoryWeights: {
      "Technical Performance": 15,
      "Booking & Conversion": 25,
      "Outdoor Hospitality Essentials": 25,
      "Local & Online Visibility": 20,
      "Mobile Experience": 15,
      "Booking Psychology": 10,
    },
  },
};

const FAIL_IMPACT_BY_CHECK_ID: Partial<Record<string, string>> = {
  "ssl-valid": "Estimated impact: Security warnings can stop bookings before guests even view the property.",
  "https-redirect": "Estimated impact: Mixed secure/insecure routing weakens trust at the first click.",
  "response-time": "Estimated impact: Slow response time can leak high-intent mobile traffic before the site even loads.",
  "broken-links": "Estimated impact: Dead-end pages make the property feel unmaintained and increase drop-off.",
  "pagespeed-mobile": "Estimated impact: Slow mobile loading can reduce bookings from guests comparing parks on the road.",
  "technical-trust-security": "Estimated impact: Weak security and URL trust signals can cause abandonment before guests even browse your park.",
  "canonical-redirect-hygiene": "Estimated impact: Broken canonical and redirect setup can split traffic and weaken trust from search visitors.",
  "booking-platform": "Estimated impact: Without a modern booking path, guests are more likely to call later or book elsewhere first.",
  "booking-engine-health": "Estimated impact: If the booking page is down or slow, ready-to-book guests leave immediately.",
  "booking-cta": "Estimated impact: If the reserve path is hard to spot, guests may never make it into checkout.",
  "date-picker-discoverability": "Estimated impact: If guests cannot see dates early, many abandon before trying to book.",
  "abandonment-recovery-readiness": "Estimated impact: Without recovery tracking, near-bookers disappear with no follow-up path.",
  "tracking-pixels": "Estimated impact: You lose the ability to bring back visitors who left before booking.",
  "newsletter-capture": "Estimated impact: You may be missing repeat-booking and nurture opportunities from undecided visitors.",
  "pet-policy": "Estimated impact: Pet owners may abandon due to uncertainty instead of calling to clarify.",
  "rv-hookup-specs": "Estimated impact: RV guests may leave when power and hookup details are unclear.",
  "big-rig-readiness": "Estimated impact: Big-rig guests may skip your park when max length and site type details are missing.",
  "wifi-quality-claims": "Estimated impact: Remote workers and families may avoid booking when Wi-Fi quality is unclear.",
  "arrival-directions-clarity": "Estimated impact: Missing arrival guidance can lead to stressful arrivals and bad first impressions.",
  "ev-extra-vehicle-policy": "Estimated impact: Missing EV and extra-vehicle rules can create pre-booking hesitation and support load.",
  "amenities-page": "Estimated impact: Guests may not see enough value to justify your rate or location.",
  "rate-page": "Estimated impact: Hidden pricing increases bounce from shoppers who just want to self-qualify quickly.",
  "cancellation-policy": "Estimated impact: Unclear refund rules create hesitation for advance planners and families.",
  "photo-gallery-quality": "Estimated impact: Weak visuals make it harder for guests to imagine the stay and trust the value.",
  "accessibility-statement": "Estimated impact: Guests with accessibility needs may leave rather than risk uncertainty.",
  "meta-title": "Estimated impact: Searchers may skip your listing if they cannot instantly identify what and where you are.",
  "meta-description": "Estimated impact: Weak search copy lowers click quality from Google and maps traffic.",
  "gbp-sync": "Estimated impact: Below-baseline map presence can suppress local discovery and trust.",
  "local-review-competitiveness": "Estimated impact: If review strength lags nearby competitors, guests may choose another park first.",
  "social-presence": "Estimated impact: Missing social proof makes the property feel less current and less trustworthy.",
  "listing-signals": "Estimated impact: Limited listing presence means fewer discovery paths before guests ever reach your site.",
  "facebook-link": "Estimated impact: Broken profile links create trust leakage and wasted clicks.",
  "mobile-viewport": "Estimated impact: A poor phone layout can cause immediate abandonment from mobile guests.",
  "mobile-tap-targets": "Estimated impact: Hard-to-tap buttons on phones create friction right before booking actions.",
  "header-phone": "Estimated impact: Guests ready to call may bounce if they cannot connect in one tap.",
  "phone-conversion-readiness": "Estimated impact: Weak phone-call setup can cost high-intent guests who prefer calling first.",
  "image-count": "Estimated impact: Thin imagery reduces emotional buy-in and lowers conversion confidence.",
  "listing-completeness": "Estimated impact: Incomplete third-party presence can weaken both discovery and direct-booking confidence.",
  "rate-transparency": "Estimated impact: Guests may abandon booking due to uncertainty around price fit.",
  "contact-friction": "Estimated impact: Every extra step or missing contact option increases inquiry drop-off.",
  "trust-stack-completeness": "Estimated impact: Missing trust signals can increase hesitation before guests commit money.",
  "local-search-intent-coverage": "Estimated impact: Weak local relevance signals reduce discovery from nearby searchers.",
  "seasonal-visibility": "Estimated impact: Hidden promotions reduce off-peak demand and urgency.",
  "visual-storytelling": "Estimated impact: Guests may not emotionally connect with the stay quickly enough to convert.",
  "visual-proof-relevance": "Estimated impact: Missing core proof photos can leave guests unsure what the stay is really like.",
  "payment-flexibility": "Estimated impact: Unclear payment options can create final-step hesitation.",
  "booking-click-depth": "Estimated impact: A long booking path increases drop-off before guests ever see checkout.",
  "availability-visibility": "Estimated impact: Guests may leave if they cannot check dates and availability early.",
  "fee-transparency": "Estimated impact: Surprise fees can reduce trust and increase checkout abandonment.",
  "onsite-guest-proof": "Estimated impact: Without visible guest proof, trust has to be rebuilt from scratch on your site.",
  "authentic-photography": "Estimated impact: Stock-feeling photography can make the property feel less credible and less memorable.",
  "structured-data": "Estimated impact: Missing structured data means Google cannot show rich results like ratings, prices, and availability for your property.",
  "accessibility-score": "Estimated impact: Poor accessibility can exclude guests with disabilities and hurt search rankings.",
};

const PASS_IMPACT_BY_CHECK_ID: Partial<Record<string, string>> = {
  "pagespeed-mobile": "Estimated impact: Faster mobile loading supports more confident browsing and more completed bookings.",
  "booking-cta": "Estimated impact: A clear reserve path keeps high-intent guests moving toward checkout.",
  "rate-transparency": "Estimated impact: Visible pricing helps guests self-qualify and reduces unnecessary drop-off.",
  "onsite-guest-proof": "Estimated impact: Visible guest proof builds trust before visitors leave the homepage.",
  "authentic-photography": "Estimated impact: Real visuals help guests picture the stay and justify the rate faster.",
};

const getEstimatedImpactForCheck = (check: Check): string => {
  if (check.status === "pass") {
    return PASS_IMPACT_BY_CHECK_ID[check.id] ?? "Estimated impact: This healthy signal removes friction and strengthens booking confidence.";
  }

  if (check.status === "unknown") {
    return "Estimated impact: This signal is unclear, which means guests may still face avoidable uncertainty.";
  }

  return FAIL_IMPACT_BY_CHECK_ID[check.id] ?? "Estimated impact: This issue may be creating avoidable booking friction for ready-to-book guests.";
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

const hasBookingRecoverySignals = (html: string): boolean => {
  return /begin_checkout|add_payment_info|purchase|booking_complete|reservation_confirmed|thank-you|thank you|conversion/i.test(html);
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
    return resolved.host === baseUrl.host;
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

const getSslData = async (
  host: string,
): Promise<{ valid: boolean; daysUntilExpiry: number; error?: string }> => {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
        timeout: 8000,
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
      resolve({ valid: false, daysUntilExpiry: 0, error: error.message });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ valid: false, daysUntilExpiry: 0, error: "TLS timeout" });
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
        fetchWithTimeout(httpVersion.toString(), 8000).catch(() => null),
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

    // Start PageSpeed immediately after URL is confirmed — it only needs the URL, not HTML.
    const pageSpeedApiKey = process.env.PAGESPEED_API_KEY?.trim();
    const pageSpeedReportUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(websiteUrl.toString())}`;

    const pageSpeedPromise = pageSpeedApiKey
      ? (async () => {
          try {
            const pageSpeedUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
            pageSpeedUrl.searchParams.set("url", websiteUrl.toString());
            pageSpeedUrl.searchParams.set("strategy", "mobile");
            pageSpeedUrl.searchParams.set("category", "performance");
            pageSpeedUrl.searchParams.set("category", "accessibility");
            pageSpeedUrl.searchParams.set("key", pageSpeedApiKey);

            const pageSpeedResponse = await fetchWithTimeout(pageSpeedUrl.toString(), 20000);
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
              return { score: null, accessibilityScore: null, error: normalizedError.message };
            }

            const runtimeError = payload.lighthouseResult?.runtimeError?.message;
            const rawScore = payload.lighthouseResult?.categories?.performance?.score;
            const rawA11yScore = payload.lighthouseResult?.categories?.accessibility?.score;

            const perfScore = typeof rawScore === "number" && !Number.isNaN(rawScore) ? Math.round(rawScore * 100) : null;
            const a11yScore = typeof rawA11yScore === "number" && !Number.isNaN(rawA11yScore) ? Math.round(rawA11yScore * 100) : null;

            if (perfScore !== null) {
              return { score: perfScore, accessibilityScore: a11yScore, error: null };
            }

            return {
              score: null,
              accessibilityScore: a11yScore,
              error: runtimeError
                ? `Lighthouse returned error: ${runtimeError}`
                : "PageSpeed API did not return a usable performance score.",
            };
          } catch {
            return { score: null, accessibilityScore: null, error: "PageSpeed check is taking longer than expected right now." };
          }
        })()
      : Promise.resolve(null);

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

    const hasViewport = /<meta[^>]*name=["']viewport["'][^>]*>/i.test(html);
    const detectedPlatform = platformCatalog.find((platform) => loweredHtml.includes(platform.toLowerCase())) ?? null;
    const bookingCallToAction = /book now|reserve now|book your stay|check availability|reserve/i.test(html);

    const facebookLink = links.find((href) => href.toLowerCase().includes("facebook.com")) ?? null;
    const instagramLink = links.find((href) => href.toLowerCase().includes("instagram.com")) ?? null;
    const mapLink = links.find((href) => /google\.[^/]+\/maps|maps\.app\.goo\.gl|g\.page/i.test(href)) ?? null;
    const hasEmbeddedMap = /maps\.google|google maps|maps\.googleapis/i.test(html);
    const reviewCountMatch = html.match(/reviewCount["']?\s*[:=]\s*["']?(\d+)/i);
    const reviewCount = reviewCountMatch ? Number(reviewCountMatch[1]) : null;

    const headerMatch = html.match(/<header[\s\S]*?<\/header>/i);
    const headerHtml = headerMatch?.[0] ?? "";
    const phoneMatch = headerHtml.match(/(\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
    const hasClickableHeaderPhone = /href=["']tel:/i.test(headerHtml);

    const homepageTrackingPixels = detectTrackingPixels(html);

    const internalLinks = links
      .filter((href) => isInternalLink(href, websiteUrl))
      .map((href) => new URL(href, websiteUrl).toString());
    const uniqueInternalLinks = Array.from(new Set(internalLinks)).slice(0, 6);

    const highQualityImageCount = images.filter((image) => image.width === null || image.width >= 400).length;
    const listingHits = config.listingKeywords.filter((keyword) => loweredHtml.includes(keyword)).length;

    const hrefContains = (parts: string[]) => links.some((href) => parts.some((part) => href.toLowerCase().includes(part)));
    const keywordContains = (parts: string[]) => parts.some((part) => loweredHtml.includes(part));

    const petPolicyFound = hrefContains(["/pets", "/pet-policy", "/pet"]) || keywordContains(["pet policy", "dogs welcome", "pets welcome"]);
    const rvHookupFound = keywordContains(["30 amp", "50 amp", "full hookup", "full hook-up", "water/electric", "sewer"]);
    const amenitiesFound = hrefContains(["/amenities", "/activities", "/recreation"]) || keywordContains(["amenities", "activities", "recreation", "pool", "playground"]);
    const ratesFound = hrefContains(["/rates", "/pricing", "/reservations"]) || keywordContains(["rates", "pricing", "$", "nightly"]);
    const cancellationFound = keywordContains(["cancel", "refund", "cancellation policy", "cancellation"]);
    const accessibilityFound = hrefContains(["/accessibility"]) || keywordContains(["accessibility statement", "accessibility"]);
    const newsletterFound = /<input[^>]*type=["']email["']/i.test(html);
    const bookingLinks = links.filter((href) => /book|reserve|availability|campspot|hipcamp|reserveamerica|roverpass|dockwa|resnexus|newbook|lodgify/i.test(href));
    const primaryBookingLink = bookingLinks[0] ? new URL(bookingLinks[0], websiteUrl).toString() : null;
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
    const onsiteGuestProofCount = (html.match(/testimonial|guest review|guest said|what guests say|five-star|5-star|★★★★★|review/gi) || []).length;
    const onsiteGuestProofVisible = onsiteGuestProofCount >= 2 || /reviewCount|aggregateRating|testimonial/i.test(html);
    const stockImageCount = images.filter((image) => /unsplash|pexels|shutterstock|istockphoto|stock\.adobe/i.test(image.src)).length;

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
    let pageSpeedStatus: CheckStatus = "unknown";
    let pageSpeedFinding = "Unable to verify PageSpeed mobile score.";
    let pageSpeedDetails = "PageSpeed is taking longer than expected. We can still show the rest of your audit now.";

    // Run PageSpeed, Facebook, and map reachability checks in parallel.

    const runMapCheck = async (): Promise<boolean> => {
      if (!mapLink) return false;
      try {
        const response = await fetchWithTimeout(new URL(mapLink, websiteUrl).toString(), 6000);
        return response.ok;
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
        const health = { reachable: response.ok, responseTimeMs: elapsed, statusCode: response.status };

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
            const response = await fetchWithTimeout(link, 3000);
            if (!response.ok) broken += 1;
          } catch {
            broken += 1;
          }
        }),
      );
      return broken;
    };

    const runFacebookCheck = async (): Promise<boolean> => {
      if (!facebookLink) return false;
      try {
        new URL(facebookLink, websiteUrl); // validate URL structure only; Facebook blocks server-side fetches
        return true;
      } catch {
        return false;
      }
    };

    const [pageSpeedResult, mapReachable, bookingLandingResult, brokenCount, facebookReachable] = await Promise.all([
      pageSpeedPromise,
      measure("mapLinkCheck", runMapCheck),
      measure("bookingLandingCheck", runBookingLandingCheck),
      measure("internalLinkScan", runBrokenLinkCheck),
      measure("facebookLinkCheck", runFacebookCheck),
    ]);
    const bookingLandingHtml = bookingLandingResult.html;
    const bookingHealth = { reachable: bookingLandingResult.reachable, responseTimeMs: bookingLandingResult.responseTimeMs, statusCode: bookingLandingResult.statusCode };

    let accessibilityScore: number | null = null;
    if (pageSpeedResult && pageSpeedResult.score !== null) {
      pageSpeedScore = pageSpeedResult.score;
      accessibilityScore = pageSpeedResult.accessibilityScore ?? null;
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
      pageSpeedStatus = "unknown";
      pageSpeedFinding = "We could not confirm phone loading speed on this scan.";
      pageSpeedDetails = pageSpeedResult?.error ?? "PageSpeed check is still warming up. Please run again in a minute for a fresh score.";
    }

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
    const bookingSurface = `${loweredHtml} ${bookingLandingHtml}`;
    const availabilityVisibleEarly = /check[ -]?in|check[ -]?out|arrival|departure|available dates|availability calendar|select dates|search availability|site type/i.test(bookingSurface);
    const feesVisibleEarly = /cleaning fee|service fee|booking fee|resort fee|processing fee|taxes and fees|additional fees/i.test(bookingSurface);
    const bookingClickEstimate = !primaryBookingLink && !bookingCallToAction
      ? 5
      : bookingCallToAction && pricesVisible && availabilityVisibleEarly
        ? 2
        : bookingCallToAction && (pricesVisible || availabilityVisibleEarly)
          ? 3
          : primaryBookingLink
            ? 4
            : 5;
    const rateTransparency = pricesVisible ? "pass" : "fail";

    const seasonalKeywords = ["early bird", "off-season", "shoulder season", "group rate", "weekly discount", "monthly rate", "special offer", "promo"];
    const hasSeasonalPromo = seasonalKeywords.some((keyword) => loweredHtml.includes(keyword));

    const paymentMethods = [
      /stripe|square\/pay|paypal|apple pay|google pay|amex|visa|mastercard/i.test(html) ? 1 : 0,
      hasClickableHeaderPhone ? 1 : 0,
    ].reduce((sum, val) => sum + val, 0);

    const trackingPixels = Array.from(new Set([
      ...homepageTrackingPixels,
      ...detectTrackingPixels(bookingLandingHtml),
    ]));
    const bookingRecoverySignals = hasBookingRecoverySignals(`${loweredHtml} ${bookingLandingHtml}`);
    const trustStackScore = [sslData.valid, redirectedToHttps, cancellationFound, onsiteGuestProofVisible].filter(Boolean).length;
    const visualProofCategoryScore = [
      /rv site|campsite|cabin interior|glamping tent|slip/i.test(loweredHtml),
      /bathhouse|restroom|shower|laundry/i.test(loweredHtml),
      /pool|playground|fire pit|dock|trail|amenities/i.test(loweredHtml),
      /entrance|welcome sign|map|directions|getting here/i.test(loweredHtml),
    ].filter(Boolean).length;
    const scannedHostNormalized = websiteUrl.hostname.replace(/^www\./i, "").toLowerCase();
    const canonicalHostNormalized = canonicalUrl?.hostname.replace(/^www\./i, "").toLowerCase() ?? null;
    const canonicalRedirectHealthy = redirectedToHttps && Boolean(
      canonicalUrl &&
      canonicalUrl.protocol === "https:" &&
      canonicalHostNormalized === scannedHostNormalized,
    );
    const securitySignals = [sslData.valid, redirectedToHttps, canonicalRedirectHealthy].filter(Boolean).length;
    const hasMaxLengthInfo = /max(?:imum)?\s*(?:rv|rig|vehicle)?\s*length|up to\s*\d{2,3}\s*(?:ft|feet)|\d{2,3}\s*(?:ft|feet)\s*(?:max|maximum)|rig\s*length/i.test(bookingSurface);
    const hasSiteTypeInfo = /pull[ -]?through|pullthrough|back[ -]?in|backin/i.test(bookingSurface);
    const wifiMentioned = /wi-?fi|internet/i.test(loweredHtml);
    const wifiQualityMentioned = /high[ -]?speed|fast\s*wifi|stream(?:ing)?\s*friendly|remote\s*work|work\s*from\s*(?:camp|rv)|\b\d{2,4}\s*mbps\b|fiber/i.test(loweredHtml);
    const hasArrivalSection = hrefContains(["/directions", "/getting-here", "/arrival"]) || keywordContains(["directions", "getting here", "arrival instructions", "how to get here"]);
    const gpsPitfallWarning = /low\s*clearance|bridge\s*clearance|avoid\s+.*road|do not use\s+gps|use\s+main\s+entrance|truck\s*route|rv\s*route/i.test(loweredHtml);
    const hasEvChargingPolicy = keywordContains(["ev charging", "electric vehicle", "tesla", "level 2 charger", "charging policy", "do not charge from pedestal", "pedestal charging"]);
    const hasExtraVehiclePolicy = keywordContains(["extra vehicle", "additional vehicle", "second vehicle", "tow vehicle", "extra car", "vehicle fee", "parking pass"]);

    const checks: Check[] = [
      createCheck({
        id: "technical-trust-security",
        name: "Technical trust & security",
        category: "Technical Performance",
        status: !sslData.valid || !redirectedToHttps
          ? "fail"
          : canonicalUrl && !canonicalRedirectHealthy
            ? "fail"
            : canonicalUrl
              ? "pass"
              : "unknown",
        finding: `${securitySignals} of 3 trust-and-security signals detected (SSL, HTTPS redirect, canonical alignment).`,
        details: !sslData.valid || !redirectedToHttps
          ? "Enable SSL and force all traffic to HTTPS. This is table stakes for bookings and trust."
          : canonicalUrl && !canonicalRedirectHealthy
            ? `Canonical ${canonicalUrl.toString()} does not match your preferred secure host.`
            : canonicalUrl
              ? "Security and preferred URL setup look aligned."
              : "SSL and HTTPS redirect are good, but no canonical tag was detected to confirm preferred URL.",
        effort: "Low",
        impact: "High",
        serviceKey: "ssl",
      }),
      createCheck({
        id: "response-time",
        name: "Server response time",
        category: "Technical Performance",
        status: responseTimeMs < 1200 ? "pass" : "fail",
        finding: `Initial server response time is ${responseTimeMs}ms.`,
        details:
          responseTimeMs < 1200
            ? "Response time is in a healthy range."
            : "If your site takes more than a second or two to start loading, most visitors leave before they ever see what you offer.",
        effort: "Medium",
        impact: "High",
        serviceKey: "pagespeed",
      }),
      createCheck({
        id: "broken-links",
        name: "Broken links",
        category: "Technical Performance",
        status: brokenCount === 0 ? "pass" : "fail",
        finding:
          brokenCount === 0
            ? "No broken internal links were found in sampled homepage links."
            : `${brokenCount} broken internal links were found in sampled homepage links.`,
        details:
          brokenCount === 0
            ? "Navigation appears healthy."
            : "Clicking a link that leads to an error page makes your site look unmaintained — the same as a broken sign in front of your property.",
        effort: "Medium",
        impact: "Medium",
        serviceKey: "pagespeed",
      }),
      createCheck({
        id: "pagespeed-mobile",
        name: "Mobile performance",
        category: "Technical Performance",
        status: pageSpeedStatus,
        finding: pageSpeedFinding,
        details: pageSpeedDetails,
        effort: "Medium",
        impact: "High",
        serviceKey: "pagespeed",
      }),
      createCheck({
        id: "booking-platform",
        name: "Booking platform",
        category: "Booking & Conversion",
        status: detectedPlatform ? "pass" : "fail",
        finding: detectedPlatform
          ? `Detected ${detectedPlatform}.`
          : "No major booking platform was detected.",
        details: detectedPlatform
          ? "A recognizable booking platform is present for direct reservations."
          : "Guests want to reserve online — especially at night or on weekends when you're not near the phone. Without a booking system, those reservations go to a competitor who has one.",
        effort: "High",
        impact: "High",
        serviceKey: "booking_cta",
      }),
      ...(primaryBookingLink
        ? [
            createCheck({
              id: "booking-engine-health",
              name: "Booking engine uptime",
              category: "Booking & Conversion",
              status: bookingHealth.reachable ? (bookingHealth.responseTimeMs !== null && bookingHealth.responseTimeMs <= 2500 ? "pass" : "unknown") : "fail",
              finding: bookingHealth.reachable
                ? `Booking page is reachable${bookingHealth.responseTimeMs !== null ? ` in ${bookingHealth.responseTimeMs}ms` : ""}.`
                : `Booking page appears unreachable${bookingHealth.statusCode ? ` (status ${bookingHealth.statusCode})` : ""}.`,
              details: bookingHealth.reachable
                ? "Guests can reach your booking page right now."
                : "If your booking page is down, guests leave and book elsewhere. Test this link daily or set uptime alerts.",
              effort: "Low",
              impact: "High",
              serviceKey: "booking_platform",
            }),
          ]
        : []),
      createCheck({
        id: "booking-cta",
        name: "Primary booking CTA",
        category: "Booking & Conversion",
        status: bookingCallToAction ? "pass" : "fail",
        finding: bookingCallToAction
          ? "A clear booking call to action is visible."
          : "No clear booking call to action is visible.",
        details: bookingCallToAction
          ? "Guests can quickly identify where to reserve."
          : "If a visitor can't quickly find a 'Book Now' button, they'll move on to a competitor who makes it obvious. Don't make people hunt for how to reserve.",
        effort: "Low",
        impact: "High",
        serviceKey: "booking_cta",
      }),
      createCheck({
        id: "date-picker-discoverability",
        name: "Date picker discoverability",
        category: "Booking & Conversion",
        status: hasDateSignalsOnHomepage ? "pass" : primaryBookingLink ? "fail" : "unknown",
        finding: hasDateSignalsOnHomepage
          ? "Date or availability controls appear on the homepage."
          : primaryBookingLink
            ? "No clear date or availability controls were found on the homepage."
            : "Unable to verify date visibility without a booking path.",
        details: hasDateSignalsOnHomepage
          ? "Guests can start checking dates without hunting around."
          : "Show a date picker or a clear 'Check Availability' action near the top of the homepage so guests can start quickly.",
        effort: "Low",
        impact: "High",
        serviceKey: "booking_cta",
      }),
      createCheck({
        id: "booking-click-depth",
        name: "Booking click depth",
        category: "Booking & Conversion",
        status: bookingClickEstimate <= 3 ? "pass" : bookingClickEstimate === 4 ? "unknown" : "fail",
        finding: `Booking likely takes about ${bookingClickEstimate} clicks from homepage to real checkout progress.`,
        details:
          bookingClickEstimate <= 3
            ? "Your booking path is relatively direct for guests who already want to reserve."
            : bookingClickEstimate === 4
              ? "Your booking path is workable, but there is room to reduce steps before guests see real booking progress."
              : "Once booking takes too many steps, comparison shoppers start dropping out before they ever reach checkout.",
        effort: "Medium",
        impact: "High",
        serviceKey: "booking_cta",
      }),
      createCheck({
        id: "availability-visibility",
        name: "Availability visible early",
        category: "Booking & Conversion",
        status: availabilityVisibleEarly ? "pass" : primaryBookingLink ? "fail" : "unknown",
        finding: availabilityVisibleEarly
          ? "Guests can likely see dates or availability early in the booking path."
          : primaryBookingLink
            ? "Availability is not clearly visible early in the booking path."
            : "Unable to verify availability visibility without a reachable booking step.",
        details: availabilityVisibleEarly
          ? "Shoppers can quickly confirm fit before investing effort."
          : "Guests want to know whether you have space before they commit time to forms and date selection.",
        effort: "Medium",
        impact: "High",
        serviceKey: "booking_cta",
      }),
      createCheck({
        id: "fee-transparency",
        name: "Fee transparency",
        category: "Booking & Conversion",
        status: feesVisibleEarly ? "pass" : primaryBookingLink ? "fail" : "unknown",
        finding: feesVisibleEarly
          ? "Fee language appears before or during early booking steps."
          : primaryBookingLink
            ? "No early fee disclosure was detected before checkout steps."
            : "Unable to verify fee transparency without a reachable booking step.",
        details: feesVisibleEarly
          ? "Guests can evaluate the real price earlier, which supports trust."
          : "When fees appear late, guests often feel surprised or misled even if the total price is still acceptable.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "booking_cta",
      }),
      createCheck({
        id: "tracking-pixels",
        name: "Tracking pixels",
        category: "Booking & Conversion",
        status: trackingPixels.length > 0 ? "pass" : "fail",
        finding:
          trackingPixels.length > 0
            ? `Detected ${trackingPixels.join(" and ")}.`
            : "No Facebook Pixel or Google Tag Manager detected.",
        details:
          trackingPixels.length > 0
            ? "Retargeting and campaign attribution are in place."
            : "Without tracking tools, you have no way to remind visitors who almost booked to come back. It's like having a brochure rack with no way to know who picked one up.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "tracking_pixels",
      }),
      createCheck({
        id: "abandonment-recovery-readiness",
        name: "Abandonment recovery readiness",
        category: "Booking & Conversion",
        status: trackingPixels.length > 0 && bookingRecoverySignals ? "pass" : trackingPixels.length > 0 ? "unknown" : "fail",
        finding: trackingPixels.length > 0 && bookingRecoverySignals
          ? "Retargeting pixels and booking-conversion signals were detected."
          : trackingPixels.length > 0
            ? "Retargeting pixels detected, but booking-conversion events could not be verified from source scan."
            : "No reliable abandonment-recovery setup was detected.",
        details: trackingPixels.length > 0 && bookingRecoverySignals
          ? "You are better positioned to bring back guests who leave before booking."
          : trackingPixels.length > 0
            ? "Some booking vendors fire conversion events via hosted checkout, tag rules, or server-side APIs that are not visible in page source. Confirm begin-checkout and booking-complete events in GA4 DebugView and Meta Test Events."
            : "Set up tracking for booking-start and booking-complete events so you can run follow-up ads to unfinished bookers.",
        effort: "Medium",
        impact: "High",
        serviceKey: "tracking_pixels",
      }),
      createCheck({
        id: "newsletter-capture",
        name: "Newsletter capture",
        category: "Booking & Conversion",
        status: newsletterFound ? "pass" : "fail",
        finding: newsletterFound
          ? "An email capture form is present outside the booking widget."
          : "No visible email capture is present outside the booking flow.",
        details:
          newsletterFound
            ? "You have a way to capture interest from guests who are not ready to book yet."
            : "An email list lets you send seasonal deals and updates to people who've already shown interest. Without one, there's no easy way to stay in touch after they leave your site.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "tracking_pixels",
      }),
      createCheck({
        id: "pet-policy",
        name: "Pet policy visibility",
        category: "Outdoor Hospitality Essentials",
        status: petPolicyFound ? "pass" : "fail",
        finding: petPolicyFound
          ? "A pet policy signal was found."
          : "No clear pet policy was found.",
        details:
          petPolicyFound
            ? "Guests traveling with pets can self-qualify more easily."
            : "Unclear pet rules create hesitation and extra pre-booking questions.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "rv-hookup-specs",
        name: "RV hookup specs",
        category: "Outdoor Hospitality Essentials",
        status: rvHookupFound ? "pass" : industry === "campground" ? "fail" : "unknown",
        finding: rvHookupFound
          ? "Hookup specifications were found."
          : industry === "campground"
            ? "No clear hookup specifications were found."
            : "Unable to verify hookup specs for this property type.",
        details:
          rvHookupFound
            ? "Guests can quickly see if your sites match their equipment needs."
            : industry === "campground"
              ? "RV travelers expect to see 30 amp, 50 amp, full hookup, and sewer details before booking."
              : "This check is most important for campground and RV park experiences.",
        weight: rvWeight,
        effort: "Low",
        impact: industry === "campground" ? "High" : "Low",
        serviceKey: "default",
      }),
      createCheck({
        id: "big-rig-readiness",
        name: "Big rig readiness",
        category: "Outdoor Hospitality Essentials",
        status: hasMaxLengthInfo && hasSiteTypeInfo ? "pass" : industry === "campground" ? "fail" : "unknown",
        finding: hasMaxLengthInfo && hasSiteTypeInfo
          ? "Max-length and pull-through/back-in signals were found."
          : industry === "campground"
            ? "Big-rig details are incomplete (max length and/or site type)."
            : "Big-rig readiness is less critical for this property type.",
        details: hasMaxLengthInfo && hasSiteTypeInfo
          ? "Large RV owners can quickly self-qualify before booking."
          : "Add max rig length and pull-through/back-in details where guests choose sites.",
        effort: "Low",
        impact: industry === "campground" ? "High" : "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "wifi-quality-claims",
        name: "Wi-Fi quality clarity",
        category: "Outdoor Hospitality Essentials",
        status: wifiMentioned && wifiQualityMentioned ? "pass" : wifiMentioned ? "unknown" : "fail",
        finding: wifiMentioned && wifiQualityMentioned
          ? "Wi-Fi is mentioned with quality/speed context."
          : wifiMentioned
            ? "Wi-Fi is mentioned, but quality details are unclear."
            : "No clear Wi-Fi quality claim was found.",
        details: wifiMentioned && wifiQualityMentioned
          ? "Guests can better judge if your internet fits their stay needs."
          : "Say whether Wi-Fi is streaming-friendly, remote-work ready, or provide a typical speed range.",
        effort: "Low",
        impact: "High",
        serviceKey: "default",
      }),
      createCheck({
        id: "arrival-directions-clarity",
        name: "Arrival & directions clarity",
        category: "Outdoor Hospitality Essentials",
        status: hasArrivalSection && gpsPitfallWarning ? "pass" : hasArrivalSection ? "unknown" : "fail",
        finding: hasArrivalSection && gpsPitfallWarning
          ? "Arrival instructions include route cautions."
          : hasArrivalSection
            ? "Arrival info exists, but GPS pitfall guidance is unclear."
            : "No clear arrival directions section was found.",
        details: hasArrivalSection && gpsPitfallWarning
          ? "Guests are less likely to arrive frustrated or lost."
          : "Add a short 'Getting Here' section with GPS warnings, entrance tips, and big-rig-safe routing.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "ev-extra-vehicle-policy",
        name: "EV + extra-vehicle policy",
        category: "Outdoor Hospitality Essentials",
        status: hasEvChargingPolicy && hasExtraVehiclePolicy ? "pass" : hasEvChargingPolicy || hasExtraVehiclePolicy ? "unknown" : "fail",
        finding: hasEvChargingPolicy && hasExtraVehiclePolicy
          ? "EV charging and extra-vehicle rules were found."
          : hasEvChargingPolicy || hasExtraVehiclePolicy
            ? "Only part of the modern vehicle policy is visible."
            : "No clear EV charging or extra-vehicle policy was found.",
        details: hasEvChargingPolicy && hasExtraVehiclePolicy
          ? "Guests can plan vehicle logistics without calling first."
          : "Publish clear rules for EV charging and extra vehicles to reduce pre-booking uncertainty.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "amenities-page",
        name: "Amenities visibility",
        category: "Outdoor Hospitality Essentials",
        status: amenitiesFound ? "pass" : "fail",
        finding: amenitiesFound
          ? "Amenities or activities content was found."
          : "No clear amenities or activities content was found.",
        details:
          amenitiesFound
            ? "Guests can see what staying with you actually feels like."
            : "If amenities are hard to find, guests are forced to guess at the value of your stay.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "photos",
      }),
      createCheck({
        id: "cancellation-policy",
        name: "Cancellation policy visibility",
        category: "Outdoor Hospitality Essentials",
        status: cancellationFound ? "pass" : "fail",
        finding: cancellationFound
          ? "Cancellation or refund policy language was found."
          : "No visible cancellation policy language was found.",
        details:
          cancellationFound
            ? "Guests can understand flexibility before committing."
            : "Many guests book months ahead and worry about unexpected life changes. A clear cancellation policy is often what tips someone from 'maybe' to clicking 'Reserve.'",
        effort: "Low",
        impact: "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "visual-trust",
        name: "Visual trust",
        category: "Outdoor Hospitality Essentials",
        status: stockImageCount === 0 && highQualityImageCount >= 6 ? "pass" : stockImageCount > 2 || highQualityImageCount < 4 ? "fail" : "unknown",
        finding: stockImageCount === 0 && highQualityImageCount >= 6
          ? "Photos appear strong and mostly authentic."
          : stockImageCount > 2 || highQualityImageCount < 4
            ? "Visual quality and/or authenticity may be limiting trust."
            : "Visual trust is decent but could be stronger.",
        details: stockImageCount === 0 && highQualityImageCount >= 6
          ? "Guests can picture the real stay with confidence."
          : "Use more real, property-specific photos of sites, facilities, and amenities in good light.",
        weight: photoWeight,
        effort: "Medium",
        impact: "High",
        serviceKey: "photos",
      }),
      createCheck({
        id: "accessibility-statement",
        name: "Accessibility statement",
        category: "Outdoor Hospitality Essentials",
        status: accessibilityFound ? "pass" : "fail",
        finding: accessibilityFound
          ? "Accessibility language or page was found."
          : "No accessibility statement was found.",
        details:
          accessibilityFound
            ? "Accessibility expectations are being acknowledged publicly."
            : "Guests with limited mobility — or those traveling with elderly family — need to know what to expect before driving hours to visit. A statement shows them you thought about their needs.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "default",
      }),
      createCheck({
        id: "meta-title",
        name: "Meta title",
        category: "Local & Online Visibility",
        status: title.length > 0 ? "pass" : "fail",
        finding: title ? `Title found (${title.length} chars).` : "Meta title is missing.",
        details:
          title.length > 0
            ? "Search listings have a usable title."
            : "A missing title weakens visibility and click-through from search.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "meta_tags",
      }),
      createCheck({
        id: "meta-description",
        name: "Meta description",
        category: "Local & Online Visibility",
        status: description.length > 0 ? "pass" : "fail",
        finding: description
          ? `Description found (${description.length} chars).`
          : "Meta description is missing.",
        details:
          description.length > 0
            ? "Search result messaging is present."
            : "A missing description wastes one of the easiest conversion opportunities in search.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "meta_tags",
      }),
      createCheck({
        id: "gbp-sync",
        name: "Google Business Profile",
        category: "Local & Online Visibility",
        status:
          (mapLink || hasEmbeddedMap) && (reviewCount === null || reviewCount >= 15) && (!mapLink || mapReachable)
            ? "pass"
            : "fail",
        finding:
          !mapLink && !hasEmbeddedMap
            ? "No Google Business Profile or map signal was found."
            : reviewCount !== null && reviewCount < 15
              ? `Google review count appears low at ${reviewCount}.`
              : mapLink && !mapReachable
                ? "Google map or profile link appears broken."
                : "Google Business Profile signals were found.",
        details:
          (mapLink || hasEmbeddedMap) && (reviewCount === null || reviewCount >= 15) && (!mapLink || mapReachable)
            ? "Local discovery signals are in place."
            : "When someone searches 'campground near me,' Google shows a map with photos, hours, and reviews. Without a strong Google Business Profile, your park simply won't appear for those searches.",
        effort: "Low",
        impact: "High",
        serviceKey: "google_business",
      }),
      createCheck({
        id: "local-review-competitiveness",
        name: "Local review competitiveness",
        category: "Local & Online Visibility",
        status: reviewCount === null ? "unknown" : reviewCount >= 40 ? "pass" : reviewCount >= 20 ? "unknown" : "fail",
        finding: reviewCount === null
          ? "Review count could not be read from this scan."
          : `Detected about ${reviewCount} Google reviews; benchmark target is 40+ for strong local competitiveness.`,
        details: reviewCount === null
          ? "To compare against nearby parks directly, connect a Places API source. This check currently uses an internal benchmark."
          : reviewCount >= 40
            ? "Your review volume is likely competitive in many local markets."
            : "Build fresh Google reviews consistently to improve local trust and map click-through.",
        effort: "Medium",
        impact: "High",
        serviceKey: "google_business",
      }),
      createCheck({
        id: "social-presence",
        name: "Social media presence",
        category: "Local & Online Visibility",
        status: facebookLink || instagramLink ? "pass" : "fail",
        finding:
          facebookLink || instagramLink
            ? `Detected ${[facebookLink ? "Facebook" : null, instagramLink ? "Instagram" : null].filter(Boolean).join(" and ")}.`
            : "No Facebook or Instagram links were found.",
        details:
          facebookLink || instagramLink
            ? "Guests have additional trust and discovery channels."
            : "Most guests check Facebook or Instagram before booking anywhere. An active, connected social page shows you're real, responsive, and worth the visit.",
        weight: socialWeight,
        effort: "Low",
        impact: industry === "glamping" ? "High" : "Low",
        serviceKey: "social",
      }),
      createCheck({
        id: "onsite-guest-proof",
        name: "On-site guest proof",
        category: "Local & Online Visibility",
        status: onsiteGuestProofVisible ? "pass" : "fail",
        finding: onsiteGuestProofVisible
          ? `Found ${onsiteGuestProofCount} testimonial/review signals on the site.`
          : "No meaningful on-site guest proof was detected.",
        details: onsiteGuestProofVisible
          ? "Guests can see proof from other guests without leaving your site."
          : "Testimonials, visible reviews, and guest quotes reduce uncertainty before visitors leave for Google or OTAs.",
        effort: "Low",
        impact: "High",
        serviceKey: "social",
      }),
      createCheck({
        id: "facebook-link",
        name: "Facebook profile reachability",
        category: "Local & Online Visibility",
        status: !facebookLink ? "unknown" : facebookReachable ? "pass" : "fail",
        finding: !facebookLink
          ? "No Facebook link found."
          : facebookReachable
            ? "Facebook profile link detected on your site."
            : "Facebook link found but the URL appears malformed.",
        details: !facebookLink
          ? "Add a working Facebook link to support social trust."
          : facebookReachable
            ? "Guests can click through to your Facebook page directly from your site."
            : "The Facebook URL on your site appears malformed. Double-check it points to your active page.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "social",
      }),
      createCheck({
        id: "listing-signals",
        name: "Marketplace listing signals",
        category: "Local & Online Visibility",
        status: listingHits > 0 ? "pass" : "fail",
        finding:
          listingHits > 0
            ? `Detected ${listingHits} relevant listing signals.`
            : "No strong outbound marketplace signals were found.",
        details:
          listingHits > 0
            ? "Your site shows signals that suggest marketplace or directory visibility may support discovery."
            : "We did not find strong directory signals on your site. This does not confirm you are missing from those platforms, but it is worth checking The Dyrt, Campendium, Hipcamp, and similar directories manually.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "google_business",
      }),
      createCheck({
        id: "mobile-viewport",
        name: "Mobile viewport meta",
        category: "Mobile Experience",
        status: hasViewport ? "pass" : "fail",
        finding: hasViewport ? "Viewport meta tag detected." : "Viewport meta tag is missing.",
        details:
          hasViewport
            ? "Mobile devices have responsive layout instructions."
            : "Without this setting, your site shows up tiny and zoomed out on smartphones — text too small to read, buttons too small to tap. Most mobile visitors will leave right away.",
        effort: "Low",
        impact: "High",
        serviceKey: "mobile",
      }),
      createCheck({
        id: "mobile-tap-targets",
        name: "Mobile tap-target readiness",
        category: "Mobile Experience",
        status: hasTapFriendlyBookingSignal && hasTapFriendlyCallSignal ? "pass" : hasViewport ? "unknown" : "fail",
        finding: hasTapFriendlyBookingSignal && hasTapFriendlyCallSignal
          ? "Phone users have tap-friendly booking and call actions."
          : hasViewport
            ? "Some key phone actions are present, but tap readiness is incomplete."
            : "Phone layout issues likely make tapping core actions harder.",
        details: hasTapFriendlyBookingSignal && hasTapFriendlyCallSignal
          ? "Guests on phones can act quickly without zooming around."
          : "Make your Book and Call actions large, clear, and easy to tap on phones, especially near the top of the page.",
        effort: "Medium",
        impact: "High",
        serviceKey: "mobile",
      }),
      createCheck({
        id: "phone-conversion-readiness",
        name: "Phone conversion readiness",
        category: "Mobile Experience",
        status: [Boolean(phoneMatch), hasClickableHeaderPhone, callIntentSignal].filter(Boolean).length >= 2 ? "pass" : [Boolean(phoneMatch), hasClickableHeaderPhone, callIntentSignal].filter(Boolean).length === 1 ? "unknown" : "fail",
        finding: `${[Boolean(phoneMatch), hasClickableHeaderPhone, callIntentSignal].filter(Boolean).length} of 3 phone-conversion signals detected.`,
        details: [Boolean(phoneMatch), hasClickableHeaderPhone, callIntentSignal].filter(Boolean).length >= 2
          ? "Guests who prefer calling have a clear and easy path to contact you."
          : "Place a tap-to-call number high on the page and add clear call language like 'Call now for same-day availability.'",
        effort: "Low",
        impact: "High",
        serviceKey: "mobile",
      }),
      createCheck({
        id: "rate-transparency",
        name: "Rate transparency",
        category: "Booking Psychology",
        status: rateTransparency as CheckStatus,
        finding: pricesVisible ? "Pricing is visible on your homepage." : "Pricing is not clearly visible.",
        details: pricesVisible
          ? "Showing rates upfront reduces friction and builds trust. Guests self-qualify without calling."
          : "Hidden prices force visitors to inquire. Add a rates page or show starting prices to keep them on your site.",
        effort: "Low",
        impact: "High",
        serviceKey: "rate_page",
      }),
      createCheck({
        id: "contact-friction",
        name: "Contact friction score",
        category: "Booking Psychology",
        status: contactFrictionScore >= 3 ? "pass" : contactFrictionScore >= 2 ? "unknown" : "fail",
        finding: `${contactFrictionScore} of 4 contact methods available.`,
        details: 
          contactFrictionScore >= 3
            ? "Multiple contact options reduce friction and help different guest types reach you (fast bookers vs researchers)."
            : "Add a header phone number, email link, and/or online booking form so guests can reach you however suits them best.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "booking_cta",
      }),
      createCheck({
        id: "trust-stack-completeness",
        name: "Trust stack completeness",
        category: "Booking Psychology",
        status: trustStackScore >= 3 ? "pass" : trustStackScore === 2 ? "unknown" : "fail",
        finding: `${trustStackScore} of 4 trust signals detected (SSL, secure redirect, cancellation policy, guest proof).`,
        details: trustStackScore >= 3
          ? "Guests can see enough trust cues to feel safer booking."
          : "Add trust basics in visible spots: secure site setup, clear cancellation policy, and recent guest proof.",
        effort: "Low",
        impact: "High",
        serviceKey: "booking_cta",
      }),
      createCheck({
        id: "seasonal-visibility",
        name: "Seasonal & package visibility",
        category: "Booking Psychology",
        status: hasSeasonalPromo ? "pass" : "fail",
        finding: hasSeasonalPromo ? "Deals or seasonal offers are promoted." : "No seasonal or package offers detected.",
        details: hasSeasonalPromo
          ? "Seasonal pricing and deals drive bookings during off-peak periods and from budget-conscious guests."
          : "Add early-bird discounts, off-season rates, group packages, or weekly/monthly specials to increase bookings year-round.",
        effort: "Medium",
        impact: "Medium",
        serviceKey: "rates",
      }),
      createCheck({
        id: "visual-proof-relevance",
        name: "Visual coverage",
        category: "Booking Psychology",
        status: visualProofCategoryScore >= 3 ? "pass" : visualProofCategoryScore === 2 ? "unknown" : "fail",
        finding: `${visualProofCategoryScore} of 4 core proof-photo categories detected (sites, facilities, amenities, arrival/location).`,
        details: visualProofCategoryScore >= 3
          ? "Guests can see the key photos they need to trust what they are booking."
          : "Add real photos for your sites/units, restrooms or bathhouse, amenities, and entrance/location so guests know what to expect.",
        effort: "Medium",
        impact: "High",
        serviceKey: "photos",
      }),
      createCheck({
        id: "payment-flexibility",
        name: "Payment method flexibility",
        category: "Booking Psychology",
        status: paymentMethods >= 1 ? "pass" : "unknown",
        finding: paymentMethods >= 1 ? "Multiple payment methods accepted." : "Payment methods unclear.",
        details: paymentMethods >= 1
          ? "Accepting multiple forms of payment removes final-step friction."
          : "Ensure your booking system accepts credit cards, digital wallets (Apple Pay, Google Pay), and PayPal.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "booking_platform",
      }),
      createCheck({
        id: "structured-data",
        name: "Structured data (Schema.org)",
        category: "Local & Online Visibility",
        status: structuredDataScore >= 2 ? "pass" : structuredDataScore === 1 ? "unknown" : "fail",
        finding: structuredDataScore >= 2
          ? `${structuredDataScore} of 3 structured data signals found (business type, ratings, pricing).`
          : structuredDataScore === 1
            ? "Partial structured data detected, but key signals are missing."
            : "No structured data (Schema.org) was detected.",
        details: structuredDataScore >= 2
          ? "Google can show rich results like star ratings, price ranges, and business details for your property."
          : "Add JSON-LD structured data for your business type (LodgingBusiness or LocalBusiness), aggregate ratings, and price ranges. This helps Google display rich search results that increase click-through.",
        effort: "Medium",
        impact: "High",
        serviceKey: "meta_tags",
      }),
      createCheck({
        id: "accessibility-score",
        name: "Accessibility score",
        category: "Mobile Experience",
        status: accessibilityScore === null ? "unknown" : accessibilityScore >= 80 ? "pass" : accessibilityScore >= 60 ? "unknown" : "fail",
        finding: accessibilityScore !== null
          ? `Lighthouse accessibility score is ${accessibilityScore}/100.`
          : "Accessibility score could not be measured on this scan.",
        details: accessibilityScore === null
          ? "Run the audit again in a moment to get an accessibility score."
          : accessibilityScore >= 80
            ? "Your site meets a strong baseline for guests using screen readers and assistive tools."
            : "Improving color contrast, alt text, form labels, and heading structure helps guests with disabilities and boosts search rankings.",
        effort: "Medium",
        impact: "Medium",
        serviceKey: "mobile",
      }),
    ];


    const categoryScores = (Object.keys(config.categoryWeights) as CheckCategory[]).map((category) => {
      const categoryChecks = checks.filter((check) => check.category === category && check.status !== "unknown");
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
    if (!newsletterFound) {
      lostBookingsEstimate += 3;
      lostRevenueDrivers.push("You are missing a simple way to keep warm leads in your orbit.");
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
