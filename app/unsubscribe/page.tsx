"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const PARKGRADER_LOGO = "https://assets.buckysolutions.com/parkgrader_logo.svg";

function UnsubscribeContent() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!email || !token) {
      setStatus("error");
      setMessage("Invalid unsubscribe link.");
      return;
    }

    async function unsubscribe() {
      try {
        const res = await fetch("/api/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token }),
        });
        const data = await res.json();
        if (res.ok) {
          setStatus(data.already ? "already" : "success");
          setMessage(data.message);
        } else {
          setStatus("error");
          setMessage(data.error ?? "Something went wrong.");
        }
      } catch {
        setStatus("error");
        setMessage("Network error. Please try again.");
      }
    }

    void unsubscribe();
  }, [email, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <div className="w-full max-w-sm px-4 text-center">
        <img src={PARKGRADER_LOGO} alt="ParkGrader" className="mx-auto h-7 w-auto" />

        <div className="glass-card mt-8 rounded-2xl bg-white p-8">
          {status === "loading" && (
            <div>
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#2DA4A9] border-t-transparent" />
              <p className="mt-4 text-sm text-[#5B6776]">Unsubscribing...</p>
            </div>
          )}

          {status === "success" && (
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E6F7F8]">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#2DA4A9" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 14l6 6L23 7" />
                </svg>
              </div>
              <h1 className="mt-4 text-lg font-semibold tracking-tight text-[#0A1628]">You&rsquo;re unsubscribed</h1>
              <p className="mt-2 text-sm text-[#5B6776]">You will no longer receive monitoring alerts from ParkGrader.</p>
            </div>
          )}

          {status === "already" && (
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[#0A1628]">Already unsubscribed</h1>
              <p className="mt-2 text-sm text-[#5B6776]">This email was already removed from our alerts list.</p>
            </div>
          )}

          {status === "error" && (
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M7 7l14 14M21 7L7 21" />
                </svg>
              </div>
              <h1 className="mt-4 text-lg font-semibold tracking-tight text-[#0A1628]">Something went wrong</h1>
              <p className="mt-2 text-sm text-[#5B6776]">{message}</p>
            </div>
          )}
        </div>

        <a href="/" className="mt-6 inline-block text-sm text-[#2DA4A9] hover:underline">← Back to ParkGrader</a>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2DA4A9] border-t-transparent" />
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
