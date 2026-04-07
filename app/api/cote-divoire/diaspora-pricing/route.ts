import { getUsdRates } from "@/app/lib/fx"
import { computeOptimalPrice } from "@/app/lib/profitEngine"
import { getLearnedProfitEngineConfigOverride } from "@/app/lib/profitEngineLearning"

/**
 * Diaspora Corridor Pricing API
 *
 * Returns AI-curated "sweet spot" product suggestions for each diaspora
 * corridor (EUR, USD, CAD, GBP) with psychologically-anchored prices.
 *
 * The idea: show the diaspora customer that for a small, familiar amount
 * in their local currency they can make a meaningful impact back home.
 */

type CorridorKey = "EUR" | "USD" | "CAD" | "GBP"

type SweetSpotProduct = {
  id: string
  label: { fr: string; en: string }
  xofValue: number
  category: "airtime" | "data" | "electricity" | "gift-cards"
  emoji: string
  impact: { fr: string; en: string }
}

/**
 * AI-curated product sweet spots — mid-tier products that feel affordable
 * in each corridor currency while delivering real value in Côte d'Ivoire.
 *
 * Psychology: each product is chosen so its corridor price lands on an
 * "anchor-friendly" number (under €5, under $8, under £5, under C$10).
 */
const SWEET_SPOT_PRODUCTS: SweetSpotProduct[] = [
  {
    id: "airtime-2000",
    label: { fr: "Recharge mobile 2 000 F", en: "2,000 F Phone Top-Up" },
    xofValue: 2000,
    category: "airtime",
    emoji: "📱",
    impact: {
      fr: "Votre proche peut appeler pendant plusieurs jours",
      en: "Your loved one can make calls for days"
    }
  },
  {
    id: "data-1gb",
    label: { fr: "Forfait 1 Go internet", en: "1 GB Data Bundle" },
    xofValue: 3000,
    category: "data",
    emoji: "🌐",
    impact: {
      fr: "Assez d'internet pour rester connecté toute la semaine",
      en: "Enough data to stay connected all week"
    }
  },
  {
    id: "airtime-5000",
    label: { fr: "Recharge mobile 5 000 F", en: "5,000 F Phone Top-Up" },
    xofValue: 5000,
    category: "airtime",
    emoji: "💬",
    impact: {
      fr: "Appels et SMS pour le reste du mois",
      en: "Calls and texts for the rest of the month"
    }
  },
  {
    id: "electricity-5000",
    label: { fr: "Électricité CIE 5 000 F", en: "5,000 F CIE Electricity" },
    xofValue: 5000,
    category: "electricity",
    emoji: "💡",
    impact: {
      fr: "Gardez les lumières allumées à la maison",
      en: "Keep the lights on at home"
    }
  },
  {
    id: "data-5gb",
    label: { fr: "Forfait 5 Go internet", en: "5 GB Data Bundle" },
    xofValue: 7500,
    category: "data",
    emoji: "📶",
    impact: {
      fr: "Internet rapide pour travailler et étudier",
      en: "Fast internet for work and school"
    }
  }
]

const CORRIDOR_META: Record<CorridorKey, {
  symbol: string
  flag: string
  name: { fr: string; en: string }
  locale: string // for number formatting
}> = {
  EUR: { symbol: "€", flag: "🇪🇺", name: { fr: "Europe", en: "Europe" }, locale: "fr-FR" },
  USD: { symbol: "$", flag: "🇺🇸", name: { fr: "États-Unis", en: "United States" }, locale: "en-US" },
  CAD: { symbol: "C$", flag: "🇨🇦", name: { fr: "Canada", en: "Canada" }, locale: "en-CA" },
  GBP: { symbol: "£", flag: "🇬🇧", name: { fr: "Royaume-Uni", en: "United Kingdom" }, locale: "en-GB" }
}

