"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Tone = "friendly" | "professional" | "premium";

type ParsedReview = {
  id?: string;
  rating?: number;
  text?: string;
  authorName?: string;
  createdAt?: string;
  hasOwnerReply?: boolean;
  ownerReplyText?: string;
};

type ReviewCoachResponse = {
  summary: {
    totalReviews: number;
    averageRating: number;
    unansweredReviews: number;
    needsReplyNow: number;
    sentimentBreakdown: {
      positive: number;
      mixed: number;
      negative: number;
    };
  };
  insights: {
    topIssues: Array<{
      key: string;
      label: string;
      count: number;
      frequencyPercent: number;
      affectedReviewIds: string[];
      recommendedUpdate: string;
      replyStrategy: string;
    }>;
    repliesToPostNow: Array<{
      reviewId: string;
      rating: number;
      reviewSnippet: string;
      reason: string;
      draftReply: string;
    }>;
    nextBestUpdates: string[];
  };
  autopilot: {
    eligibleReviewIds: string[];
    warning: string;
  };
  meta: {
    tone: Tone;
    modelUsed: string;
  };
  message?: string;
};

type GBPLocation = {
  name: string;
  title: string;
  address: string;
};

const sampleReviews = JSON.stringify(
  [
    {
      id: "g-101",
      rating: 2,
      text: "Bathrooms were dirty and wifi kept dropping. Staff was polite but couldn't fix it.",
      authorName: "Alex",
      createdAt: "2026-03-18T11:20:00.000Z",
      hasOwnerReply: false,
    },
    {
      id: "g-102",
      rating: 5,
      text: "Beautiful property and super friendly staff. Easy check-in.",
      authorName: "Jess",
      createdAt: "2026-03-19T16:10:00.000Z",
      hasOwnerReply: false,
    },
    {
      id: "g-103",
      rating: 3,
      text: "Site was fine but booking fees were confusing and checkout felt clunky.",
      authorName: "Maya",
      createdAt: "2026-03-20T09:40:00.000Z",
      hasOwnerReply: false,
    },
  ],
  null,
  2,
);

const parseReviewInput = (raw: string): { reviews: ParsedReview[]; error: string } => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { reviews: [], error: "Please paste at least one review." };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return { reviews: [], error: "Input must be a JSON array of review objects." };
    }

    return { reviews: parsed as ParsedReview[], error: "" };
  } catch {
    return {
      reviews: [],
      error: "Invalid JSON. Paste a JSON array (use the sample format shown).",
    };
  }
};

