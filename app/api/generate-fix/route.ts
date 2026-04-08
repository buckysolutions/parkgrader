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

const buildPetPolicyPrompt = (input: {
  url: string;
  industryLabel: string;
  finding: string;
  details: string;
}): string => [
  "You are an expert copywriter for campgrounds, marinas, glamping retreats, and cabin resorts.",
  "Write a complete pet policy that the owner can copy and paste onto their website.",
  "Output only the finished policy text — no preamble, no markdown symbols.",
  "Use a warm, friendly tone that pet owners will appreciate.",
  "",
  "Required sections:",
  "- Which pets are allowed (dogs, cats, size limits if any).",
  "- Leash and supervision rules.",
  "- Where pets can and cannot go (common areas, beach, pool, playground).",
  "- Cleanup responsibilities and any designated pet areas.",
  "- Pet fees (suggest a reasonable nightly or per-stay fee if applicable).",
  "- Aggressive breed or behavior policy.",
  "- Maximum number of pets per site.",
  "- Vaccination and registration requirements.",
  "- Quiet hours for barking.",
  "",
  "Keep it fair to both pet owners and guests without pets.",
  "End with a short welcoming note: 'We love having furry guests!'",
  "",
  `Website: ${input.url}`,
  `Property type: ${input.industryLabel}`,
  `Context: ${input.finding}`,
  `Background: ${input.details}`,
].join("\n\n");

const buildMetaDescriptionPrompt = (input: {
  url: string;
  industryLabel: string;
  finding: string;
  details: string;
}): string => [
  "You are an SEO expert for campgrounds, marinas, glamping retreats, and cabin resorts.",
  "Write exactly 3 meta description options the owner can choose from.",
  "Each must be 140-160 characters and include:",
  "- The property type and a location hint (use the URL domain for clues).",
  "- One compelling reason to click (amenities, experience, value).",
  "- A soft call to action ('Book your stay', 'Reserve today', 'Check availability').",
  "",
  "Format: Number each option 1, 2, 3 on its own line. No markdown symbols.",
  "Write like a human, not a robot. Avoid buzzwords like 'premier' or 'world-class.'",
  "",
  `Website: ${input.url}`,
  `Property type: ${input.industryLabel}`,
  `Context: ${input.finding}`,
  `Background: ${input.details}`,
].join("\n\n");

const buildAccessibilityStatementPrompt = (input: {
  url: string;
  industryLabel: string;
  finding: string;
  details: string;
}): string => [
  "You are an expert copywriter for outdoor hospitality properties.",
  "Write an ADA accessibility statement that the owner can copy and paste onto their website.",
  "Output only the finished text — no preamble, no markdown symbols.",
  "Use warm, honest, helpful language. Don't overpromise.",
  "",
  "Required sections:",
  "- Commitment statement (we strive to make our property accessible).",
  "- What IS accessible: list common accessible features with placeholders in brackets for the owner to fill in (e.g., '[number] ADA-compliant sites/rooms').",
  "- What may be challenging: honestly note that outdoor properties may have terrain limitations.",
  "- How to contact for specific questions (phone and email placeholders).",
  "- Request for advance notice so staff can prepare.",
  "",
  "Keep it under 250 words. Be honest about outdoor property limitations while showing genuine effort.",
  "",
  `Website: ${input.url}`,
  `Property type: ${input.industryLabel}`,
  `Context: ${input.finding}`,
  `Background: ${input.details}`,
].join("\n\n");

const buildArrivalDirectionsPrompt = (input: {
  url: string;
  industryLabel: string;
  finding: string;
  details: string;
}): string => [
  "You are an expert copywriter for outdoor hospitality properties.",
  "Write a 'Getting Here' page that the owner can customize and paste onto their website.",
  "Output only the finished text — no preamble, no markdown symbols.",
  "",
  "Required sections:",
  "- GPS address placeholder: '[Your full street address for GPS]'",
  "- GPS warning: Note that GPS can be unreliable in rural areas and suggest using [specific landmarks or road names] as reference points.",
  "- Big rig routing: Suggest avoiding low bridges, narrow roads. Add placeholder: '[List any roads to avoid for large RVs]'",
  "- Entrance instructions: Where to turn in, what the entrance looks like. Placeholder: '[Describe your entrance/gate]'",
  "- After-hours arrival: What to do if arriving late. Placeholder: '[Your late arrival procedure]'",
  "- Cell service warning if applicable: '[Note cell coverage in your area]'",
  "- Contact for help: 'Call us at [phone] if you get turned around.'",
  "",
  "Use a friendly, helpful tone. Keep it practical.",
  "",
  `Website: ${input.url}`,
  `Property type: ${input.industryLabel}`,
  `Context: ${input.finding}`,
  `Background: ${input.details}`,
].join("\n\n");

const buildAmenitiesPagePrompt = (input: {
  url: string;
  industryLabel: string;
  finding: string;
  details: string;
}): string => [
  "You are an expert copywriter for outdoor hospitality properties.",
  "Write an amenities page that the owner can customize and paste onto their website.",
  "Output only the finished text — no preamble, no markdown symbols.",
  "",
  "Structure it in clear sections with placeholder brackets where the owner needs to fill in details:",
  "- Campsite/Unit types: '[List your site types: tent, RV full hookup, cabin, etc.]'",
  "- Facilities: Restrooms, showers, laundry. '[Describe your facility hours and condition]'",
  "- Recreation: Pool, playground, trails, fishing, etc. '[List your recreation options]'",
  "- Convenience: Store, firewood, ice, dump station. '[List available conveniences]'",
  "- Connectivity: Wi-Fi, cell coverage. '[Describe your connectivity]'",
  "- For Kids: '[List kid-friendly features]'",
  "- For Pets: '[Describe pet areas and rules]'",
  "",
  "Write 1-2 warm sentences per section, then the placeholder.",
  "End with a short invitation: 'Come see what makes [Property Name] special.'",
  "",
  `Website: ${input.url}`,
  `Property type: ${input.industryLabel}`,
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
    const promptInput = { url, industryLabel, checkName, finding, details };
    let prompt: string;
    switch (body.checkId) {
      case "cancellation-policy":
        prompt = buildCancellationPolicyPrompt({ ...promptInput });
        break;
      case "pet-policy":
        prompt = buildPetPolicyPrompt(promptInput);
        break;
      case "meta-description":
        prompt = buildMetaDescriptionPrompt(promptInput);
        break;
      case "accessibility-statement":
        prompt = buildAccessibilityStatementPrompt(promptInput);
        break;
      case "arrival-directions-clarity":
        prompt = buildArrivalDirectionsPrompt(promptInput);
        break;
      case "amenities-page":
        prompt = buildAmenitiesPagePrompt(promptInput);
        break;
      default:
        prompt = buildGenericPrompt(promptInput);
    }

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
