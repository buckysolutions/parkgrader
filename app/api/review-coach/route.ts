import { NextRequest, NextResponse } from "next/server";

type ReviewTone = "friendly" | "professional" | "premium";

type IncomingReview = {
  id?: string;
  rating?: number;
  text?: string;
  authorName?: string;
  createdAt?: string;
  hasOwnerReply?: boolean;
  ownerReplyText?: string;
};

type ReviewCoachPayload = {
  propertyName?: string;
  tone?: ReviewTone;
  reviews?: IncomingReview[];
};

type ThemeDefinition = {
  key: string;
  label: string;
  keywords: string[];
  recommendedUpdate: string;
  replyStrategy: string;
};

type ThemeSummary = {
  key: string;
  label: string;
  count: number;
  affectedReviewIds: string[];
  recommendedUpdate: string;
  replyStrategy: string;
};

const NEGATIVE_CUES = [
  "dirty",
  "smell",
  "rude",
  "slow",
  "broken",
  "refund",
  "unsafe",
  "noisy",
  "overpriced",
  "disappointed",
  "terrible",
  "awful",
  "poor",
  "didn't work",
  "did not work",
  "never again",
];

const POSITIVE_CUES = [
  "clean",
  "friendly",
  "beautiful",
  "great",
  "excellent",
  "amazing",
  "loved",
  "perfect",
  "easy",
  "helpful",
];

const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    key: "cleanliness",
    label: "Cleanliness",
    keywords: ["dirty", "bathroom", "restroom", "trash", "smell", "clean"],
    recommendedUpdate: "Publish visible cleaning frequency standards for bathrooms and shared areas.",
    replyStrategy: "Acknowledge specifics, apologize, and name the immediate cleaning correction.",
  },
  {
    key: "booking",
    label: "Booking Experience",
    keywords: ["booking", "reserve", "reservation", "checkout", "payment", "website"],
    recommendedUpdate: "Clarify booking steps, fees, and cancellation terms on the booking page.",
    replyStrategy: "Confirm the booking issue, provide direct help path, and mention the process fix.",
  },
  {
    key: "staff",
    label: "Staff Experience",
    keywords: ["staff", "service", "host", "manager", "front desk", "rude", "helpful"],
    recommendedUpdate: "Set a response standard for guest-facing communication and escalation.",
    replyStrategy: "Thank the reviewer, own the tone issue, and commit to coaching follow-up.",
  },
  {
    key: "amenities",
    label: "Amenities",
    keywords: ["pool", "wifi", "internet", "hookup", "power", "shower", "amenity"],
    recommendedUpdate: "Update amenity status, quality expectations, and outage notices in one location.",
    replyStrategy: "Acknowledge the amenity gap and explain what was repaired or upgraded.",
  },
  {
    key: "noise",
    label: "Noise & Quiet Hours",
    keywords: ["noise", "loud", "quiet", "music", "night", "sleep"],
    recommendedUpdate: "Reinforce quiet-hours policy and post enforcement expectations before check-in.",
    replyStrategy: "Show empathy for disrupted sleep and state enforcement changes.",
  },
  {
    key: "value",
    label: "Price & Value",
    keywords: ["price", "overpriced", "expensive", "value", "fee", "cost"],
    recommendedUpdate: "Improve rate transparency and include what is covered in each stay option.",
    replyStrategy: "Acknowledge value expectations and clarify what changed or was added.",
  },
];

const normalize = (value: string): string => value.trim().toLowerCase();

const getToneGreeting = (tone: ReviewTone): string => {
  switch (tone) {
    case "premium":
      return "Thank you for sharing this feedback.";
    case "professional":
      return "Thank you for the detailed feedback.";
    default:
      return "Thanks for taking the time to share this with us.";
  }
};

const summarizeSnippet = (text: string): string => {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length <= 180) {
    return value;
  }
  return `${value.slice(0, 177)}...`;
};

const containsAny = (text: string, words: string[]): boolean => words.some((word) => text.includes(word));

