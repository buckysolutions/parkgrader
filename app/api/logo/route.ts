import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch("https://assets.buckysolutions.com/parkgrader_logo.svg", {
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    return new NextResponse("Not found", { status: 404 });
  }

  const svg = await res.text();

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
