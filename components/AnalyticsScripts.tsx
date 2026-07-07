"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

export function AnalyticsScripts() {
  const pathname = usePathname();

  // Don't load HubSpot on login page — it tracks form submissions.
  const skipHubSpot = pathname === "/login";

  return (
    <>
      <Script id="hs-conversations-settings" strategy="afterInteractive">
        {`window.hsConversationsSettings = window.hsConversationsSettings || {}; window.hsConversationsSettings.loadImmediately = false;`}
      </Script>
      {!skipHubSpot && (
        <Script
          id="hs-script-loader"
          src="https://js-na2.hs-scripts.com/245580588.js"
          strategy="afterInteractive"
        />
      )}
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');`}
          </Script>
        </>
      )}
    </>
  );
}