const getSentiment = (rating: number, text: string): "positive" | "negative" | "mixed" => {
  const hasNegativeLanguage = containsAny(text, NEGATIVE_CUES);
  const hasPositiveLanguage = containsAny(text, POSITIVE_CUES);

  if (rating <= 2 || (hasNegativeLanguage && !hasPositiveLanguage)) {
    return "negative";
  }

  if (rating >= 4 && hasPositiveLanguage && !hasNegativeLanguage) {
    return "positive";
  }

  return "mixed";
};

const getSafeReviewId = (review: IncomingReview, index: number): string => {
  const id = review.id?.trim();
  if (id) {
    return id;
  }
  return `review-${index + 1}`;
};

const buildFallbackReply = (input: {
  tone: ReviewTone;
  propertyName: string;
  reviewText: string;
  matchedTheme?: ThemeSummary;
}): string => {
  const greeting = getToneGreeting(input.tone);
  const propertyLabel = input.propertyName || "our property";
  const themeSentence = input.matchedTheme
    ? `We've flagged ${input.matchedTheme.label.toLowerCase()} as a priority and are already addressing it.`
    : "We've reviewed your feedback with our team and are acting on it immediately.";

  return [
    greeting,
    `We're sorry your experience at ${propertyLabel} did not meet expectations.`,
    themeSentence,
    "If you're open to it, please contact us directly so we can make this right.",
  ].join(" ");
};

