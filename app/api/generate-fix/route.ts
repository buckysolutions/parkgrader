import { NextRequest, NextResponse } from "next/server";

type GenerateFixPayload = {
  url?: string;
  industryLabel?: string;
  checkId?: string;
  checkName?: string;
  finding?: string;
  details?: string;
};

const buildCancellationPolicyPrompt = (input: {
  url: string;
  industryLabel: string;
  checkName: string;
  finding: string;
  details: string;
}): string => [
  "You are an expert copywriter for campgrounds, marinas, glamping retreats, and cabin resorts.",
  "Write the actual website cancellation policy that the owner can copy and paste directly.",
  "Output only the finished policy text with plain language and no markdown symbols.",
  "Use a warm, clear, guest-friendly tone while protecting the business from policy abuse.",
  "Required sections:",
  "- Booking deposit and what portion is non-refundable.",
  "- Cancellation windows with exact outcomes (full refund, partial refund, or credit).",
  "- Reservation modification rules with a hard limit on free changes.",
  "- A rule that frequent or late date changes may be treated as cancellation and rebooking under current rates.",
  "- No-show and early-departure terms.",
  "- Exception policy (severe weather, medical emergencies, or park closure) with manager review language.",
  "- How to cancel (phone/email/portal) and response timing.",
  "- 1 short FAQ block answering: 'Can I change my dates multiple times?' and 'What if I cancel far in advance?'",
  "",
  "Guardrails:",
  "- Prevent loopholes where guests repeatedly modify and then cancel for a near-full refund.",
  "- Keep terms fair and easy to understand.",
  "- Avoid legal jargon.",
  "",
  `Website: ${input.url}`,
  `Property type: ${input.industryLabel}`,
  `Document type: ${input.checkName}`,
  `Context: ${input.finding}`,
  `Background: ${input.details}`,
].join("\n\n");

const buildGenericPrompt = (input: {
  url: string;
  industryLabel: string;
  checkName: string;
  finding: string;
  details: string;
}): string => [
  "You are an expert copywriter for campgrounds, marinas, glamping retreats, and cabin resorts.",
  "Write the actual document or page content the owner can copy and paste directly onto their website.",
  "Output only the finished document text — no preamble, no meta-commentary, no markdown symbols (no **, no ##, no *).",
  "Use plain prose and natural paragraphs. For lists, write them as numbered or dashed lines without asterisks.",
  "Tailor the tone to be warm, professional, and trustworthy — fitting for a hospitality business.",
  `Website: ${input.url}`,
  `Property type: ${input.industryLabel}`,
  `Document type: ${input.checkName}`,
  `Context: ${input.finding}`,
  `Background: ${input.details}`,
].join("\n\n");

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateFixPayload;

    const url = body.url?.trim() ?? "";
    const industryLabel = body.industryLabel?.trim() ?? "outdoor hospitality";
    const checkName = body.checkName?.trim() ?? "Website check";
    const finding = body.finding?.trim() ?? "";
    const details = body.details?.trim() ?? "";

    if (!url || !checkName) {
      return NextResponse.json({ message: "Missing required fix context." }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { message: "AI fixes are not configured yet. Add GEMINI_API_KEY to enable this feature." },
        { status: 503 },
      );
    }

    const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
    const prompt = body.checkId === "cancellation-policy"
      ? buildCancellationPolicyPrompt({ url, industryLabel, checkName, finding, details })
      : buildGenericPrompt({ url, industryLabel, checkName, finding, details });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1400,
          },
        }),
      },
    );

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        { message: payload.error?.message ?? "Failed to generate AI fix." },
        { status: 502 },
      );
    }

    const fix = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!fix) {
      return NextResponse.json({ message: "AI did not return a usable fix draft." }, { status: 502 });
    }

    return NextResponse.json({ fix });
  } catch {
    return NextResponse.json({ message: "Unable to generate AI fix right now." }, { status: 500 });
  }
}
