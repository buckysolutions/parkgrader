import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

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
  },
  twitter: {
    card: "summary_large_image",
    title: "ParkGrader | Free Campground Website Audit",
    description:
      "Get a clear report on booking flow, mobile experience, trust signals, and online visibility.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "https://assets.buckysolutions.com/bucky%2Bfavicon%2Bdark.png",
    shortcut: "https://assets.buckysolutions.com/bucky%2Bfavicon%2Bdark.png",
    apple: "https://assets.buckysolutions.com/bucky%2Bfavicon%2Bdark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