export default function ReviewCoachPage() {
  const [propertyName, setPropertyName] = useState("Pine Ridge RV Resort");
  const [tone, setTone] = useState<Tone>("friendly");
  const [reviewInput, setReviewInput] = useState(sampleReviews);
  const [result, setResult] = useState<ReviewCoachResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedReplyId, setCopiedReplyId] = useState("");
  const [authStatus, setAuthStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [locations, setLocations] = useState<GBPLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const parsedCount = useMemo(() => {
    const parsed = parseReviewInput(reviewInput);
    return parsed.reviews.length;
  }, [reviewInput]);

  const checkConnection = useCallback(async () => {
    setAuthStatus("checking");
    try {
      const response = await fetch("/api/reviews/locations");
      if (!response.ok) {
        setAuthStatus("disconnected");
        return;
      }
      const payload = (await response.json()) as { locations?: GBPLocation[] };
      const locs = payload.locations ?? [];
      setLocations(locs);
      setAuthStatus("connected");
      if (locs.length > 0) {
        setSelectedLocation((prev) => prev || locs[0].name);
        setPropertyName((prev) => prev || locs[0].title);
      }
    } catch {
      setAuthStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("auth")) {
      window.history.replaceState({}, "", "/review-coach");
    }
    void checkConnection();
  }, [checkConnection]);

  const fetchReviews = async () => {
    if (!selectedLocation) return;
    setIsFetchingReviews(true);
    setFetchError("");
    try {
      const response = await fetch(
        `/api/reviews/fetch?location=${encodeURIComponent(selectedLocation)}`,
      );
      const payload = (await response.json()) as { reviews?: unknown[]; message?: string };
      if (!response.ok) {
        if (response.status === 401) setAuthStatus("disconnected");
        throw new Error(payload.message ?? "Failed to fetch reviews.");
      }
      setReviewInput(JSON.stringify(payload.reviews, null, 2));
      setResult(null);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to fetch reviews.");
    } finally {
      setIsFetchingReviews(false);
    }
  };

  const runAnalysis = async () => {
    setError("");
    setCopiedReplyId("");

    const parsed = parseReviewInput(reviewInput);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/review-coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyName,
          tone,
          reviews: parsed.reviews,
        }),
      });

      const payload = (await response.json()) as ReviewCoachResponse;
      if (!response.ok) {
        throw new Error(payload.message ?? "Review analysis failed.");
      }

      setResult(payload);
    } catch (requestError) {
      setResult(null);
      setError(requestError instanceof Error ? requestError.message : "Review analysis failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyReply = async (reviewId: string, draftReply: string) => {
    try {
      await navigator.clipboard.writeText(draftReply);
      setCopiedReplyId(reviewId);
      window.setTimeout(() => setCopiedReplyId(""), 1800);
    } catch {
      setError("Unable to copy reply to clipboard. Copy manually.");
    }
  };

  return (
    <main className="min-h-screen bg-[#f7fafc] text-[#0A1628]">
      <section className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2DA4A9]">Review Coach V1</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Analyze Reviews and Draft Responses</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#5B6776]">
              Paste real reviews, find recurring issues, and generate reply drafts your team can approve and post.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center border border-[#D4DEE7] bg-white px-4 py-2 text-sm font-medium text-[#0A1628] hover:bg-[#f2f6f9]"
          >
            Back to audit
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border border-[#DCE5EC] bg-white p-5">
            <h2 className="text-lg font-semibold">Input</h2>

            {authStatus === "checking" ? (
              <p className="mt-3 text-xs text-[#5B6776]">Checking Google Business Profile connection...</p>
            ) : authStatus === "disconnected" ? (
              <div className="mt-4 flex items-start gap-4 border border-[#D4DEE7] bg-[#F7FBFC] p-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">Fetch live reviews from Google Business Profile</p>
                  <p className="mt-1 text-xs text-[#5B6776]">Connect your Google account to pull in your real reviews automatically — no copy/paste needed.</p>
                </div>
                <a
                  href="/api/auth/google"
                  className="inline-flex shrink-0 items-center border border-[#D4DEE7] bg-white px-4 py-2 text-sm font-semibold text-[#0A1628] hover:bg-[#e8f0fe]"
                >
                  Connect with Google
                </a>
              </div>
            ) : (
              <div className="mt-4 border border-[#B7DFB9] bg-[#F1F8F1] p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-semibold text-[#2E7D32]">● Connected</span>
                  <select
                    value={selectedLocation}
                    onChange={(event) => {
                      setSelectedLocation(event.target.value);
                      const loc = locations.find((l) => l.name === event.target.value);
                      if (loc) setPropertyName(loc.title);
                    }}
                    className="flex-1 border border-[#B7DFB9] bg-white px-2 py-1 text-xs outline-none focus:border-[#2DA4A9]"
                  >
                    {locations.map((loc) => (
                      <option key={loc.name} value={loc.name}>
                        {loc.title}{loc.address ? ` — ${loc.address}` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={fetchReviews}
                    disabled={isFetchingReviews || !selectedLocation}
                    className="border border-[#2DA4A9] bg-[#2DA4A9] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {isFetchingReviews ? "Fetching..." : "Fetch Reviews"}
                  </button>
                  <a
                    href="/api/auth/google/disconnect"
                    className="text-xs text-[#5B6776] underline hover:text-[#0A1628]"
                  >
                    Disconnect
                  </a>
                </div>
                {fetchError ? <p className="mt-2 text-xs font-medium text-[#A10F2B]">{fetchError}</p> : null}
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-[#314154]">Property name</span>
                <input
                  value={propertyName}
                  onChange={(event) => setPropertyName(event.target.value)}
                  className="w-full border border-[#D4DEE7] bg-[#FBFDFE] px-3 py-2 text-sm outline-none focus:border-[#2DA4A9]"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-[#314154]">Tone</span>
                <select
                  value={tone}
                  onChange={(event) => setTone(event.target.value as Tone)}
                  className="w-full border border-[#D4DEE7] bg-[#FBFDFE] px-3 py-2 text-sm outline-none focus:border-[#2DA4A9]"
                >
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
            </div>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium text-[#314154]">Reviews JSON array</span>
              <textarea
                value={reviewInput}
                onChange={(event) => setReviewInput(event.target.value)}
                rows={16}
                className="w-full border border-[#D4DEE7] bg-[#FBFDFE] px-3 py-3 font-mono text-xs leading-5 outline-none focus:border-[#2DA4A9]"
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#5B6776]">
              <span>Detected review objects: {parsedCount}</span>
              <button
                type="button"
                onClick={() => setReviewInput(sampleReviews)}
                className="border border-[#D4DEE7] bg-white px-2 py-1 font-medium text-[#0A1628] hover:bg-[#f2f6f9]"
              >
                Load sample
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runAnalysis}
                disabled={isLoading}
                className="inline-flex items-center bg-[#0A1628] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isLoading ? "Analyzing..." : "Run Review Coach"}
              </button>
              <p className="text-xs text-[#5B6776]">Uses GEMINI_API_KEY if available; otherwise falls back to templates.</p>
            </div>

            {error ? <p className="mt-4 text-sm font-medium text-[#A10F2B]">{error}</p> : null}
          </div>

          <div className="border border-[#DCE5EC] bg-white p-5">
            <h2 className="text-lg font-semibold">Summary</h2>
            {!result ? (
              <p className="mt-3 text-sm text-[#5B6776]">Run analysis to see issue themes, draft replies, and next best updates.</p>
            ) : (
              <div className="mt-4 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-[#E2E9EF] bg-[#F7FBFC] p-3">
                    <p className="text-xs text-[#5B6776]">Average rating</p>
                    <p className="mt-1 text-xl font-semibold">{result.summary.averageRating}</p>
                  </div>
                  <div className="border border-[#E2E9EF] bg-[#F7FBFC] p-3">
                    <p className="text-xs text-[#5B6776]">Needs reply now</p>
                    <p className="mt-1 text-xl font-semibold">{result.summary.needsReplyNow}</p>
                  </div>
                </div>
                <p className="text-xs text-[#5B6776]">
                  Sentiment: {result.summary.sentimentBreakdown.positive} positive, {result.summary.sentimentBreakdown.mixed} mixed, {result.summary.sentimentBreakdown.negative} negative
                </p>
                <p className="text-xs text-[#5B6776]">
                  Unanswered reviews: {result.summary.unansweredReviews} | Model: {result.meta.modelUsed}
                </p>
                <p className="text-xs text-[#5B6776]">
                  Autopilot candidates: {result.autopilot.eligibleReviewIds.length}
                </p>
              </div>
            )}
          </div>
        </div>

        {result ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="border border-[#DCE5EC] bg-white p-5">
              <h2 className="text-lg font-semibold">Top Recurring Issues</h2>
              <div className="mt-4 space-y-3">
                {result.insights.topIssues.length === 0 ? (
                  <p className="text-sm text-[#5B6776]">No recurring issue clusters detected yet.</p>
                ) : (
                  result.insights.topIssues.map((issue) => (
                    <article key={issue.key} className="border border-[#E2E9EF] bg-[#FBFDFE] p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{issue.label}</p>
                        <span className="text-xs text-[#5B6776]">{issue.count} mentions ({issue.frequencyPercent}%)</span>
                      </div>
                      <p className="mt-2 text-[#314154]">Update: {issue.recommendedUpdate}</p>
                      <p className="mt-1 text-xs text-[#5B6776]">Reply strategy: {issue.replyStrategy}</p>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="border border-[#DCE5EC] bg-white p-5">
              <h2 className="text-lg font-semibold">Replies To Post Now</h2>
              <div className="mt-4 space-y-3">
                {result.insights.repliesToPostNow.length === 0 ? (
                  <p className="text-sm text-[#5B6776]">No urgent reply candidates found.</p>
                ) : (
                  result.insights.repliesToPostNow.map((reply) => (
                    <article key={reply.reviewId} className="border border-[#E2E9EF] bg-[#FBFDFE] p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">Review {reply.reviewId}</p>
                        <span className="text-xs text-[#5B6776]">{reply.rating} stars</span>
                      </div>
                      <p className="mt-2 text-[#314154]">{reply.reviewSnippet}</p>
                      <p className="mt-2 text-xs text-[#5B6776]">{reply.reason}</p>
                      <div className="mt-2 border border-[#D8E2EA] bg-white p-2 text-[#0A1628]">{reply.draftReply}</div>
                      <button
                        type="button"
                        onClick={() => copyReply(reply.reviewId, reply.draftReply)}
                        className="mt-2 border border-[#D4DEE7] bg-white px-3 py-1 text-xs font-medium text-[#0A1628] hover:bg-[#f2f6f9]"
                      >
                        {copiedReplyId === reply.reviewId ? "Copied" : "Copy reply"}
                      </button>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
