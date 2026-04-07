"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AfriSendIQBrand } from "./components/AfriSendIQBrand";
import { ProviderLogo } from "./components/ProviderLogo";

type Provider = {
  id: string;
  name: string;
  logo_url: string;
  tagline: string;
  best_for: string;
  availability_summary: string;
  corridor_focus: string;
  payout_networks: string[];
  strengths: string[];

  exchange_rate_score: number;
  exchange_rate: number;

  fee_score: number;
  speed_score: number;
  ease_score: number;
  efficiency_score: number;

  mobile_wallet_speed: number;
  bank_deposit_speed: number;

  referral_link: string;
    sort_order: number;
    active: boolean;
};

type FxRates = Record<string, number> | null;

const currencyMap: Record<string, string> = {
  "Côte d'Ivoire": "XOF",
  Nigeria: "NGN",
  Ghana: "GHS",
  Kenya: "KES",
  Senegal: "XOF",
};

function calculateScore(p: Partial<Provider>) {
  const exchange = Number(p.exchange_rate_score || 0);
  const fee = Number(p.fee_score || 0);
  const speed = Number(p.speed_score || 0);
  const ease = Number(p.ease_score || 0);
  const efficiency = Number(p.efficiency_score || 0);
  return (
  exchange * 0.35 +
  fee * 0.2 +
  speed * 0.2 +
  ease * 0.15 +
  efficiency * 0.1
);
}

const providerUrls: Record<string, string> = {
  "Afriex": "https://www.afriex.com",
  "Send App": "https://send.flutterwave.com",
  "NALA": "https://www.nala.com",
  "Sendvalu": "https://www.sendvalu.com",
  "MoneyGram": "https://www.moneygram.com",
  "XE": "https://www.xe.com/send-money",
  "Taptap Send": "https://www.taptapsend.com",
  "Xoom": "https://www.xoom.com",
  "Lemfi": "https://www.lemfi.com",
  "PayAngel": "https://www.payangel.com",
  "Boss Money": "https://www.bossmoney.com",
  "Sendwave": "https://www.sendwave.com",
  "Remitly": "https://www.remitly.com",
  "Western Union": "https://www.westernunion.com",
  "Ria Money Transfer": "https://www.riamoneytransfer.com",
  "Vianex": "https://www.vianex.com",
};

function getProviderBadge(provider: Provider, ranked: Array<Provider & { final_score: number }>, payoutSorted: Array<Provider & { final_score: number; payout: number }>, fastestMobile?: Provider, fastestBank?: Provider) {
  if (ranked[0]?.id === provider.id) {
    return "Best overall";
  }

  if (payoutSorted[0]?.id === provider.id) {
    return "Highest payout";
  }

  if (fastestMobile?.id === provider.id) {
    return "Fastest wallet";
  }

  if (fastestBank?.id === provider.id) {
    return "Fastest bank";
  }

  return "Verified option";
}

function getProviderUrl(provider: Provider): string {
  return providerUrls[provider.name] || provider.referral_link || "#";
}

export default function Home() {
  const [amount, setAmount] = useState<number>(500);
  const [country, setCountry] = useState<string>("Côte d'Ivoire");
  const [fxRates, setFxRates] = useState<FxRates>(null);

useEffect(() => {
  async function loadFX() {
    const res = await fetch("/api/fx");
    const data = await res.json();
    setFxRates(data.rates);
  }

  void loadFX();
}, []);

  const currentCurrency = currencyMap[country] || "XOF";
  const currentRate = fxRates ? fxRates[currentCurrency] : null;
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerSource, setProviderSource] = useState<"supabase" | "fallback" | null>(null);
  const [providerWarning, setProviderWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);


