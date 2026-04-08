import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

type StarRating = "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";

type GBPReview = {
  reviewId?: string;
  starRating?: StarRating;
  comment?: string;
  createTime?: string;
  reviewer?: { displayName?: string };
  reviewReply?: { comment?: string };
};

type ReviewsPayload = {
  reviews?: GBPReview[];
  totalReviewCount?: number;
  averageRating?: number;
  error?: { message?: string };
};

const STAR_TO_NUMBER: Record<StarRating, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("gbp_access_token")?.value ?? "";

  if (!accessToken) {
    return NextResponse.json(
      { message: "Not connected to Google Business Profile." },
      { status: 401 },
    );
  }

  const location = request.nextUrl.searchParams.get("location")?.trim() ?? "";
  if (!location) {
    return NextResponse.json({ message: "Missing location parameter." }, { status: 400 });
  }

  const reviewsRes = await fetch(
    `https://mybusiness.googleapis.com/v4/${location}/reviews?pageSize=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!reviewsRes.ok) {
    const status = reviewsRes.status === 401 ? 401 : 502;
    const payload = (await reviewsRes.json().catch(() => ({}))) as ReviewsPayload;
    const baseMessage = payload.error?.message ?? "Failed to fetch reviews from Google.";
    const hint = baseMessage.includes("SERVICE_DISABLED") || baseMessage.includes("not been used")
      ? " Enable Business Profile APIs in Google Cloud and ensure this Google account has access to a location."
      : "";
    return NextResponse.json(
      {
        message:
          status === 401
            ? "Google session expired. Please reconnect."
            : `${baseMessage}${hint}`,
      },
      { status },
    );
  }

  const payload = (await reviewsRes.json()) as ReviewsPayload;
  const reviews = (payload.reviews ?? [])
    .map((review) => ({
      id: review.reviewId ?? "",
      rating: review.starRating ? (STAR_TO_NUMBER[review.starRating] ?? 0) : 0,
      text: review.comment?.trim() ?? "",
      authorName: review.reviewer?.displayName ?? "",
      createdAt: review.createTime ?? "",
      hasOwnerReply: Boolean(review.reviewReply?.comment?.trim()),
      ownerReplyText: review.reviewReply?.comment?.trim() ?? "",
    }))
    .filter((review) => review.rating > 0 && review.text);

  return NextResponse.json({
    reviews,
    totalReviewCount: payload.totalReviewCount ?? reviews.length,
    averageRating: payload.averageRating ?? null,
  });
}
