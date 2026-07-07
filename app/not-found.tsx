import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden"
      style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#f0f9f8_0%,#e9fdfe_25%,#e6f4f1_50%,#f5f0e8_75%,#fef8f0_100%)]" />
        <div className="absolute -left-32 top-16 h-[360px] w-[360px] rounded-full bg-[#54a2a7]/20 blur-[115px]" />
        <div className="absolute right-[-180px] top-[20%] h-[460px] w-[460px] rounded-full bg-[#00a9ba]/22 blur-[125px]" />
        <div className="absolute bottom-[-180px] left-1/2 h-[460px] w-[680px] -translate-x-1/2 rounded-full bg-[#5abf7e]/20 blur-[135px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.18)_42%,rgba(255,255,255,0.34)_100%)]" />
      </div>

      {/* Content */}
      <div className="relative text-center">
        <p className="text-[120px] font-bold leading-none tracking-tighter text-[#0A1628]/10">
          404
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#0A1628]">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-[#8C97A8]">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="btn-rounded mt-6 inline-block bg-[#2DA4A9] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#24858A]"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
