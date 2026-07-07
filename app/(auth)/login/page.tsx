"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

const PARKGRADER_LOGO = "https://assets.buckysolutions.com/parkgrader_logo.svg";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/monitoring");
    router.refresh();
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#F8FAFC]"
      style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img
            src={PARKGRADER_LOGO}
            alt="ParkGrader"
            className="mx-auto h-8 w-auto"
          />
          <p className="mt-3 text-sm text-[#8C97A8]">Sign in to your dashboard</p>
        </div>

        {/* Form card */}
        <div className="glass-card rounded-2xl bg-white p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-sm text-[#DC2626]">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-[#0A1628]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
                style={{ borderRadius: "12px" }}
                className="h-11 w-full border border-[#C4CCD4] bg-white px-4 text-sm text-[#0A1628] placeholder-[#8C97A8] transition focus:border-[#2DA4A9] focus:outline-none focus:ring-2 focus:ring-[#2DA4A9]/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#0A1628]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Your password"
                autoComplete="current-password"
                style={{ borderRadius: "12px" }}
                className="h-11 w-full border border-[#C4CCD4] bg-white px-4 text-sm text-[#0A1628] placeholder-[#8C97A8] transition focus:border-[#2DA4A9] focus:outline-none focus:ring-2 focus:ring-[#2DA4A9]/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-rounded w-full bg-[#2DA4A9] py-2.5 text-sm font-medium text-white transition hover:bg-[#24858A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <div className="mt-6 flex justify-center">
          <a
            href="https://www.buckysolutions.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs text-[#5B6776]"
          >
            Powered by
            <img
              src="https://assets.buckysolutions.com/bucky%2Blogo%2Bwhite.svg"
              alt="Bucky's Solutions"
              className="h-4 w-auto"
              style={{ filter: "brightness(0) saturate(100%) invert(41%) sepia(9%) saturate(735%) hue-rotate(175deg) brightness(92%) contrast(87%)" }}
            />
          </a>
        </div>
      </div>
    </div>
  );
}
