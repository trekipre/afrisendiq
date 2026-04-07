import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://afrisendiq.com";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AfriSendIQ — Compare Diaspora Transfer Providers to Africa",
    template: "%s | AfriSendIQ",
  },
  description:
    "Compare airtime, data, and money transfer providers to Africa. Find the cheapest rates for Côte d'Ivoire, Nigeria, Ghana, Kenya, and Senegal from the diaspora.",
  keywords: [
    "send airtime africa",
    "diaspora transfer providers",
    "recharge mobile afrique",
    "compare airtime rates",
    "envoyer crédit téléphone afrique",
    "AfriSendIQ",
    "Soutrali",
    "Côte d'Ivoire recharge",
  ],
  authors: [{ name: "AfriSendIQ" }],
  creator: "AfriSendIQ",
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: "fr_FR",
    siteName: "AfriSendIQ",
    title: "AfriSendIQ — Compare Diaspora Transfer Providers to Africa",
    description:
      "Compare airtime, data, and money transfer providers to Africa. Find the cheapest rates from the diaspora.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "AfriSendIQ — Compare Diaspora Transfer Providers to Africa",
    description:
      "Compare airtime, data, and money transfer providers to Africa. Find the cheapest rates from the diaspora.",
  },
  alternates: {
    canonical: SITE_URL,
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
  const topNavLinks = [
    { href: "/", label: "Compare" },
    { href: "/cote-divoire", label: "Soutrali CI" },
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
  ];

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[#081711] antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "AfriSendIQ",
              url: SITE_URL,
              description:
                "Compare diaspora transfer providers for airtime, data, electricity, and gift cards to Africa.",
              areaServed: [
                { "@type": "Country", name: "Côte d'Ivoire" },
                { "@type": "Country", name: "Nigeria" },
                { "@type": "Country", name: "Ghana" },
                { "@type": "Country", name: "Kenya" },
                { "@type": "Country", name: "Senegal" },
              ],
              knowsLanguage: ["en", "fr"],
            }),
          }}
        />
        <div className="site-shell flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-white/8 bg-[#07120d]/78 px-4 py-3 backdrop-blur-xl md:px-8">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <Link href="/" className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white shadow-[0_12px_30px_rgba(0,0,0,0.16)] backdrop-blur interactive-lift">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(82,211,166,0.7)]" />
                <span className="font-semibold tracking-[0.14em] uppercase text-emerald-100/92">AfriSendIQ</span>
                <span className="hidden text-emerald-50/62 sm:inline">Diaspora transfers and digital services</span>
              </Link>

              <div className="hidden flex-wrap items-center gap-2 md:flex">
                {topNavLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-emerald-50/86 backdrop-blur transition hover:border-emerald-300/28 hover:bg-white/10 hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <details className="md:hidden">
                <summary className="list-none rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-emerald-50/90 shadow-[0_12px_30px_rgba(0,0,0,0.16)] cursor-pointer">
                  Menu
                </summary>
                <div className="absolute right-4 top-[calc(100%-0.25rem)] mt-3 w-56 rounded-[1.25rem] border border-white/10 bg-[#0a1c15]/95 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.26)] backdrop-blur md:right-8">
                  <div className="grid gap-2">
                    {topNavLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm font-medium text-emerald-50/86 transition hover:bg-white/10"
                      >
                        {link.label}
                      </Link>
                    ))}
                    <a
                      href="mailto:support@afrisendiq.com"
                      className="rounded-xl border border-emerald-300/18 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/16"
                    >
                      Contact support
                    </a>
                  </div>
                </div>
              </details>

              <a
                href="mailto:support@afrisendiq.com"
                className="hidden rounded-full border border-emerald-300/26 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/16 md:inline-flex"
              >
                Support
              </a>
            </div>
          </header>

          <div className="flex-1">{children}</div>

          <footer className="border-t border-white/10 bg-[#06120d] px-6 py-8 text-white md:px-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/78">
                  AfriSendIQ
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-emerald-200/58">
                  <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1">Compare providers</span>
                  <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1">Soutrali CI</span>
                  <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1">Operator-aware fulfillment</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-emerald-50/72">
                  Compare diaspora transfer providers and access digital services for Africa with clearer pricing, execution visibility, and trusted support.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-emerald-50/82">
                <Link
                  href="/terms"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:bg-white/10"
                >
                  Terms of Service
                </Link>
                <Link
                  href="/terms/summary"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:bg-white/10"
                >
                  Terms Summary
                </Link>
                <Link
                  href="/privacy"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:bg-white/10"
                >
                  Privacy Policy
                </Link>
                <a
                  href="mailto:support@afrisendiq.com"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:bg-white/10"
                >
                  support@afrisendiq.com
                </a>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
