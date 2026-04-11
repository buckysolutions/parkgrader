import type { Metadata } from "next";
import { DM_Sans, Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://parkgrader.com"),
  title: {
    default: "ParkGrader | Free Campground Website Audit",
    template: "%s | ParkGrader",
  },
  description:
    "Audit your campground, RV park, marina, glamping, or cabin website for booking flow, mobile experience, trust signals, and local visibility.",
  keywords: [
    "campground website audit",
    "rv park website audit",
    "marina website audit",
    "glamping marketing",
    "cabin rental website score",
    "website conversion audit",
    "parkgrader",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "ParkGrader",
    title: "ParkGrader | Free Campground Website Audit",
    description:
      "See what is costing your property bookings with a fast website audit tailored for outdoor hospitality businesses.",
    images: [
      {
        url: "https://assets.buckysolutions.com/website-assets/camper-van-on-mountain-road-and-picturesque-view-o-2026-01-09-08-42-00-utc.webp",
        width: 1200,
        height: 630,
        alt: "ParkGrader — Free Campground Website Audit",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ParkGrader | Free Campground Website Audit",
    description:
      "Get a clear report on booking flow, mobile experience, trust signals, and online visibility.",
    images: ["https://assets.buckysolutions.com/website-assets/camper-van-on-mountain-road-and-picturesque-view-o-2026-01-09-08-42-00-utc.webp"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "https://assets.buckysolutions.com/parkgrader_favicon_64x64.png",
    shortcut: "https://assets.buckysolutions.com/parkgrader_favicon_64x64.png",
    apple: "https://assets.buckysolutions.com/parkgrader_favicon_64x64.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", "antialiased", dmSans.variable, "font-sans", geist.variable)}>
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');`}
          </Script>
        </>
      ) : null}
      {META_PIXEL_ID ? (
        <>
          <Script
            src="https://connect.facebook.net/en_US/fbevents.js"
            strategy="lazyOnload"
          />
          <Script id="meta-pixel-init" strategy="lazyOnload">
            {`window.fbq=window.fbq||function(){(window.fbq.q=window.fbq.q||[]).push(arguments)};window._fbq=window.fbq;window.fbq.loaded=true;window.fbq.version='2.0';window.fbq('init','${META_PIXEL_ID}');window.fbq('track','PageView');`}
          </Script>
        </>
      ) : null}
      <body className="min-h-full flex flex-col">
        {children}
        {META_PIXEL_ID ? (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${encodeURIComponent(META_PIXEL_ID)}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        ) : null}
      </body>
    </html>
  );
}
