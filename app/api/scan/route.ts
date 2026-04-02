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
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new URL(value).toString();
    }
    return new URL(`https://${value}`).toString();
  } catch {
    return null;
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
  const normalizedUrl = normalizeUrl(requestedUrl);
  const industry = getIndustry(request.nextUrl.searchParams.get("industry"));
  const validateOnly = request.nextUrl.searchParams.get("validateOnly") === "true";
  const config = industryConfig[industry];

  if (!normalizedUrl) {
    return NextResponse.json({ message: "Please provide a valid URL." }, { status: 400 });
  }

  try {
    const websiteUrl = new URL(normalizedUrl);
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

    const fetchStart = performance.now();
    const homeResponse = await fetchWithTimeout(websiteUrl.toString());
    const responseTimeMs = Math.round(performance.now() - fetchStart);
    if (timingEnabled) {
      phaseTimings.homepageFetch = responseTimeMs;
    }
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
      return NextResponse.json({ ok: true, url: websiteUrl.toString() });
    }

    const pageSpeedApiKey = process.env.PAGESPEED_API_KEY;
    const pageSpeedPromise = pageSpeedApiKey
      ? (async () => {
          let lastError = "PageSpeed API request failed.";

          for (let attempt = 0; attempt < 1; attempt += 1) {
            try {
              const pageSpeedUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
              pageSpeedUrl.searchParams.set("url", websiteUrl.toString());
              pageSpeedUrl.searchParams.set("strategy", "mobile");
              pageSpeedUrl.searchParams.set("category", "performance");
              pageSpeedUrl.searchParams.set("key", pageSpeedApiKey);

              const pageSpeedResponse = await fetchWithTimeout(pageSpeedUrl.toString(), 25000);
              const payload = (await pageSpeedResponse.json()) as {
                lighthouseResult?: {
                  categories?: { performance?: { score?: number } };
                  runtimeError?: { message?: string };
                };
                error?: { message?: string };
              };

              if (!pageSpeedResponse.ok) {
                const normalizedError = normalizePageSpeedError(
                  payload.error?.message ?? `PageSpeed API returned ${pageSpeedResponse.status}.`,
                  pageSpeedResponse.status,
                );
                lastError = normalizedError.message;
                if (!normalizedError.shouldRetry) {
                  break;
                }
              } else {
                const runtimeError = payload.lighthouseResult?.runtimeError?.message;
                const rawScore = payload.lighthouseResult?.categories?.performance?.score;

                if (typeof rawScore === "number" && !Number.isNaN(rawScore)) {
                  return {
                    score: Math.round(rawScore * 100),
                    error: null,
                  };
                }

                if (runtimeError) {
                  lastError = `Lighthouse returned error: ${runtimeError}`;
                } else {
                  lastError = "PageSpeed API did not return a usable performance score.";
                }
              }
            } catch {
              lastError = "PageSpeed API request failed.";
            }
          }

          return {
            score: null,
            error: lastError,
          };
        })()
      : Promise.resolve(null);

    const links = extractAnchors(html);
    const images = extractImages(html);

    const httpVersion = new URL(websiteUrl.toString());
    httpVersion.protocol = "http:";
    const [sslData, httpResponse] = await measure("sslAndRedirectCheck", async () => {
      return Promise.all([
        getSslData(websiteUrl.hostname),
        fetchWithTimeout(httpVersion.toString(), 8000).catch(() => null),
      ]);
    });
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

    const trackingPixels = [
      /fbq\(|connect\.facebook\.net|facebook pixel/i.test(html) ? "Facebook Pixel" : null,
      /googletagmanager\.com|gtag\(|gtm\.js/i.test(html) ? "Google Tag Manager" : null,
    ].filter((value): value is string => Boolean(value));

    const internalLinks = links
      .filter((href) => isInternalLink(href, websiteUrl))
      .map((href) => new URL(href, websiteUrl).toString());
    const uniqueInternalLinks = Array.from(new Set(internalLinks)).slice(0, 6);

    let brokenCount = 0;
    await measure("internalLinkScan", async () => {
      await Promise.all(
        uniqueInternalLinks.map(async (link) => {
          try {
            const response = await fetchWithTimeout(link, 4500);
            if (!response.ok) {
              brokenCount += 1;
            }
          } catch {
            brokenCount += 1;
          }
        }),
      );
    });

    const imageCount = images.length;
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

    let pageSpeedScore: number | null = null;
    let pageSpeedStatus: CheckStatus = "unknown";
    let pageSpeedFinding = "Unable to verify PageSpeed mobile score.";
    let pageSpeedDetails = "Enter a PageSpeed API key to benchmark mobile performance accurately.";

    // Run PageSpeed, Gemini, Facebook, and map reachability checks in parallel.
    let geminiWarmthText = "";
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.0-flash-lite";

    const runGemini = async (): Promise<string> => {
      if (!geminiApiKey || loweredHtml.length <= 200) {
        return "";
      }
      const sentimentPrompt = [
        "Analyze the tone and warmth of this hospitality business homepage copy in one word only.",
        "Respond with ONLY: 'warm' if personal and welcoming, 'cold' if corporate/stiff, or 'neutral' if balanced.",
        "Copy:",
        loweredHtml.slice(0, 5000),
      ].join("\n\n");
      try {
        const geminiResponse = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: sentimentPrompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 20 },
            }),
          },
          8000,
        );
        const geminiPayload = (await geminiResponse.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        return geminiPayload.candidates?.[0]?.content?.parts?.[0]?.text?.toLowerCase() ?? "";
      } catch {
        return "";
      }
    };

    const runFacebookCheck = async (): Promise<boolean> => {
      if (!facebookLink) return false;
      try {
        const response = await fetchWithTimeout(new URL(facebookLink, websiteUrl).toString(), 6000);
        return response.ok;
      } catch {
        return false;
      }
    };

    const runMapCheck = async (): Promise<boolean> => {
      if (!mapLink) return false;
      try {
        const response = await fetchWithTimeout(new URL(mapLink, websiteUrl).toString(), 6000);
        return response.ok;
      } catch {
        return false;
      }
    };

    const [pageSpeedResult, geminiResult, facebookReachable, mapReachable] = await Promise.all([
      pageSpeedPromise,
      measure("geminiToneCheck", runGemini),
      measure("facebookLinkCheck", runFacebookCheck),
      measure("mapLinkCheck", runMapCheck),
    ]);

    geminiWarmthText = geminiResult;

    if (pageSpeedResult && pageSpeedResult.score !== null) {
      pageSpeedScore = pageSpeedResult.score;
      pageSpeedStatus = pageSpeedScore >= 60 ? "pass" : "fail";
      pageSpeedFinding = `Mobile performance score ${pageSpeedScore}.`;
      pageSpeedDetails =
        pageSpeedStatus === "pass"
          ? "Your online experience is loading fast enough for most mobile shoppers."
          : "A slow mobile experience is one of the fastest ways to lose high-intent guests.";
    } else if (pageSpeedApiKey) {
      pageSpeedStatus = "unknown";
      pageSpeedFinding = "Unable to verify PageSpeed mobile score.";
      pageSpeedDetails = pageSpeedResult?.error ?? "PageSpeed API did not return a usable result.";
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

    const gbpPresent = mapReachable && mapLink !== null;
    const hasHipcampLink = links.some((href) => href.toLowerCase().includes("hipcamp"));
    const hasCampendiumLink = links.some((href) => href.toLowerCase().includes("campendium"));
    const hasTheDyrtLink = links.some((href) => href.toLowerCase().includes("thedyrt"));
    const listingPlatformCount = [hasHipcampLink, hasCampendiumLink, hasTheDyrtLink].filter(Boolean).length;
    const gbpFieldsEstimate = gbpPresent ? [mapReachable, reviewCount !== null, phoneMatch !== null, description.length > 50].filter(Boolean).length : 0;
    const listingCompletenessScore = gbpPresent ? gbpFieldsEstimate + listingPlatformCount : 0;

    const pricesVisible = ratesFound || /\$[0-9]|from \$|starting at|per night|nightly/i.test(html);
    const rateTransparency = pricesVisible ? "pass" : "fail";

    const seasonalKeywords = ["early bird", "off-season", "shoulder season", "group rate", "weekly discount", "monthly rate", "special offer", "promo"];
    const hasSeasonalPromo = seasonalKeywords.some((keyword) => loweredHtml.includes(keyword));

    const videoEmbeds = (html.match(/youtube\.com|vimeo\.com|<video/gi) || []).length;
    const visualAssmtScore = imageCount + (videoEmbeds > 0 ? 1 : 0);

    const paymentMethods = [
      /stripe|square\/pay|paypal|apple pay|google pay|amex|visa|mastercard/i.test(html) ? 1 : 0,
      hasClickableHeaderPhone ? 1 : 0,
    ].reduce((sum, val) => sum + val, 0);

    const warmthStatus: CheckStatus = geminiWarmthText.includes("warm") ? "pass" : (geminiWarmthText.includes("cold") || geminiWarmthText.includes("neutral")) ? "fail" : "unknown";

    const checks: Check[] = [
      createCheck({
        id: "ssl-valid",
        name: "SSL certificate",
        category: "Technical Performance",
        status: sslData.valid ? "pass" : "fail",
        finding: sslData.valid
          ? `Certificate valid for ${sslData.daysUntilExpiry} more days.`
          : "SSL certificate is invalid or unavailable.",
        details: sslData.valid
          ? "Secure browsing is in place across your online experience."
          : sslData.error ?? "Visitors will see a 'Not Secure' warning in their browser — most people click away immediately without ever seeing your campground.",
        effort: "Low",
        impact: "High",
        serviceKey: "ssl",
      }),
      createCheck({
        id: "https-redirect",
        name: "HTTPS redirect",
        category: "Technical Performance",
        status: redirectedToHttps ? "pass" : "fail",
        finding: redirectedToHttps
          ? "HTTP requests redirect to HTTPS."
          : "HTTP does not reliably redirect to HTTPS.",
        details: redirectedToHttps
          ? "Guests consistently land on the secure version of your online experience."
          : "Some visitors type your address without 'https://' — they should land on the secure version automatically, but right now that may not be happening.",
        effort: "Low",
        impact: "Medium",
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
        id: "rate-page",
        name: "Rates or pricing visibility",
        category: "Outdoor Hospitality Essentials",
        status: ratesFound ? "pass" : "fail",
        finding: ratesFound
          ? "Pricing or rates signals were found."
          : "No visible pricing or rates signals were found.",
        details:
          ratesFound
            ? "Guests can self-qualify before entering the reservation flow."
            : "When pricing is hidden, many guests abandon rather than inquire.",
        effort: "Low",
        impact: "High",
        serviceKey: "booking_cta",
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
        id: "photo-gallery-quality",
        name: "Photo gallery quality",
        category: "Outdoor Hospitality Essentials",
        status: highQualityImageCount >= 6 ? "pass" : "fail",
        finding:
          highQualityImageCount >= 6
            ? `${highQualityImageCount} strong visual assets were found.`
            : `Only ${highQualityImageCount} strong visual assets were found.`,
        details:
          highQualityImageCount >= 6
            ? "Your digital presence has enough visual content to support conversion."
            : "Guests make up their minds in seconds. Without enough photos, you're asking them to imagine what they're paying for — and most won't take that chance.",
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
            ? "Third-party listing presence appears to support discovery."
            : "If you are not visible where guests browse, your online experience starts behind competitors.",
        effort: "Low",
        impact: "Medium",
        serviceKey: "google_business",
      }),
      createCheck({
        id: "facebook-link",
        name: "Facebook link health",
        category: "Local & Online Visibility",
        status: facebookLink ? (facebookReachable ? "pass" : "fail") : "unknown",
        finding:
          !facebookLink
            ? "Unable to verify Facebook link health because no Facebook link was found."
            : facebookReachable
              ? "Facebook link is reachable."
              : "Facebook link appears broken.",
        details:
          !facebookLink
            ? "This is informational only and does not count against the score."
            : facebookReachable
              ? "Your social profile destination is working."
              : "Broken social links undermine trust and create dead ends.",
        effort: "Low",
        impact: "Low",
        serviceKey: "social",
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
        id: "header-phone",
        name: "Clickable header phone",
        category: "Mobile Experience",
        status: phoneMatch ? (hasClickableHeaderPhone ? "pass" : "fail") : "fail",
        finding:
          !phoneMatch
            ? "No header phone number was found."
            : hasClickableHeaderPhone
              ? "Tap-to-call phone link found in header."
              : "Header phone number is not tap-to-call.",
        details:
          phoneMatch && hasClickableHeaderPhone
            ? "Guests on mobile can contact you instantly."
            : "A mobile visitor should never need to copy and paste a phone number to call.",
        effort: "Low",
        impact: "High",
        serviceKey: "mobile",
      }),
      createCheck({
        id: "image-count",
        name: "Homepage image count",
        category: "Mobile Experience",
        status: imageCount >= 3 ? "pass" : "fail",
        finding: `Homepage includes ${imageCount} images.`,
        details:
          imageCount >= 3
            ? "There is at least a baseline amount of visual content."
            : "Too little visual content can make the online experience feel thin and unconvincing.",
        effort: "Medium",
        impact: "Medium",
        serviceKey: "photos",
      }),
      createCheck({
        id: "listing-completeness",
        name: "Listing completeness score",
        category: "Booking Psychology",
        status: listingCompletenessScore >= 4 ? "pass" : listingCompletenessScore >= 2 ? "unknown" : "fail",
        finding: `${listingCompletenessScore} of 6 signals detected (GBP + 3 platforms).`,
        details: 
          listingCompletenessScore >= 4
            ? "Strong presence across booking platforms means ready-to-book guests can easily find you."
            : "List on Hipcamp, Campendium, and The Dyrt in addition to your Google Business Profile for maximum visibility.",
        effort: "Low",
        impact: "High",
        serviceKey: "listing_signals",
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
        id: "communication-warmth",
        name: "Communication warmth",
        category: "Booking Psychology",
        status: warmthStatus,
        finding: warmthStatus === "pass" 
          ? "Homepage copy feels personal and welcoming."
          : warmthStatus === "fail"
            ? "Homepage copy feels corporate or generic."
            : "Homepage copy tone could not be determined — review for warmth.",
        details: warmthStatus === "pass"
          ? "Personal, warm copy makes guests feel like they'll belong at your property."
          : "Swap generic boilerplate for stories, guest testimonials, or personal touches from your team.",
        effort: "Medium",
        impact: "Medium",
        serviceKey: "meta_description",
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
        id: "visual-storytelling",
        name: "Visual storytelling",
        category: "Booking Psychology",
        status: visualAssmtScore >= 5 ? "pass" : visualAssmtScore >= 3 ? "unknown" : "fail",
        finding: `${imageCount} images and ${videoEmbeds} video(s) found.`,
        details: 
          visualAssmtScore >= 5
            ? "Strong visual content helps guests imagine their stay and feel confident booking."
            : "Add more photography and video. Guests book on emotion—great photos of sites and amenities make the biggest difference.",
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
          host: websiteUrl.hostname,
          totalMs,
          responseTimeMs,
          phaseTimings,
        }),
      );
    }

    return NextResponse.json({
      url: websiteUrl.toString(),
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
      checks,
    });
  } catch (error) {
    const message = normalizeScanError(error);
    return NextResponse.json({ message }, { status: 500 });
  }
}
