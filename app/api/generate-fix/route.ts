import { NextRequest, NextResponse } from "next/server";

type GenerateFixPayload = {
  url?: string;
  industryLabel?: string;
  checkId?: string;
  checkName?: string;
  finding?: string;
  details?: string;
};

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
    const prompt = [
      "You are an expert copywriter for campgrounds, marinas, glamping retreats, and cabin resorts.",
      "Write the actual document or page content the owner can copy and paste directly onto their website.",
      "Output only the finished document text — no preamble, no meta-commentary, no markdown symbols (no **, no ##, no *).",
      "Use plain prose and natural paragraphs. For lists, write them as numbered or dashed lines without asterisks.",
      "Tailor the tone to be warm, professional, and trustworthy — fitting for a hospitality business.",
      `Website: ${url}`,
      `Property type: ${industryLabel}`,
      `Document type: ${checkName}`,
      `Context: ${finding}`,
      `Background: ${details}`,
    ].join("\n\n");

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
