"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand";
import { CoteDIvoireSectionHeading } from "@/app/components/CoteDIvoireSectionHeading";
import { CoteDIvoireLanguageSwitch } from "@/app/components/CoteDIvoireLanguageSwitch";
import { resolveLocalizedText, useCoteDIvoireLocale } from "@/app/components/CoteDIvoireLocale";
import { CoteDIvoireServiceCard } from "@/app/components/CoteDIvoireServiceCard";
import { DiasporaPricingShowcase } from "@/app/components/DiasporaPricingShowcase";
import { ShimmerMetricCard } from "@/app/components/ShimmerMetricCard";
import { coteDivoireVisualAssets as serviceCardAssets } from "@/app/lib/coteDivoireVisualAssets";

type FxRates = Record<string, number> | null;
type ServiceAvailabilityMap = Record<string, { available: boolean; reason?: string }>;

const pageCopy = {
  catalogCta: { fr: "CATALOGUE", en: "View catalog" },
  primaryHeroCta: { fr: "Voir le catalogue", en: "View catalog" },
  tagline: {
    fr: "Avec Soutrali, soutenez la famille au pays sans saigner.",
    en: "With Soutrali, support family back home — without breaking the bank."
  },
  eyebrow: { fr: "Côte d'Ivoire", en: "Côte d'Ivoire" },
  title: {
    fr: "Envoyez vers la Côte d'Ivoire",
    en: "Send to Côte d'Ivoire"
  },
  description: {
    fr: "Recharge mobile, données, cartes cadeaux Jumia et paiement manuel des factures essentielles.",
    en: "Mobile top-up, data bundles, Jumia gift cards, and manual payment for essential bills."
  },
  heroSupport: {
    fr: "Automatisez les recharges et cartes cadeaux, puis passez par un traitement manuel encadré pour CIE, SODECI et Canal+.",
    en: "Use automated flows for top-ups and gift cards, then a controlled manual process for CIE, SODECI, and Canal+."
  },
  heroFeatureFast: { fr: "Parcours plus clair", en: "Clearer flow" },
  heroFeatureBills: { fr: "Automatique + manuel", en: "Automated + manual" },
  heroFeatureTrust: { fr: "Support proche", en: "Support within reach" },
  proofSpeedTitle: { fr: "Livraison rapide", en: "Fast delivery" },
  proofSpeedDetail: { fr: "La plupart des recharges partent en quelques minutes.", en: "Most top-ups are delivered within minutes." },
  proofVerificationTitle: { fr: "Facture vérifiée", en: "Verified bill checks" },
  proofVerificationDetail: { fr: "Nous validons la référence avant d'envoyer au paiement manuel.", en: "We validate the reference before sending a bill to manual payment." },
  proofSupportTitle: { fr: "Support réactif", en: "Responsive support" },
  proofSupportDetail: { fr: "Réponse attendue en quelques heures ouvrées selon le dossier.", en: "Expect a response within a few working hours depending on the case." },
  servicesDescription: {
    fr: "Choisissez le service, le réseau ou la facture à envoyer sans changer d'expérience entre les parcours.",
    en: "Choose the service, network, or bill you want to send without switching to a different experience."
  },
  startAirtime: { fr: "UNITÉS", en: "Airtime" },
  startData: { fr: "CONNEXION", en: "Data" },
  startElectricity: { fr: "CIE COMPTEUR PRÉPAYÉ", en: "CIE Electricity" },
  startSodeci: { fr: "SODECI FACTURE", en: "SODECI Bill" },
  startCiePostpaid: { fr: "CIE FACTURE", en: "CIE Bill" },
  startCanalPlus: { fr: "CANAL+", en: "Canal+" },
  startGiftCards: { fr: "BON D'ACHAT JUMIA", en: "Jumia Gift Card" },
  fxRate: { fr: "Taux de change", en: "Exchange rate" },
  fxRateHint: { fr: "Référence USD vers XOF utilisée sur les parcours de comparaison.", en: "USD to XOF reference used across compare flows." },
  fxUnavailable: { fr: "Indisponible", en: "Unavailable" },
  samplePrice: { fr: "Prix indicatif", en: "Estimated price" },
  waitingFx: { fr: "Chargement...", en: "Loading..." },
  pricingLoadingDetail: { fr: "Mise à jour du taux et de l'estimation en cours.", en: "Refreshing the rate and estimate now." },
  samplePriceDescription: {
    fr: "Estimation pour une recharge de {amount} XOF, frais inclus.",
    en: "Estimate for a {amount} XOF top-up, fees included."
  },
  heroBadge: { fr: "Côte d'Ivoire", en: "Côte d'Ivoire" },
  heroAlt: { fr: "Côte d'Ivoire", en: "Côte d'Ivoire" },
  servicesTitle: { fr: "Nos services", en: "Our services" },
  serviceCards: {
    airtimeTitle: { fr: "RECHARGE MOBILE", en: "Phone Top-Up" },
    airtimeDescription: {
      fr: "Rechargez MTN, Orange et Moov en Côte d'Ivoire.",
      en: "Top up MTN, Orange, and Moov in Côte d'Ivoire."
    },
    available: { fr: "Disponible", en: "Available" },
    dataTitle: { fr: "CONNEXION", en: "Data Bundles" },
    dataDescription: {
      fr: "Forfaits internet MTN, Orange et Moov.",
      en: "MTN, Orange, and Moov data bundles."
    },
    soon: { fr: "Bientôt", en: "Coming soon" },
    electricityTitle: { fr: "CIE COMPTEUR PRÉPAYÉ", en: "CIE Electricity" },
    electricityDescription: {
      fr: "Montant choisi à l'avance, puis exécution manuelle AfriSendIQ.",
      en: "Choose the amount upfront, then AfriSendIQ completes it manually."
    },
    sodeciTitle: { fr: "SODECI FACTURE", en: "SODECI Bill" },
    sodeciDescription: {
      fr: "Facture vérifiée puis paiement manuel suivi par AfriSendIQ.",
      en: "Verified bill, then manual payment tracked by AfriSendIQ."
    },
    ciePostpaidTitle: { fr: "CIE FACTURE", en: "CIE Bill" },
    ciePostpaidDescription: {
      fr: "Facture validée avant paiement puis traitement manuel.",
      en: "Bill validated before payment, then handled manually."
    },
    canalTitle: { fr: "CANAL+", en: "Canal+" },
    canalDescription: {
      fr: "Forfait choisi puis exécution manuelle dans le même dossier.",
      en: "Choose a package, then manual execution in the same request."
    },
    giftTitle: { fr: "BON D'ACHAT JUMIA", en: "Jumia Gift Cards" },
    giftDescription: {
      fr: "Envoyez un bon d'achat Jumia avec code PIN à partager.",
      en: "Send a Jumia voucher with a PIN code to share."
    },
    catalogTitle: { fr: "CATALOGUE", en: "Catalog" },
    catalogDescription: {
      fr: "Parcourez tous les produits disponibles.",
      en: "Browse all available products."
    },
    liveCatalog: { fr: "Disponible", en: "Available" },
    manual: { fr: "Manuel", en: "Manual" },
    ctaLabel: { fr: "Explorer", en: "Explore" },
    ctaSubLabel: { fr: "Ouvrir le service", en: "Open service" }
  }
} satisfies Record<string, unknown>;

