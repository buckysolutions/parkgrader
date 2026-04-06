import { NextRequest, NextResponse } from "next/server";

type CompareRequest = {
  url?: string;
  reportId?: string;
};

type Place = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
};

type PlacesSearchResponse = {
  places?: Place[];
};

const normalizeHost = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = value.startsWith("http://") || value.startsWith("https://")
      ? new URL(value)
      : new URL(`https://${value}`);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    return host || null;
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

const postPlaces = async <T>(
  endpoint: string,
  apiKey: string,
  fieldMask: string,
  body: object,
): Promise<T> => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Google Places request failed.");
  }

  return payload;
};

export async function POST(request: NextRequest) {
  let placesRequestsUsed = 0;
  let reportId = "unknown";
  let hostForLog = "";

  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim() || "";
    if (!apiKey) {
      return NextResponse.json(
        { message: "Places compare is not configured yet. Add GOOGLE_PLACES_API_KEY." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as CompareRequest;
    reportId = body.reportId?.trim() || "unknown";
    const host = normalizeHost(body.url ?? "");
    hostForLog = host ?? "";
    if (!host) {
      return NextResponse.json({ message: "Please provide a valid website URL." }, { status: 400 });
    }

    placesRequestsUsed += 1;
    const textPayload = await postPlaces<PlacesSearchResponse>(
      "https://places.googleapis.com/v1/places:searchText",
      apiKey,
      "places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.websiteUri",
      {
        textQuery: host,
        pageSize: 6,
        languageCode: "en",
      },
    );

    const textPlaces = textPayload.places ?? [];
    const subjectPlace =
      textPlaces.find((place) => hostFromWebsiteUri(place.websiteUri) === host) ?? textPlaces[0];

    const lat = subjectPlace?.location?.latitude;
    const lng = subjectPlace?.location?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") {
      console.info("[places-compare]", JSON.stringify({ reportId, host, placesRequestsUsed, outcome: "no-subject-location" }));
      return NextResponse.json(
        { message: "Could not locate this property in Google Places yet." },
        { status: 422 },
      );
    }

    placesRequestsUsed += 1;
    const nearbyPayload = await postPlaces<PlacesSearchResponse>(
      "https://places.googleapis.com/v1/places:searchNearby",
      apiKey,
      "places.id,places.displayName,places.rating,places.userRatingCount,places.websiteUri",
      {
        includedTypes: ["campground", "rv_park", "lodging", "marina"],
        maxResultCount: 10,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: {
              latitude: lat,
              longitude: lng,
            },
            radius: 4828,
          },
        },
      },
    );

    const nearbyPlaces = (nearbyPayload.places ?? []).filter((place) => {
      if (!place.id || place.id === subjectPlace?.id) {
        return false;
      }

      const competitorHost = hostFromWebsiteUri(place.websiteUri);
      return !competitorHost || competitorHost !== host;
    });

    const competitors = nearbyPlaces
      .filter((place) => typeof place.rating === "number" && typeof place.userRatingCount === "number")
      .slice(0, 3);

    if (competitors.length === 0) {
      console.info("[places-compare]", JSON.stringify({ reportId, host, placesRequestsUsed, outcome: "no-competitors" }));
      return NextResponse.json(
        { message: "Not enough nearby review data yet to compare this property." },
        { status: 422 },
      );
    }

    const competitorAvgRating =
      competitors.reduce((sum, place) => sum + (place.rating ?? 0), 0) / competitors.length;
    const competitorAvgReviews =
      competitors.reduce((sum, place) => sum + (place.userRatingCount ?? 0), 0) / competitors.length;

    const subjectRating = subjectPlace?.rating ?? null;
    const subjectReviews = subjectPlace?.userRatingCount ?? 0;
    const reviewGap = Math.max(0, Math.round(competitorAvgReviews - subjectReviews));
    const weeklyTarget = reviewGap > 0 ? Math.max(1, Math.ceil(reviewGap / 52)) : 0;

    console.info(
      "[places-compare]",
      JSON.stringify({
        reportId,
        host,
        placesRequestsUsed,
        competitorsUsed: competitors.length,
        outcome: "ok",
      }),
    );

    return NextResponse.json({
      subject: {
        name: subjectPlace?.displayName?.text ?? host,
        rating: subjectRating,
        reviewCount: subjectReviews,
      },
      competitors: competitors.map((place) => ({
        name: place.displayName?.text ?? "Nearby competitor",
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? 0,
      })),
      benchmark: {
        averageRating: Number(competitorAvgRating.toFixed(2)),
        averageReviewCount: Math.round(competitorAvgReviews),
        reviewGap,
        weeklyTarget,
      },
      meta: {
        placesRequestsUsed,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to compare local reviews right now.";
    console.info("[places-compare]", JSON.stringify({ reportId, host: hostForLog, placesRequestsUsed, outcome: "error", message }));
    return NextResponse.json({ message }, { status: 500 });
  }
}
