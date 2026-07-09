import type { Metadata } from "next";
import { Sora, DM_Sans } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vtrinedigital.com.br";
const gaId = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Vtrine Digital — Vitrine e catálogo online para vender no WhatsApp",
    template: "%s | Vtrine Digital",
  },
  description:
    "Crie sua vitrine digital e catálogo de produtos em minutos. O cliente escolhe a peça e vai direto pro seu WhatsApp — sem carrinho, sem taxa, sem complicação.",
  keywords: [
    "vitrine digital",
    "vitrine online",
    "catálogo digital",
    "catálogo online",
    "catálogo de produtos",
    "vender pelo whatsapp",
    "loja virtual whatsapp",
    "vtrine",
    "vtrine digital",
    "moda whatsapp",
  ],
  authors: [{ name: "Vtrine Digital" }],
  creator: "Vtrine Digital",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName: "Vtrine Digital",
    title: "Vtrine Digital — Vitrine e catálogo online para vender no WhatsApp",
    description:
      "Crie sua vitrine digital e catálogo de produtos em minutos. O cliente escolhe a peça e vai direto pro seu WhatsApp — sem carrinho, sem taxa, sem complicação.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vtrine Digital — Vitrine e catálogo online para vender no WhatsApp",
    description:
      "Crie sua vitrine digital e catálogo de produtos em minutos. O cliente escolhe a peça e vai direto pro seu WhatsApp.",
    creator: "@vtrinedigital",
  },
  icons: {
    icon: [
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    title: "Vtrine",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${dmSans.variable}`}>
      <body suppressHydrationWarning>
        {children}
        <SpeedInsights />
        {gaId && (
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
      </body>
    </html>
  );
}