const enhanceRepliesWithGemini = async (input: {
  propertyName: string;
  tone: ReviewTone;
  replyCandidates: Array<{ reviewId: string; draftReply: string; reviewText: string }>;
}): Promise<Record<string, string>> => {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  if (!geminiApiKey || input.replyCandidates.length === 0) {
    return {};
  }

  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
  const compactCandidates = input.replyCandidates.map((candidate) => ({
    reviewId: candidate.reviewId,
    reviewText: summarizeSnippet(candidate.reviewText),
    currentDraft: candidate.draftReply,
  }));

  const prompt = [
    "Rewrite the draft owner replies for public business reviews.",
    "Requirements:",
    "- Keep tone concise and human.",
    "- Do not mention legal threats, refunds, compensation, or discounts.",
    "- Do not invent facts.",
    "- Keep each reply under 85 words.",
    "- Return JSON only in this shape: { \"replies\": [{ \"reviewId\": \"...\", \"reply\": \"...\" }] }.",
    `Business name: ${input.propertyName || "Property"}`,
    `Tone: ${input.tone}`,
    `Candidates: ${JSON.stringify(compactCandidates)}`,
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1200,
        },
      }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  if (!response.ok) {
    return {};
  }

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text) as { replies?: Array<{ reviewId?: string; reply?: string }> };
    const entries = parsed.replies ?? [];
    const next: Record<string, string> = {};

    for (const entry of entries) {
      const id = entry.reviewId?.trim();
      const reply = entry.reply?.trim();
      if (!id || !reply) {
        continue;
      }
      next[id] = reply;
    }

    return next;
  } catch {
    return {};
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReviewCoachPayload;
    const propertyName = body.propertyName?.trim() ?? "your property";
    const tone: ReviewTone = body.tone === "professional" || body.tone === "premium" ? body.tone : "friendly";
    const reviews = Array.isArray(body.reviews) ? body.reviews : [];

    const normalizedReviews = reviews
      .map((review, index) => {
        const text = review.text?.trim() ?? "";
        const rating = Number(review.rating ?? 0);
        const hasOwnerReply = Boolean(review.hasOwnerReply || review.ownerReplyText?.trim());
        return {
          reviewId: getSafeReviewId(review, index),
          rating: Number.isFinite(rating) ? Math.max(1, Math.min(5, rating)) : 0,
          text,
          hasOwnerReply,
          createdAt: review.createdAt?.trim() ?? "",
        };
      })
      .filter((review) => review.text.length > 0 && review.rating > 0);

    if (normalizedReviews.length === 0) {
      return NextResponse.json(
        { message: "Please provide at least one review with text and rating." },
        { status: 400 },
      );
    }

    const themeMap: Record<string, ThemeSummary> = {};
    for (const theme of THEME_DEFINITIONS) {
      themeMap[theme.key] = {
        key: theme.key,
        label: theme.label,
        count: 0,
        affectedReviewIds: [],
        recommendedUpdate: theme.recommendedUpdate,
        replyStrategy: theme.replyStrategy,
      };
    }

    const negativeUnreplied = normalizedReviews
      .filter((review) => review.rating <= 3 && !review.hasOwnerReply)
      .sort((a, b) => a.rating - b.rating);

    for (const review of normalizedReviews) {
      const text = normalize(review.text);
      for (const theme of THEME_DEFINITIONS) {
        if (!theme.keywords.some((keyword) => text.includes(keyword))) {
          continue;
        }
        themeMap[theme.key].count += 1;
        themeMap[theme.key].affectedReviewIds.push(review.reviewId);
      }
    }

    const topIssues = Object.values(themeMap)
      .filter((theme) => theme.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((theme) => ({
        ...theme,
        frequencyPercent: Math.round((theme.count / normalizedReviews.length) * 100),
      }));

    const replyCandidates = negativeUnreplied.slice(0, 5).map((review) => {
      const matchedTheme = topIssues.find((issue) => issue.affectedReviewIds.includes(review.reviewId));
      return {
        reviewId: review.reviewId,
        rating: review.rating,
        reviewSnippet: summarizeSnippet(review.text),
        reason: matchedTheme
          ? `Recurring ${matchedTheme.label.toLowerCase()} concern with no owner response yet.`
          : "Negative review with no owner response yet.",
        draftReply: buildFallbackReply({
          tone,
          propertyName,
          reviewText: review.text,
          matchedTheme,
        }),
      };
    });

    const enhancedReplyMap = await enhanceRepliesWithGemini({
      propertyName,
      tone,
      replyCandidates: replyCandidates.map((candidate) => ({
        reviewId: candidate.reviewId,
        draftReply: candidate.draftReply,
        reviewText: candidate.reviewSnippet,
      })),
    });

    const repliesToPostNow = replyCandidates.map((candidate) => ({
      ...candidate,
      draftReply: enhancedReplyMap[candidate.reviewId] ?? candidate.draftReply,
    }));

    const averageRating =
      normalizedReviews.reduce((sum, review) => sum + review.rating, 0) / normalizedReviews.length;
    const sentimentBreakdown = normalizedReviews.reduce(
      (acc, review) => {
        const sentiment = getSentiment(review.rating, normalize(review.text));
        acc[sentiment] += 1;
        return acc;
      },
      { positive: 0, mixed: 0, negative: 0 },
    );

    const autoReplyCandidates = normalizedReviews
      .filter((review) => review.rating >= 4 && !review.hasOwnerReply)
      .filter((review) => !containsAny(normalize(review.text), NEGATIVE_CUES))
      .slice(0, 10)
      .map((review) => review.reviewId);

    return NextResponse.json({
      summary: {
        totalReviews: normalizedReviews.length,
        averageRating: Number(averageRating.toFixed(2)),
        unansweredReviews: normalizedReviews.filter((review) => !review.hasOwnerReply).length,
        needsReplyNow: repliesToPostNow.length,
        sentimentBreakdown,
      },
      insights: {
        topIssues,
        repliesToPostNow,
        nextBestUpdates: topIssues.map((issue) => issue.recommendedUpdate).slice(0, 3),
      },
      autopilot: {
        eligibleReviewIds: autoReplyCandidates,
        warning:
          "Use approval-first posting for negative or mixed feedback. Autopilot is safest for straightforward 4-5 star praise.",
      },
      meta: {
        tone,
        modelUsed: Object.keys(enhancedReplyMap).length ? (process.env.GEMINI_MODEL || "gemini-2.0-flash-lite") : "fallback-template",
      },
    });
  } catch {
    return NextResponse.json({ message: "Unable to analyze reviews right now." }, { status: 500 });
  }
}