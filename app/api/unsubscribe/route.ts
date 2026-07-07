import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/ses";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email: string = (body.email ?? "").toLowerCase().trim();
  const token: string = body.token ?? "";

  if (!email || !token) {
    return NextResponse.json(
      { error: "Email and token are required." },
      { status: 400 },
    );
  }

  if (!verifyUnsubscribeToken(email, token)) {
    return NextResponse.json(
      { error: "Invalid or expired unsubscribe link." },
      { status: 400 },
    );
  }

  const existing = await prisma.unsubscribedEmail.findUnique({
    where: { email },
  });

  if (existing) {
    return NextResponse.json({
      already: true,
      message: "This email is already unsubscribed.",
    });
  }

  await prisma.unsubscribedEmail.create({ data: { email } });

  return NextResponse.json({
    already: false,
    message: "You have been unsubscribed from monitoring alerts.",
  });
}