async function loadProviders(showLoading = true) {
  if (showLoading) {
    setLoading(true);
  }

  try {
    const response = await fetch("/api/providers/transfer-rankings", {
      cache: "no-store"
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      setFetchError(payload.error || "Provider rankings are temporarily unavailable.");
      setProviderSource(null);
      setProviderWarning(null);
      setProviders([]);
      return;
    }

    setFetchError(null);
    setProviderSource(payload.source || null);
    setProviderWarning(payload.warning || null);
    setProviders(payload.providers || []);
  } catch {
    setFetchError("Provider rankings are temporarily unavailable.");
    setProviderSource(null);
    setProviderWarning(null);
    setProviders([]);
  } finally {
    setLoading(false);
  }
}

useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadProviders(false);
  }, 0);

  return () => window.clearTimeout(timer);
}, []);

  const ranked = providers
    .map((p) => ({ ...p, final_score: calculateScore(p) }))
    .sort((a, b) => b.final_score - a.final_score);

  const fastestMobile = ranked.length ? [...ranked].sort(
    (a, b) => (b.mobile_wallet_speed ?? 0) - (a.mobile_wallet_speed ?? 0)
  )[0] : undefined;
  const fastestBank = ranked.length ? [...ranked].sort(
  (a, b) => (b.bank_deposit_speed ?? 0) - (a.bank_deposit_speed ?? 0)
)[0] : undefined;
const rankedWithPayout = ranked.map((provider) => {
  const rate = provider.exchange_rate || 0;
  const payout = amount * rate;

  return {
    ...provider,
    payout,
  };
});
 const payoutSorted = [...rankedWithPayout].sort(
   (a, b) => b.payout - a.payout
 );

 const savings =
   payoutSorted.length > 1
     ? payoutSorted[0].payout - payoutSorted[1].payout
     : 0;
 
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#16634a_0%,#0c1f18_38%,#081711_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/72">
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5">Compare payout quality</span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5">Recharge Côte d&apos;Ivoire</span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5">Clear pricing signals</span>
        </div>

        <div className="mb-10 grid gap-6 lg:grid-cols-[1.25fr_0.9fr] lg:items-end">
          <AfriSendIQBrand variant="hero" className="max-w-2xl" />

          <div className="rounded-[2rem] border border-emerald-300/14 bg-white/10 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.18)] backdrop-blur">
            <p className="text-sm uppercase tracking-[0.22em] text-emerald-200/80">Live corridor check</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">
              Compare transfer payout and speed before you send.
            </h1>
            <p className="mt-3 text-sm leading-6 text-emerald-50/76">
              AfriSendIQ ranks providers by exchange quality, fees, execution speed, and estimated local payout.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <a href="#compare" className="rounded-full border border-white/10 bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/14">
                Start comparing
              </a>
              <a href="#providers" className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 font-medium text-emerald-50 transition hover:bg-emerald-400/16">
                Browse top providers
              </a>
            </div>
          </div>
        </div>

        <Link
          href="/cote-divoire"
          className="interactive-lift mb-8 flex items-center gap-4 rounded-[2rem] border border-emerald-300/14 bg-white/10 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur transition hover:bg-white/14"
        >
          <span className="text-3xl">🇨🇮</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-100">Soutrali — Côte d&apos;Ivoire</p>
            <p className="mt-0.5 text-xs text-emerald-50/70">Airtime, data et cartes cadeaux Jumia en automatique, avec CIE, SODECI et Canal+ en traitement manuel.</p>
          </div>
          <span className="text-emerald-200/60">→</span>
        </Link>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Payment",
              title: "Transparent checkout flow",
              description: "Card payment comes only after quote readiness, so customers are not paying blind for utility bills."
            },
            {
              label: "Fulfillment",
              title: "Operator-verified execution",
              description: "Manual and provider-assisted flows keep live bill validation and execution status visible instead of opaque."
            },
            {
              label: "Support",
              title: "Human help stays reachable",
              description: "Support and internal review paths remain close to the transaction, which matters for diaspora trust."
            }
          ].map((item) => (
            <article key={item.label} className="rounded-[1.5rem] border border-white/10 bg-white/8 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)] backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/78">{item.label}</div>
              <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-50/72">{item.description}</p>
            </article>
          ))}
        </section>

        <div className="sticky top-[4.35rem] z-30 mb-8 md:hidden">
          <div className="flex items-center gap-2 overflow-x-auto rounded-full border border-white/10 bg-[#091711]/88 px-2 py-2 shadow-[0_18px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl">
            {[
              { href: "#compare", label: "Compare" },
              { href: "#snapshot", label: "Snapshot" },
              { href: "#providers", label: "Providers" }
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50/86"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        <div id="compare" className="mb-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] scroll-mt-24">
          <section className="rounded-[2rem] bg-white p-6 text-black shadow-[0_24px_80px_rgba(6,14,11,0.18)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Step 1</div>
                <h2 className="text-2xl font-semibold text-[#0F3D2E]">Transfer Input</h2>
                <p className="mt-1 text-sm text-gray-600">Adjust the amount and corridor, then refresh rankings.</p>
              </div>
              {currentRate && (
                <div className="rounded-full bg-emerald-50 px-4 py-2 text-right text-xs font-medium text-emerald-800">
                  1 USD = {currentRate.toFixed(2)} {currentCurrency}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold">Amount to Send (USD)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                placeholder="Enter amount"
              />
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold">Destination Country</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
              >
                <option>Côte d&apos;Ivoire</option>
                <option>Nigeria</option>
                <option>Ghana</option>
                <option>Kenya</option>
                <option>Senegal</option>
              </select>
            </div>

            <button
              onClick={() => {
                void loadProviders();
              }}
              className="w-full rounded-xl bg-[#0F3D2E] px-4 py-3 font-semibold text-white transition hover:bg-[#15543f]"
            >
              Compare Transfers
            </button>
          </section>

          <section id="snapshot" className="scroll-mt-24 rounded-[2rem] border border-white/12 bg-white/8 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.16)] backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/76">Step 2</div>
            <h2 className="text-xl font-semibold">Snapshot</h2>
            <p className="mt-1 text-sm text-emerald-50/70">
              Send ${amount} to {country} and see which provider leads this corridor.
            </p>

            {providerSource === "fallback" && providerWarning ? (
              <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/12 p-4 text-sm text-amber-50">
                <div className="font-semibold text-amber-100">Demo ranking data in use</div>
                <div className="mt-1 text-amber-50/90">{providerWarning}</div>
              </div>
            ) : null}

            {providers.length > 0 ? (
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Best overall</div>
                  <div className="mt-2 text-lg font-semibold">{ranked[0]?.name}</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Highest payout</div>
                  <div className="mt-2 text-lg font-semibold">{payoutSorted[0]?.name}</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Fastest wallet</div>
                  <div className="mt-2 text-lg font-semibold">{fastestMobile?.name}</div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm text-emerald-50/80">
                Provider summary appears here after rankings load.
              </div>
            )}

            {savings > 0 && (
              <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-400/12 p-4 text-sm text-emerald-50">
                You receive {savings.toLocaleString()} more {currentCurrency} with {payoutSorted[0]?.name} than the next option.
              </div>
            )}
          </section>
        </div>

        {loading && <div className="mb-6 text-center text-sm text-emerald-100/80">Loading providers...</div>}
        {fetchError && <div className="mb-6 text-center text-sm text-red-300">{fetchError}</div>}

        <section id="providers" className="scroll-mt-24">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/76">Step 3</div>
            <h2 className="mt-1 text-2xl font-semibold">Top provider cards</h2>
            <p className="mt-1 text-sm text-emerald-50/70">Scan positioning, payout quality, and strengths without digging through dense tables.</p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-100/82">
            {ranked.length} provider{ranked.length === 1 ? "" : "s"} ranked
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
        {ranked.map((provider, index) => (
          <div
  key={provider.id}
  style={{ animationDelay: `${index * 120}ms` }}
  className="relative animate-cardFade rounded-[1.75rem] bg-white p-6 text-black shadow-[0_18px_40px_rgba(10,30,22,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(10,30,22,0.16)]"
>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                {getProviderBadge(provider, ranked, payoutSorted, fastestMobile, fastestBank)}
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">AI score</div>
                <div className="mt-1 text-lg font-semibold text-[#0F3D2E]">{provider.final_score?.toFixed(2) || "0.00"}</div>
              </div>
            </div>

            <a
              href={getProviderUrl(provider)}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 flex items-center gap-3 group"
            >
              <ProviderLogo src={provider.logo_url} alt={provider.name} />
              <div>
                <h2 className="text-2xl font-bold group-hover:text-[#0F3D2E] transition-colors">{provider.name}</h2>
                {provider.tagline && (
                  <p className="mt-1 text-sm font-medium text-slate-600">{provider.tagline}</p>
                )}
              </div>
            </a>

            {provider.best_for && (
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold text-[#0F3D2E]">Best for:</span> {provider.best_for}
              </div>
            )}

            {provider.payout_networks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {provider.payout_networks.map((network) => (
                  <span key={network} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                    {network}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#F6FBF7] px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Estimated receive</div>
                <div className="mt-1 text-lg font-semibold text-green-700">{(provider.exchange_rate * amount).toLocaleString()} {currencyMap[country]}</div>
              </div>
              <div className="rounded-2xl bg-[#F6FBF7] px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Exchange rate</div>
                <div className="mt-1 text-lg font-semibold text-[#0F3D2E]">{provider.exchange_rate.toFixed(2)}</div>
              </div>
            </div>

            {provider.corridor_focus && (
              <p className="mt-4 mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Corridor focus: {provider.corridor_focus}
              </p>
            )}

            {provider.availability_summary && (
              <p className="mb-3 text-sm leading-6 text-slate-600">{provider.availability_summary}</p>
            )}

            {provider.strengths.length > 0 && (
              <div className="mb-4 rounded-2xl bg-[#F6FBF7] px-4 py-3 text-sm text-slate-700">
                <div className="font-semibold text-[#0F3D2E]">Why it scores well</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {provider.strengths.map((strength) => (
                    <span key={strength} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                      {strength}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Live provider link</div>
              <a
                href={getProviderUrl(provider)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full bg-[#0F3D2E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#15543f]"
              >
                Open provider
              </a>
            </div>
          </div>
        ))}
        </div>
        </section>

        <section className="mt-10 rounded-[2rem] border border-white/12 bg-white/8 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.14)] backdrop-blur">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-emerald-200/76">Legal</p>
              <h2 className="mt-2 text-2xl font-semibold">Transparent terms and privacy, written for real users.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/76">
                Review how Afrisendiq handles platform use, payments, transaction finality, data practices, and compliance before using the service.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/terms" className="rounded-full border border-emerald-300/18 bg-white/10 px-4 py-2 transition hover:bg-white/14">
                Terms of Service
              </Link>
              <Link href="/terms/summary" className="rounded-full border border-emerald-300/18 bg-white/10 px-4 py-2 transition hover:bg-white/14">
                Terms Summary
              </Link>
              <Link href="/privacy" className="rounded-full border border-emerald-300/18 bg-white/10 px-4 py-2 transition hover:bg-white/14">
                Privacy Policy
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}