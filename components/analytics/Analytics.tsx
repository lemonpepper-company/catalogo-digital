"use client";

import Script from "next/script";
import { useCookieConsent } from "./use-cookie-consent";
import { CookieConsentBanner } from "./CookieConsentBanner";

interface AnalyticsProps {
  gaId: string | undefined;
}

export function Analytics({ gaId }: AnalyticsProps) {
  const { consent, hydrated, accept, reject } = useCookieConsent();

  if (!gaId) return null;

  return (
    <>
      {consent === "accepted" && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');
            `}
          </Script>
        </>
      )}
      {hydrated && consent === null && (
        <CookieConsentBanner onAccept={accept} onReject={reject} />
      )}
    </>
  );
}