function formatCorridorPrice(amount: number, corridor: CorridorKey): string {
  const meta = CORRIDOR_META[corridor]
  // Format with max 2 decimal places, trim trailing zeros
  const formatted = amount.toLocaleString(meta.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${meta.symbol}${formatted}`
}

async function quoteDiasporaCustomerPriceXof(product: SweetSpotProduct, corridor: CorridorKey) {
  const representativeCountryByCorridor: Record<CorridorKey, string> = {
    EUR: "FR",
    USD: "US",
    CAD: "CA",
    GBP: "GB"
  }

  const learnedProfitConfig = await getLearnedProfitEngineConfigOverride({
    fxSpreadCaptureBps: 0
  })

  const pricingDecision = await computeOptimalPrice(
    {
      productId: product.id,
      productType: `diaspora-${product.category}`,
      amount: product.xofValue,
      currency: "XOF",
      paymentCurrency: corridor,
      paymentMethod: "card",
      userCountryCode: representativeCountryByCorridor[corridor]
    },
    {
      getCompetitorPrices: async () => [],
      getProviderCosts: async (productId) => [{
        provider: "catalog",
        productId,
        amount: product.xofValue,
        currency: "XOF",
        providerCost: product.xofValue,
        fetchedAt: new Date().toISOString()
      }]
    },
    learnedProfitConfig ?? {
      fxSpreadCaptureBps: 0
    }
  )

  return pricingDecision
}

export async function GET() {
  try {
    const fxData = await getUsdRates()
    const rates = fxData.rates

    const xofPerUsd = rates.XOF
    if (!xofPerUsd || xofPerUsd <= 0) {
      return Response.json({ success: false, error: "FX rates unavailable" }, { status: 503 })
    }

    const corridors: CorridorKey[] = ["EUR", "USD", "CAD", "GBP"]

    const result = await Promise.all(corridors.map(async (corridor) => {
      const corridorRate = rates[corridor]
      if (!corridorRate || corridorRate <= 0) {
        return {
          corridor,
          ...CORRIDOR_META[corridor],
          xofRate: 0,
          available: false,
          products: []
        }
      }

      // Cross-rate: how many XOF per 1 unit of corridor currency
      // xofPerUnit = xofPerUsd / corridorPerUsd
      const xofPerUnit = xofPerUsd / corridorRate

      const products = await Promise.all(SWEET_SPOT_PRODUCTS.map(async (product) => {
        const pricingDecision = await quoteDiasporaCustomerPriceXof(product, corridor)
        const customerPriceXof = pricingDecision.customerPrice
        // Convert XOF price to corridor currency
        const corridorPrice = customerPriceXof / xofPerUnit

        return {
          ...product,
          customerPriceXof,
          pricingStrategy: pricingDecision.strategy,
          corridorPrice: Math.round(corridorPrice * 100) / 100,
          formattedPrice: formatCorridorPrice(
            Math.round(corridorPrice * 100) / 100,
            corridor
          )
        }
      }))

      // Pick the "hero" product — the one with the most psychological impact.
      // Sweet spot: the product whose corridor price is closest to a "magic"
      // anchor ($5, €5, £4, C$7) — familiar, non-threatening numbers.
      const anchors: Record<CorridorKey, number> = {
        EUR: 5,
        USD: 6,
        CAD: 8,
        GBP: 5
      }
      const anchor = anchors[corridor]
      const hero = [...products].sort(
        (a, b) => Math.abs(a.corridorPrice - anchor) - Math.abs(b.corridorPrice - anchor)
      )[0]

      return {
        corridor,
        ...CORRIDOR_META[corridor],
        xofRate: Math.round(xofPerUnit * 100) / 100,
        available: true,
        heroProduct: hero,
        products
      }
    }))

    return Response.json({
      success: true,
      fxSource: fxData.source,
      fetchedAt: fxData.fetchedAt,
      corridors: result
    })
  } catch {
    return Response.json(
      { success: false, error: "Failed to compute corridor pricing" },
      { status: 500 }
    )
  }
}