export default function CoteDIvoirePage() {
  const [amount] = useState(5000);
  const [fxRates, setFxRates] = useState<FxRates>(null);
  const [fxLoading, setFxLoading] = useState(true);
  const [, setServiceAvailability] = useState<ServiceAvailabilityMap>({
    "phone-top-up": { available: true },
    "data-top-up": { available: true },
    electricity: { available: true },
    sodeci: { available: true },
    "cie-postpaid": { available: true },
    "canal-plus": { available: true },
    "gift-cards": { available: true }
  });
  const { locale } = useCoteDIvoireLocale();

  useEffect(() => {
    async function loadFX() {
      try {
        setFxLoading(true);
        const res = await fetch("/api/fx");
        const data = await res.json();
        setFxRates(data.rates);
      } catch {
        setFxRates(null);
      } finally {
        setFxLoading(false);
      }
    }

    void loadFX();
  }, []);

  useEffect(() => {
    async function loadServiceAvailability() {
      try {
        const response = await fetch("/api/cote-divoire/services");
        const payload = await response.json();

        if (response.ok && payload.success) {
          setServiceAvailability(payload.services);
        }
      } catch {
        setServiceAvailability({
          compare: { available: true },
          "phone-top-up": { available: true }
        });
      }
    }

    void loadServiceAvailability();
  }, []);

  function calculateUSD(amountXOF: number) {
    if (!fxRates?.XOF) {
      return "--";
    }

    const rate = Number(fxRates.XOF);
    const usd = amountXOF / rate;
    let fee = 0;

    if (amountXOF <= 5000) {
      fee = 1.4;
    } else if (amountXOF <= 20000) {
      fee = 1.2;
    } else if (amountXOF <= 100000) {
      fee = 0.8;
    } else {
      fee = 0.6;
    }

    return (usd + fee).toFixed(2);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f6b4f_0%,#0d241c_38%,#081711_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <AfriSendIQBrand className="max-w-xl" />
          <div className="flex flex-wrap items-center gap-3">
            <CoteDIvoireLanguageSwitch />
            <Link href="/cote-divoire/catalog" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-emerald-50 transition hover:bg-white/16">
              {resolveLocalizedText(pageCopy.catalogCta, locale)}
            </Link>
          </div>
        </div>

        {/* ── Hero split: image left, actions right ── */}
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          {/* Hero image — larger, left */}
          <section className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/85 p-4 text-[#0E2E23] shadow-[0_24px_80px_rgba(3,12,9,0.18)]">
            <div className="absolute left-6 top-6 z-10 rounded-full bg-[#0F3D2E] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
              {resolveLocalizedText(pageCopy.heroBadge, locale)}
            </div>
            <div className="relative h-[420px] overflow-hidden rounded-[1.6rem] bg-[linear-gradient(180deg,#f7faf8_0%,#edf5f1_100%)] md:h-[520px]">
              <Image
                src="/Cote d'ivoire Hero.png"
                alt={resolveLocalizedText(pageCopy.heroAlt, locale)}
                fill
                priority
                className="object-contain"
              />
            </div>
          </section>

          {/* Actions panel — right */}
          <section className="flex flex-col justify-between rounded-[2rem] border border-white/12 bg-white/10 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.2)] backdrop-blur">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/82">{resolveLocalizedText(pageCopy.eyebrow, locale)}</div>
              <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
                {resolveLocalizedText(pageCopy.title, locale)}
              </h1>
              <p className="mt-4 text-lg font-medium leading-8 text-white/92 md:text-xl">
                {resolveLocalizedText(pageCopy.tagline, locale)}
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/78">
                {resolveLocalizedText(pageCopy.heroSupport, locale)}
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/78">
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5">{resolveLocalizedText(pageCopy.heroFeatureFast, locale)}</span>
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5">{resolveLocalizedText(pageCopy.heroFeatureBills, locale)}</span>
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5">{resolveLocalizedText(pageCopy.heroFeatureTrust, locale)}</span>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <Link href="/cote-divoire/catalog" className="rounded-full bg-white px-4 py-2.5 font-semibold text-[#0E2E23] transition hover:bg-emerald-50">
                  {resolveLocalizedText(pageCopy.primaryHeroCta, locale)}
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <Link href="/cote-divoire/phone-top-up" className="rounded-full bg-white px-4 py-2 font-semibold text-[#0E2E23] transition hover:bg-emerald-50">
                  {resolveLocalizedText(pageCopy.startAirtime, locale)}
                </Link>
                <Link href="/cote-divoire/data-top-up" className="rounded-full bg-blue-500 px-4 py-2 font-semibold text-white transition hover:bg-blue-400">
                  {resolveLocalizedText(pageCopy.startData, locale)}
                </Link>
                <Link href="/cote-divoire/cie-prepaid" className="rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-amber-100 transition hover:bg-amber-500/25">
                  {resolveLocalizedText(pageCopy.startElectricity, locale)}
                </Link>
                <Link href="/cote-divoire/sodeci" className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-cyan-100 transition hover:bg-cyan-500/25">
                  {resolveLocalizedText(pageCopy.startSodeci, locale)}
                </Link>
                <Link href="/cote-divoire/cie-postpaid" className="rounded-full border border-yellow-400/40 bg-yellow-500/15 px-4 py-2 text-yellow-100 transition hover:bg-yellow-500/25">
                  {resolveLocalizedText(pageCopy.startCiePostpaid, locale)}
                </Link>
                <Link href="/cote-divoire/canal-plus" className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-4 py-2 text-fuchsia-100 transition hover:bg-fuchsia-500/25">
                  {resolveLocalizedText(pageCopy.startCanalPlus, locale)}
                </Link>
                <Link href="/cote-divoire/gift-cards" className="rounded-full border border-pink-400/40 bg-pink-500/15 px-4 py-2 text-pink-100 transition hover:bg-pink-500/25">
                  {resolveLocalizedText(pageCopy.startGiftCards, locale)}
                </Link>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">
                    {resolveLocalizedText(pageCopy.proofSpeedTitle, locale)}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/78">{resolveLocalizedText(pageCopy.proofSpeedDetail, locale)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">
                    {resolveLocalizedText(pageCopy.proofVerificationTitle, locale)}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/78">{resolveLocalizedText(pageCopy.proofVerificationDetail, locale)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">
                    {resolveLocalizedText(pageCopy.proofSupportTitle, locale)}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/78">{resolveLocalizedText(pageCopy.proofSupportDetail, locale)}</p>
                </div>
              </div>
            </div>

            {/* FX stats pinned to bottom of the card */}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {fxLoading ? (
                <ShimmerMetricCard
                  label={resolveLocalizedText(pageCopy.fxRate, locale)}
                  detail={resolveLocalizedText(pageCopy.pricingLoadingDetail, locale)}
                />
              ) : (
                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">{resolveLocalizedText(pageCopy.fxRate, locale)}</div>
                  <div className="mt-2 text-lg font-semibold">
                    {fxRates?.XOF ? `1 USD = ${Number(fxRates.XOF).toFixed(2)} XOF` : resolveLocalizedText(pageCopy.fxUnavailable, locale)}
                  </div>
                  <p className="mt-2 text-sm text-emerald-50/68">{resolveLocalizedText(pageCopy.fxRateHint, locale)}</p>
                </div>
              )}
              {fxLoading ? (
                <ShimmerMetricCard
                  label={resolveLocalizedText(pageCopy.samplePrice, locale)}
                  detail={resolveLocalizedText(pageCopy.pricingLoadingDetail, locale)}
                />
              ) : (
                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">{resolveLocalizedText(pageCopy.samplePrice, locale)}</div>
                  <div className="mt-2 text-lg font-semibold">{calculateUSD(amount) === "--" ? resolveLocalizedText(pageCopy.waitingFx, locale) : `$${calculateUSD(amount)}`}</div>
                  <p className="mt-1 text-sm text-emerald-50/72">{resolveLocalizedText(pageCopy.samplePriceDescription, locale).replace("{amount}", amount.toLocaleString())}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── Diaspora psychological pricing showcase ── */}
        <DiasporaPricingShowcase />

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.12)] backdrop-blur md:p-7">
          <CoteDIvoireSectionHeading
            locale={locale}
            eyebrow={{ fr: "Soutrali services", en: "Soutrali services" }}
            title={pageCopy.servicesTitle}
            description={pageCopy.servicesDescription}
          />

          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <CoteDIvoireServiceCard
              href="/cote-divoire/phone-top-up"
              title={resolveLocalizedText(pageCopy.serviceCards.airtimeTitle, locale)}
              description={resolveLocalizedText(pageCopy.serviceCards.airtimeDescription, locale)}
              eyebrow={resolveLocalizedText(pageCopy.serviceCards.available, locale)}
              theme="airtime"
              brands={["MTN", "ORANGE", "MOOV"]}
              imageSrcs={serviceCardAssets.airtime}
              imageAlt={resolveLocalizedText(pageCopy.serviceCards.airtimeTitle, locale)}
              ctaLabel={resolveLocalizedText(pageCopy.serviceCards.ctaLabel, locale)}
              ctaSubLabel={resolveLocalizedText(pageCopy.serviceCards.ctaSubLabel, locale)}
            />
            <CoteDIvoireServiceCard
              href="/cote-divoire/data-top-up"
              title={resolveLocalizedText(pageCopy.serviceCards.dataTitle, locale)}
              description={resolveLocalizedText(pageCopy.serviceCards.dataDescription, locale)}
              eyebrow={resolveLocalizedText(pageCopy.serviceCards.available, locale)}
              theme="data"
              brands={["MTN", "ORANGE", "MOOV"]}
              imageSrcs={serviceCardAssets.data}
              imageAlt={resolveLocalizedText(pageCopy.serviceCards.dataTitle, locale)}
              ctaLabel={resolveLocalizedText(pageCopy.serviceCards.ctaLabel, locale)}
              ctaSubLabel={resolveLocalizedText(pageCopy.serviceCards.ctaSubLabel, locale)}
            />
            <CoteDIvoireServiceCard
              href="/cote-divoire/cie-prepaid"
              title={resolveLocalizedText(pageCopy.serviceCards.electricityTitle, locale)}
              description={resolveLocalizedText(pageCopy.serviceCards.electricityDescription, locale)}
              eyebrow={resolveLocalizedText(pageCopy.serviceCards.manual, locale)}
              theme="electricity"
              brands={["CIE"]}
              imageSrcs={serviceCardAssets.electricity}
              imageAlt={resolveLocalizedText(pageCopy.serviceCards.electricityTitle, locale)}
              ctaLabel={resolveLocalizedText(pageCopy.serviceCards.ctaLabel, locale)}
              ctaSubLabel={resolveLocalizedText(pageCopy.serviceCards.ctaSubLabel, locale)}
            />
            <CoteDIvoireServiceCard
              href="/cote-divoire/sodeci"
              title={resolveLocalizedText(pageCopy.serviceCards.sodeciTitle, locale)}
              description={resolveLocalizedText(pageCopy.serviceCards.sodeciDescription, locale)}
              eyebrow={resolveLocalizedText(pageCopy.serviceCards.manual, locale)}
              theme="water"
              brands={[locale === "fr" ? "SODECI FACTURE" : "SODECI"]}
              imageSrcs={serviceCardAssets.sodeci}
              imageAlt={resolveLocalizedText(pageCopy.serviceCards.sodeciTitle, locale)}
              ctaLabel={resolveLocalizedText(pageCopy.serviceCards.ctaLabel, locale)}
              ctaSubLabel={resolveLocalizedText(pageCopy.serviceCards.ctaSubLabel, locale)}
            />
            <CoteDIvoireServiceCard
              href="/cote-divoire/cie-postpaid"
              title={resolveLocalizedText(pageCopy.serviceCards.ciePostpaidTitle, locale)}
              description={resolveLocalizedText(pageCopy.serviceCards.ciePostpaidDescription, locale)}
              eyebrow={resolveLocalizedText(pageCopy.serviceCards.manual, locale)}
              theme="electricity"
              brands={[locale === "fr" ? "CIE FACTURE" : "CIE"]}
              imageSrcs={serviceCardAssets.ciePostpaid}
              imageAlt={resolveLocalizedText(pageCopy.serviceCards.ciePostpaidTitle, locale)}
              ctaLabel={resolveLocalizedText(pageCopy.serviceCards.ctaLabel, locale)}
              ctaSubLabel={resolveLocalizedText(pageCopy.serviceCards.ctaSubLabel, locale)}
            />
            <CoteDIvoireServiceCard
              href="/cote-divoire/canal-plus"
              title={resolveLocalizedText(pageCopy.serviceCards.canalTitle, locale)}
              description={resolveLocalizedText(pageCopy.serviceCards.canalDescription, locale)}
              eyebrow={resolveLocalizedText(pageCopy.serviceCards.manual, locale)}
              theme="tv"
              brands={["CANAL+"]}
              imageSrcs={serviceCardAssets.canalPlus}
              imageAlt={resolveLocalizedText(pageCopy.serviceCards.canalTitle, locale)}
              ctaLabel={resolveLocalizedText(pageCopy.serviceCards.ctaLabel, locale)}
              ctaSubLabel={resolveLocalizedText(pageCopy.serviceCards.ctaSubLabel, locale)}
            />
            <CoteDIvoireServiceCard
              href="/cote-divoire/gift-cards"
              title={resolveLocalizedText(pageCopy.serviceCards.giftTitle, locale)}
              description={resolveLocalizedText(pageCopy.serviceCards.giftDescription, locale)}
              eyebrow={resolveLocalizedText(pageCopy.serviceCards.available, locale)}
              theme="gift-cards"
              brands={["JUMIA"]}
              imageSrcs={serviceCardAssets.giftCards}
              imageAlt={resolveLocalizedText(pageCopy.serviceCards.giftTitle, locale)}
              ctaLabel={resolveLocalizedText(pageCopy.serviceCards.ctaLabel, locale)}
              ctaSubLabel={resolveLocalizedText(pageCopy.serviceCards.ctaSubLabel, locale)}
            />
            <CoteDIvoireServiceCard
              href="/cote-divoire/catalog"
              title={resolveLocalizedText(pageCopy.serviceCards.catalogTitle, locale)}
              description={resolveLocalizedText(pageCopy.serviceCards.catalogDescription, locale)}
              eyebrow={resolveLocalizedText(pageCopy.serviceCards.liveCatalog, locale)}
              theme="catalog"
              imageSrcs={serviceCardAssets.catalog}
              imageAlt={resolveLocalizedText(pageCopy.serviceCards.catalogTitle, locale)}
              ctaLabel={resolveLocalizedText(pageCopy.serviceCards.ctaLabel, locale)}
              ctaSubLabel={resolveLocalizedText(pageCopy.serviceCards.ctaSubLabel, locale)}
            />
          </div>
        </section>


      </div>
    </main>
  );
}
