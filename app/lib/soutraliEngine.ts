import { recordExecutionTelemetry as recordExecutionTelemetryDefault } from "@/app/lib/executionTelemetry"
import { convertUsdAmount as convertUsdAmountDefault } from "@/app/lib/fx"
import { logTransaction as logTransactionDefault } from "@/app/lib/ledger"
import { sendPurchaseConfirmationSms as sendPurchaseConfirmationSmsDefault } from "@/app/lib/purchaseConfirmation"
import { computeOptimalPrice } from "@/app/lib/profitEngine"
import { getLearnedProfitEngineConfigOverride } from "@/app/lib/profitEngineLearning"
import {
  createSoutraliOrder,
  transitionSoutraliOrder,
  type SoutraliOrder
} from "@/app/lib/soutraliOrderState"
import {
  getProviderTransactionMode,
  inferCiBrandFromPhone,
  listCoteDIvoireCatalog,
  type CoteDIvoireCatalogProduct,
  type CoteDIvoireProvider
} from "@/app/lib/coteDivoireCatalog"
import { sendDTOneTransaction, extractDTOneRechargeCode } from "@/app/lib/dtone"
import { resolveDtOneProductIdForAmount } from "@/app/lib/dtoneCatalog"
import { detectOperator, sendAirtime } from "@/app/providers/reloadly"
import {
  getDingProducts,
  getDingProviders,
  listDingTransferRecords,
  sendDingTransfer,
  type DingProduct,
  type DingProvider,
  type DingTransferRecordItem
} from "@/app/providers/ding"

type SoutraliProductCategory = "airtime" | "data" | "electricity" | "gift-card"

const providerPriorityRank: Record<CoteDIvoireProvider, number> = {
  reloadly: 0,
  ding: 1,
  dtone: 2
}

const dataBundlePresentationOrder: Record<Extract<SoutraliProduct["brand"], "MTN" | "MOOV" | "ORANGE">, string[]> = {
  MTN: [
    "7400 MB Data|30 jours",
    "20000 MB Data|30 jours",
    "3700 MB Data|30 jours",
    "500min + 500 SMS + 6.5Gb|30 jours",
    "250min + 250 SMS + 2.5Gb|30 jours",
    "2200 Mb Data|10 jours",
    "70mins + 100 SMS+ 700 Mb|4 jours"
  ],
  ORANGE: [
    "7.2 GB|30 jours",
    "15 GB|30 jours",
    "3.5 GB|30 jours",
    "36 GB|30 jours"
  ],
  MOOV: [
    "400 mins + 500 SMS + 2.5 Gb|30 jours",
    "20000 MB Data|30 jours",
    "7400 MB Data|30 jours",
    "1660 mins + 1000 SMS + 20 Gb|30 jours",
    "45000 MB Data|30 jours",
    "830 mins + 500 SMS + 8 Gb|30 jours",
    "200 mins + 200 SMS + 2 Gb|30 jours",
    "120 mins + 130 SMS + 1 Gb|15 jours",
    "80 mins + 500 SMS + 500 MB|10 jours",
    "40 mins + 250 SMS + 250 Mb|7 jours"
  ]
}

export type SoutraliProduct = {
  id: string
  name: string
  description: string
  countryCode: "CI"
  category: SoutraliProductCategory
  brand: "MTN" | "MOOV" | "ORANGE" | "CIE" | "JUMIA"
  currency: "XOF"
  amountOptions: number[]
  minAmount: number
  maxAmount: number
  recipientLabel: string
  customerReferenceLabel: string
  serviceLogoPath: string
  dataAllowance?: string
  validity?: string
}

export type SoutraliProviderOffer = {
  provider: CoteDIvoireProvider
  providerLabel: string
  providerProductId: string
  executionMode: "live" | "simulated"
  customerPrice: number
  providerCost: number
  afrisendiqMargin: number
  pricingStrategy?: string
  currency: "XOF"
  score: number
  available: boolean
  reason?: string
  quoteSource: "catalog" | "live"
  metadata?: Record<string, unknown>
}

export type SoutraliQuote = {
  product: SoutraliProduct
  amount: number
  currency: "XOF"
  offers: SoutraliProviderOffer[]
  bestOffer: SoutraliProviderOffer
}

type QuoteInput = {
  productId: string
  amount: number
  customerReference?: string
}

type CheckoutInput = {
  productId?: string
  customerReference?: string
  recipientLabel?: string
  beneficiaryPhoneNumber?: string
  recipientEmail?: string
  amount?: number
  senderName?: string
}

type ConvertUsdAmountResult = Awaited<ReturnType<typeof convertUsdAmountDefault>>

type SoutraliDependencies = {
  convertUsdAmount: typeof convertUsdAmountDefault
  createReference: () => string
  createTraceId: () => string
  detectReloadlyOperator: typeof detectOperator
  getDingProviders: typeof getDingProviders
  getDingProducts: typeof getDingProducts
  sendReloadlyAirtime: typeof sendAirtime
  sendDingTransfer: typeof sendDingTransfer
  sendDTOneTransaction: typeof sendDTOneTransaction
  resolveDtOneProductIdForAmount: typeof resolveDtOneProductIdForAmount
  listDingTransferRecords: typeof listDingTransferRecords
  logTransaction: typeof logTransactionDefault
  recordExecutionTelemetry: typeof recordExecutionTelemetryDefault
  sendPurchaseConfirmationSms: typeof sendPurchaseConfirmationSmsDefault
  simulateProviderExecution: (input: {
    provider: CoteDIvoireProvider
    product: SoutraliProduct
    amount: number
    customerReference: string
    recipientLabel: string
    reference: string
  }) => Promise<Record<string, unknown>>
}

const defaultDependencies: SoutraliDependencies = {
  convertUsdAmount: convertUsdAmountDefault,
  createReference: () => `SOUTRALI-${Date.now()}`,
  createTraceId: () => crypto.randomUUID(),
  detectReloadlyOperator: detectOperator,
  getDingProviders,
  getDingProducts,
  sendReloadlyAirtime: sendAirtime,
  sendDingTransfer,
  sendDTOneTransaction,
  resolveDtOneProductIdForAmount,
  listDingTransferRecords,
  logTransaction: logTransactionDefault,
  recordExecutionTelemetry: recordExecutionTelemetryDefault,
  sendPurchaseConfirmationSms: sendPurchaseConfirmationSmsDefault,
  simulateProviderExecution: async ({ provider, product, amount, customerReference, recipientLabel, reference }) => ({
    reference,
    provider,
    status: "completed",
    mode: "simulated",
    productId: product.id,
    productName: product.name,
    amount,
    customerReference,
    recipientLabel,
    rechargeCode: product.category === "gift-card"
      ? `JCI-${reference.replace(/\D/g, "").slice(-12).padStart(12, "0").replace(/(....)(....)(....)/, "$1-$2-$3")}`
      : undefined,
    completedAt: new Date().toISOString()
  })
}

async function priceSoutraliOffer(
  providerProduct: CoteDIvoireCatalogProduct,
  product: SoutraliProduct,
  amount: number,
  providerCost: number,
  options: {
    paymentCurrency?: string
    paymentMethod?: "card" | "bank_transfer" | "mobile_money" | "wallet_balance" | "crypto" | "manual"
    userCountryCode?: string
  } = {}
) {
  const learnedProfitConfig = await getLearnedProfitEngineConfigOverride({
    fxSpreadCaptureBps: 0
  })
  const pricingDecision = await computeOptimalPrice(
    {
      productId: providerProduct.id,
      productType: `soutrali-${product.category}`,
      amount,
      currency: "XOF",
      paymentCurrency: options.paymentCurrency,
      paymentMethod: options.paymentMethod,
      userCountryCode: options.userCountryCode ?? "CI"
    },
    {
      getCompetitorPrices: async () => [],
      getProviderCosts: async (productId) => [{
        provider: providerProduct.provider,
        productId,
        amount,
        currency: "XOF",
        providerCost,
        fetchedAt: new Date().toISOString()
      }]
    },
    learnedProfitConfig ?? {
      fxSpreadCaptureBps: 0
    }
  )

  return {
    customerPrice: pricingDecision.customerPrice,
    providerCost: pricingDecision.providerCost,
    afrisendiqMargin: pricingDecision.netMarginAfterCosts,
    pricingStrategy: pricingDecision.strategy
  }
}

function isSoutraliBrand(value: string): value is SoutraliProduct["brand"] {
  return value === "MTN" || value === "MOOV" || value === "ORANGE" || value === "CIE" || value === "JUMIA"
}

function intersectAmountOptions(products: CoteDIvoireCatalogProduct[]) {
  if (products.length === 0) {
    return []
  }

  return products.reduce<number[]>((shared, product) => {
    if (shared.length === 0) {
      return [...product.amountOptions]
    }

    return shared.filter((amount) => product.amountOptions.includes(amount))
  }, [])
}

function buildSoutraliProductId(brand: SoutraliProduct["brand"], category: SoutraliProductCategory, allowanceSlug?: string, validitySlug?: string) {
  if (allowanceSlug && validitySlug) {
    return `soutrali-ci-${brand.toLowerCase()}-${category}-${allowanceSlug}-${validitySlug}`
  }
  return `soutrali-ci-${brand.toLowerCase()}-${category}`
}

function getProviderCatalogCandidates(product: SoutraliProduct) {
  return listCoteDIvoireCatalog().filter(
    (candidate) => candidate.countryCode === product.countryCode && candidate.category === product.category && candidate.brand === product.brand
  )
}

function buildDataBundleOrderKey(dataAllowance?: string, validity?: string) {
  return `${dataAllowance ?? ""}|${validity ?? ""}`
}

function sortSoutraliDataProducts(products: SoutraliProduct[]) {
  return [...products].sort((left, right) => {
    const leftOrder = left.brand === "MTN" || left.brand === "MOOV" || left.brand === "ORANGE"
      ? dataBundlePresentationOrder[left.brand]
      : undefined
    const rightOrder = right.brand === "MTN" || right.brand === "MOOV" || right.brand === "ORANGE"
      ? dataBundlePresentationOrder[right.brand]
      : undefined
    const leftRank = leftOrder?.indexOf(buildDataBundleOrderKey(left.dataAllowance, left.validity)) ?? -1
    const rightRank = rightOrder?.indexOf(buildDataBundleOrderKey(right.dataAllowance, right.validity)) ?? -1

    if (left.brand !== right.brand) {
      return left.brand.localeCompare(right.brand)
    }

    if (leftRank !== rightRank) {
      if (leftRank === -1) return 1
      if (rightRank === -1) return -1
      return leftRank - rightRank
    }

    return (left.amountOptions[0] ?? 0) - (right.amountOptions[0] ?? 0)
  })
}

function buildSoutraliProduct(
  brand: SoutraliProduct["brand"],
  candidates: CoteDIvoireCatalogProduct[],
  category: SoutraliProductCategory = "airtime",
  dataAllowance?: string,
  validity?: string
): SoutraliProduct {
  const amountOptions = intersectAmountOptions(candidates)
  const labelMap: Record<SoutraliProductCategory, string> = { airtime: "Unités", data: "Data", electricity: "Electricity", "gift-card": "Gift Card" }
  const label = labelMap[category] || "Airtime"
  const allowanceSlug = dataAllowance ? dataAllowance.toLowerCase().replace(/\s+/g, "") : undefined
  const validitySlug = validity ? validity.replace(/\s+/g, "") : undefined
  const isCiePrepaidElectricity = category === "electricity" && brand === "CIE"
  const productName = dataAllowance
    ? `Soutrali ${brand} ${dataAllowance} — ${validity}`
    : isCiePrepaidElectricity
      ? "Soutrali CIE Compteur Prépayé"
      : `Soutrali ${brand} CI ${label}`
  const customerReferenceLabel = isCiePrepaidElectricity
    ? "Numéro du Compteur Prépayé CIE"
    : category === "electricity"
      ? "CIE account or meter reference"
      : category === "gift-card"
        ? "Customer reference"
        : "Recipient phone"
  const recipientLabel = isCiePrepaidElectricity
    ? customerReferenceLabel
    : category === "electricity"
      ? "Account or meter holder"
      : category === "gift-card"
        ? "Recipient name or email"
        : "Recipient phone"
  const description = dataAllowance
    ? `${dataAllowance} data bundle valid for ${validity}.`
    : isCiePrepaidElectricity
      ? "Rechargez le compteur prépayé CIE en Côte d'Ivoire."
      : `Soutrali ${label.toLowerCase()} product for ${brand} Côte d'Ivoire.`

  const base: SoutraliProduct = {
    id: buildSoutraliProductId(brand, category, allowanceSlug, validitySlug),
    name: productName,
    description,
    countryCode: "CI",
    category,
    brand,
    currency: "XOF",
    amountOptions,
    minAmount: Math.min(...amountOptions),
    maxAmount: Math.max(...amountOptions),
    serviceLogoPath: candidates[0]?.serviceLogoPath || "/logos/afrisendiq-logo-96.png",
    recipientLabel,
    customerReferenceLabel
  }

  if (dataAllowance) {
    base.dataAllowance = dataAllowance
  }
  if (validity) {
    base.validity = validity
  }

  return base
}

export function listSoutraliProducts(category?: SoutraliProductCategory) {
  const categories: SoutraliProductCategory[] = category ? [category] : ["airtime", "data", "gift-card"]

  return categories.flatMap((cat) => {
    const catalog = listCoteDIvoireCatalog().filter((product) => product.category === cat && isSoutraliBrand(product.brand))

    if (cat === "data") {
      const grouped = new Map<string, CoteDIvoireCatalogProduct[]>()
      for (const product of catalog) {
        const key = `${product.brand}|${product.dataAllowance ?? ""}|${product.validity ?? ""}`
        const arr = grouped.get(key) || []
        arr.push(product)
        grouped.set(key, arr)
      }
      return sortSoutraliDataProducts(
        [...grouped.entries()]
        .map(([, candidates]) => {
          const first = candidates[0]
          if (candidates.length === 0 || !first) return null
          return buildSoutraliProduct(first.brand as SoutraliProduct["brand"], candidates, cat, first.dataAllowance, first.validity)
        })
        .filter((product): product is SoutraliProduct => Boolean(product))
      )
    }

    const brands = [...new Set(catalog.map((product) => product.brand))] as SoutraliProduct["brand"][]

    return brands
      .map((brand) => {
        const candidates = catalog.filter((product) => product.brand === brand)

        if (candidates.length === 0) {
          return null
        }

        return buildSoutraliProduct(brand, candidates, cat)
      })
      .filter((product): product is SoutraliProduct => Boolean(product))
  })
}

export function getSoutraliProduct(productId: string) {
  return listSoutraliProducts().find((product) => product.id === productId)
}

function normalizeDingResultCode(resultCode: number | undefined) {
  return resultCode === 1 || resultCode === 0
}

function formatDingErrors(errorCodes: Array<{ Code: string; Context?: string }> | undefined) {
  if (!errorCodes || errorCodes.length === 0) {
    return ""
  }

  return errorCodes.map((error) => `${error.Code}${error.Context ? ` (${error.Context})` : ""}`).join(", ")
}

function getMatchingDingProviderCodes(providers: DingProvider[], brand: SoutraliProduct["brand"]) {
  const normalizedBrand = brand.toLowerCase()

  return new Set(
    providers
      .filter((provider) => {
        const normalizedName = provider.Name.toLowerCase()
        return normalizedName.includes(normalizedBrand) && !normalizedName.includes("data")
      })
      .map((provider) => provider.ProviderCode)
  )
}

function getMatchingDingAirtimeProduct(products: DingProduct[], providerCodes: Set<string>, amount: number) {
  const candidates = products.filter((product) => {
    const benefitSet = new Set(product.Benefits || [])

    return (
      providerCodes.has(product.ProviderCode) &&
      benefitSet.has("Mobile") &&
      !benefitSet.has("Data") &&
      !benefitSet.has("Internet") &&
      !product.LookupBillsRequired &&
      product.Minimum.ReceiveCurrencyIso === "XOF" &&
      product.Maximum.ReceiveCurrencyIso === "XOF"
    )
  })

  return candidates.find((product) => product.Minimum.ReceiveValue === amount && product.Maximum.ReceiveValue === amount)
}

function computeOfferScore(offer: SoutraliProviderOffer, lowestCustomerPrice: number, highestMargin: number) {
  const customerComponent = lowestCustomerPrice > 0 ? (lowestCustomerPrice / offer.customerPrice) * 60 : 60
  const marginComponent = highestMargin > 0 ? (offer.afrisendiqMargin / highestMargin) * 40 : 40
  return Math.round((customerComponent + marginComponent) * 100) / 100
}

function selectBestOffer(offers: SoutraliProviderOffer[]) {
  const liveOffers = offers.filter((offer) => offer.available && offer.executionMode === "live")
  const eligibleOffers = liveOffers.length > 0 ? liveOffers : offers.filter((offer) => offer.available)

  if (eligibleOffers.length === 0) {
    throw new Error("No provider offers are currently available for this Soutrali product")
  }

  const lowestCustomerPrice = Math.min(...eligibleOffers.map((offer) => offer.customerPrice))
  const highestMargin = Math.max(...eligibleOffers.map((offer) => offer.afrisendiqMargin), 0)

  const scoredOffers = offers.map((offer) => {
    if (!eligibleOffers.includes(offer)) {
      return {
        ...offer,
        score: 0
      }
    }

    return {
      ...offer,
      score: computeOfferScore(offer, lowestCustomerPrice, highestMargin)
    }
  })

  const bestOffer = scoredOffers
    .filter((offer) => eligibleOffers.some((candidate) => candidate.provider === offer.provider && candidate.providerProductId === offer.providerProductId))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (left.customerPrice !== right.customerPrice) {
        return left.customerPrice - right.customerPrice
      }

      if (right.afrisendiqMargin !== left.afrisendiqMargin) {
        return right.afrisendiqMargin - left.afrisendiqMargin
      }

      return providerPriorityRank[left.provider] - providerPriorityRank[right.provider]
    })[0]

  return {
    offers: scoredOffers,
    bestOffer
  }
}

async function buildReloadlyOffer(
  product: SoutraliProduct,
  providerProduct: CoteDIvoireCatalogProduct,
  amount: number,
  customerReference: string | undefined,
  deps: SoutraliDependencies
) {
  if (customerReference) {
    const inferredBrand = inferCiBrandFromPhone(customerReference)

    if (!inferredBrand) {
      return {
        provider: providerProduct.provider,
        providerLabel: providerProduct.providerLabel,
        providerProductId: providerProduct.id,
        executionMode: getProviderTransactionMode(providerProduct.provider),
        customerPrice: 0,
        providerCost: 0,
        afrisendiqMargin: 0,
        currency: "XOF",
        score: 0,
        available: false,
        reason: "Recipient phone must be a Côte d'Ivoire mobile number",
        quoteSource: "catalog"
      } satisfies SoutraliProviderOffer
    }

    if (inferredBrand !== product.brand) {
      return {
        provider: providerProduct.provider,
        providerLabel: providerProduct.providerLabel,
        providerProductId: providerProduct.id,
        executionMode: getProviderTransactionMode(providerProduct.provider),
        customerPrice: 0,
        providerCost: 0,
        afrisendiqMargin: 0,
        currency: "XOF",
        score: 0,
        available: false,
        reason: `Recipient phone resolves to ${inferredBrand}, not ${product.brand}`,
        quoteSource: "catalog"
      } satisfies SoutraliProviderOffer
    }
  }

  const providerCost = amount
  const pricing = await priceSoutraliOffer(providerProduct, product, amount, providerCost)

  return {
    provider: providerProduct.provider,
    providerLabel: providerProduct.providerLabel,
    providerProductId: providerProduct.id,
    executionMode: getProviderTransactionMode(providerProduct.provider),
    customerPrice: pricing.customerPrice,
    providerCost: pricing.providerCost,
    afrisendiqMargin: pricing.afrisendiqMargin,
    pricingStrategy: pricing.pricingStrategy,
    currency: "XOF",
    score: 0,
    available: true,
    quoteSource: "catalog"
  } satisfies SoutraliProviderOffer
}

async function buildDingOffer(
  product: SoutraliProduct,
  providerProduct: CoteDIvoireCatalogProduct,
  amount: number,
  customerReference: string | undefined,
  deps: SoutraliDependencies
) {
  const executionMode = getProviderTransactionMode(providerProduct.provider)

  if (!customerReference) {
    const providerCost = amount
    const pricing = await priceSoutraliOffer(providerProduct, product, amount, providerCost)

    return {
      provider: providerProduct.provider,
      providerLabel: providerProduct.providerLabel,
      providerProductId: providerProduct.id,
      executionMode,
      customerPrice: pricing.customerPrice,
      providerCost: pricing.providerCost,
      afrisendiqMargin: pricing.afrisendiqMargin,
      pricingStrategy: pricing.pricingStrategy,
      currency: "XOF",
      score: 0,
      available: true,
      quoteSource: "catalog",
      reason: executionMode === "live" ? "Catalog estimate without recipient resolution" : undefined
    } satisfies SoutraliProviderOffer
  }

  const inferredBrand = inferCiBrandFromPhone(customerReference)

  if (!inferredBrand) {
    return {
      provider: providerProduct.provider,
      providerLabel: providerProduct.providerLabel,
      providerProductId: providerProduct.id,
      executionMode,
      customerPrice: 0,
      providerCost: 0,
      afrisendiqMargin: 0,
      currency: "XOF",
      score: 0,
      available: false,
      reason: "Recipient phone must be a Côte d'Ivoire mobile number",
      quoteSource: executionMode === "live" ? "live" : "catalog"
    } satisfies SoutraliProviderOffer
  }

  if (inferredBrand !== product.brand) {
    return {
      provider: providerProduct.provider,
      providerLabel: providerProduct.providerLabel,
      providerProductId: providerProduct.id,
      executionMode,
      customerPrice: 0,
      providerCost: 0,
      afrisendiqMargin: 0,
      currency: "XOF",
      score: 0,
      available: false,
      reason: `Recipient phone resolves to ${inferredBrand}, not ${product.brand}`,
      quoteSource: executionMode === "live" ? "live" : "catalog"
    } satisfies SoutraliProviderOffer
  }

  if (executionMode !== "live") {
    const providerCost = amount
    const pricing = await priceSoutraliOffer(providerProduct, product, amount, providerCost)

    return {
      provider: providerProduct.provider,
      providerLabel: providerProduct.providerLabel,
      providerProductId: providerProduct.id,
      executionMode,
      customerPrice: pricing.customerPrice,
      providerCost: pricing.providerCost,
      afrisendiqMargin: pricing.afrisendiqMargin,
      pricingStrategy: pricing.pricingStrategy,
      currency: "XOF",
      score: 0,
      available: true,
      quoteSource: "catalog"
    } satisfies SoutraliProviderOffer
  }

  try {
    const [providerResponse, productResponse] = await Promise.all([
      deps.getDingProviders({ countryIsos: ["CI"], accountNumber: customerReference }),
      deps.getDingProducts({ countryIsos: ["CI"], accountNumber: customerReference, benefits: ["Mobile"] })
    ])

    if (!normalizeDingResultCode(providerResponse.ResultCode)) {
      throw new Error(`Ding provider discovery failed: ${formatDingErrors(providerResponse.ErrorCodes) || "unknown error"}`)
    }

    if (!normalizeDingResultCode(productResponse.ResultCode)) {
      throw new Error(`Ding product discovery failed: ${formatDingErrors(productResponse.ErrorCodes) || "unknown error"}`)
    }

    const matchingProviderCodes = getMatchingDingProviderCodes(providerResponse.Items || [], product.brand)

    if (matchingProviderCodes.size === 0) {
      throw new Error(`Ding could not resolve a ${product.brand} Côte d'Ivoire provider`)
    }

    const matchedProduct = getMatchingDingAirtimeProduct(productResponse.Items || [], matchingProviderCodes, amount)

    if (!matchedProduct) {
      throw new Error(`Ding does not currently expose an exact ${amount} XOF airtime SKU for ${product.brand}`)
    }

    const converted = await deps.convertUsdAmount(matchedProduct.Minimum.SendValue, "XOF") as ConvertUsdAmountResult
    const providerCost = Math.round(converted.converted * 100) / 100
    const pricing = await priceSoutraliOffer(providerProduct, product, amount, providerCost)

    return {
      provider: providerProduct.provider,
      providerLabel: providerProduct.providerLabel,
      providerProductId: providerProduct.id,
      executionMode,
      customerPrice: pricing.customerPrice,
      providerCost: pricing.providerCost,
      afrisendiqMargin: pricing.afrisendiqMargin,
      pricingStrategy: pricing.pricingStrategy,
      currency: "XOF",
      score: 0,
      available: true,
      quoteSource: "live",
      metadata: {
        skuCode: matchedProduct.SkuCode,
        providerCode: matchedProduct.ProviderCode,
        sendValue: matchedProduct.Minimum.SendValue,
        sendCurrencyIso: matchedProduct.Minimum.SendCurrencyIso
      }
    } satisfies SoutraliProviderOffer
  } catch (error) {
    return {
      provider: providerProduct.provider,
      providerLabel: providerProduct.providerLabel,
      providerProductId: providerProduct.id,
      executionMode,
      customerPrice: 0,
      providerCost: 0,
      afrisendiqMargin: 0,
      currency: "XOF",
      score: 0,
      available: false,
      reason: error instanceof Error ? error.message : "Ding quote unavailable",
      quoteSource: "live"
    } satisfies SoutraliProviderOffer
  }
}

async function buildGenericCatalogOffer(
  providerProduct: CoteDIvoireCatalogProduct,
  product: SoutraliProduct,
  amount: number,
  deps: SoutraliDependencies
): Promise<SoutraliProviderOffer> {
  const providerCost = amount
  const pricing = await priceSoutraliOffer(providerProduct, product, amount, providerCost)

  return {
    provider: providerProduct.provider,
    providerLabel: providerProduct.providerLabel,
    providerProductId: providerProduct.id,
    executionMode: getProviderTransactionMode(providerProduct.provider),
    customerPrice: pricing.customerPrice,
    providerCost: pricing.providerCost,
    afrisendiqMargin: pricing.afrisendiqMargin,
    pricingStrategy: pricing.pricingStrategy,
    currency: "XOF",
    score: 0,
    available: true,
    quoteSource: "catalog"
  }
}

async function buildOffer(
  product: SoutraliProduct,
  providerProduct: CoteDIvoireCatalogProduct,
  amount: number,
  customerReference: string | undefined,
  deps: SoutraliDependencies
) {
  if (product.category === "electricity" || product.category === "gift-card") {
    return buildGenericCatalogOffer(providerProduct, product, amount, deps)
  }

  if (providerProduct.provider === "ding") {
    return buildDingOffer(product, providerProduct, amount, customerReference, deps)
  }

  return buildReloadlyOffer(product, providerProduct, amount, customerReference, deps)
}

function transitionOrder(
  order: SoutraliOrder,
  nextStatus: Parameters<typeof transitionSoutraliOrder>[1],
  deps: SoutraliDependencies,
  patch: Parameters<typeof transitionSoutraliOrder>[2] = {},
  note?: string,
  provider?: string
) {
  const updatedOrder = transitionSoutraliOrder(order, nextStatus, patch, note)
  deps.recordExecutionTelemetry({
    traceId: updatedOrder.traceId,
    orderId: updatedOrder.id,
    type: "order.transitioned",
    provider,
    metadata: {
      from: order.status,
      to: nextStatus,
      note
    }
  })

  return updatedOrder
}

export async function quoteSoutraliProduct(input: QuoteInput, overrides: Partial<SoutraliDependencies> = {}): Promise<SoutraliQuote> {
  const deps = { ...defaultDependencies, ...overrides }
  const product = getSoutraliProduct(input.productId)

  if (!product) {
    throw new Error("Soutrali product not found")
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Amount must be a positive number")
  }

  if (input.amount < product.minAmount || input.amount > product.maxAmount) {
    throw new Error(`Amount must stay between ${product.minAmount} and ${product.maxAmount} ${product.currency}`)
  }

  const candidates = getProviderCatalogCandidates(product)
  const offers = await Promise.all(candidates.map((candidate) => buildOffer(product, candidate, input.amount, input.customerReference, deps)))
  const { offers: scoredOffers, bestOffer } = selectBestOffer(offers)

  return {
    product,
    amount: input.amount,
    currency: "XOF",
    offers: scoredOffers,
    bestOffer
  }
}

async function executeReloadlyOffer(
  product: SoutraliProduct,
  customerReference: string,
  amount: number,
  reference: string,
  deps: SoutraliDependencies
) {
  const inferredBrand = inferCiBrandFromPhone(customerReference)

  if (!inferredBrand) {
    throw new Error("Recipient phone must be a Côte d'Ivoire mobile number for airtime completion")
  }

  if (inferredBrand !== product.brand) {
    throw new Error(`Selected product is for ${product.brand}, but the phone prefix resolves to ${inferredBrand}`)
  }

  const operator = await deps.detectReloadlyOperator(customerReference, "CI")

  if (!operator.operatorId) {
    throw new Error("Reloadly could not resolve an operator for this phone number")
  }

  return deps.sendReloadlyAirtime({
    operatorId: operator.operatorId,
    phone: customerReference,
    amount,
    reference
  })
}

async function executeDingOffer(
  product: SoutraliProduct,
  customerReference: string,
  amount: number,
  reference: string,
  traceId: string,
  deps: SoutraliDependencies
) {
  const inferredBrand = inferCiBrandFromPhone(customerReference)

  if (!inferredBrand) {
    throw new Error("Recipient phone must be a Côte d'Ivoire mobile number for Ding airtime completion")
  }

  if (inferredBrand !== product.brand) {
    throw new Error(`Selected product is for ${product.brand}, but the phone prefix resolves to ${inferredBrand}`)
  }

  const [providerResponse, productResponse] = await Promise.all([
    deps.getDingProviders({ countryIsos: ["CI"], accountNumber: customerReference, correlationId: traceId }),
    deps.getDingProducts({ countryIsos: ["CI"], accountNumber: customerReference, benefits: ["Mobile"], correlationId: traceId })
  ])

  if (!normalizeDingResultCode(providerResponse.ResultCode)) {
    throw new Error(`Ding provider discovery failed: ${formatDingErrors(providerResponse.ErrorCodes) || "unknown error"}`)
  }

  if (!normalizeDingResultCode(productResponse.ResultCode)) {
    throw new Error(`Ding product discovery failed: ${formatDingErrors(productResponse.ErrorCodes) || "unknown error"}`)
  }

  const matchingProviderCodes = getMatchingDingProviderCodes(providerResponse.Items || [], product.brand)

  if (matchingProviderCodes.size === 0) {
    throw new Error(`Ding could not resolve a ${product.brand} Côte d'Ivoire provider for this phone number`)
  }

  const matchedProduct = getMatchingDingAirtimeProduct(productResponse.Items || [], matchingProviderCodes, amount)

  if (!matchedProduct) {
    throw new Error(`Ding does not currently expose an exact ${amount} XOF airtime SKU for ${product.brand} Côte d'Ivoire in the live catalog`)
  }

  const transferResponse = await deps.sendDingTransfer({
    skuCode: matchedProduct.SkuCode,
    sendValue: matchedProduct.Minimum.SendValue,
    sendCurrencyIso: matchedProduct.Minimum.SendCurrencyIso,
    accountNumber: customerReference,
    distributorRef: reference,
    validateOnly: false,
    correlationId: traceId
  })

  if (!normalizeDingResultCode(transferResponse.ResultCode)) {
    throw new Error(`Ding transfer failed: ${formatDingErrors(transferResponse.ErrorCodes) || "unknown error"}`)
  }

  let transferRecord = transferResponse.TransferRecord

  if (transferRecord?.ProcessingState === "Submitted" || transferRecord?.ProcessingState === "Processing") {
    const recordsResponse = await deps.listDingTransferRecords({ distributorRef: reference, take: 1, correlationId: traceId })

    if (normalizeDingResultCode(recordsResponse.ResultCode)) {
      const latestRecord = (recordsResponse.Items || [])[0] as DingTransferRecordItem | undefined
      if (latestRecord?.TransferRecord) {
        transferRecord = latestRecord.TransferRecord
      }
    }
  }

  return {
    status: String(transferRecord?.ProcessingState || "Submitted").toLowerCase(),
    mode: "live",
    transferRecord,
    resultCode: transferResponse.ResultCode,
    errorCodes: transferResponse.ErrorCodes
  }
}

async function executeDTOneOffer(
  product: SoutraliProduct,
  customerReference: string,
  recipientLabel: string,
  beneficiaryPhoneNumber: string,
  amount: number,
  reference: string,
  deps: SoutraliDependencies
) {
  const resolved = await deps.resolveDtOneProductIdForAmount("electricity", amount)

  const transaction = await deps.sendDTOneTransaction({
    productId: resolved.id,
    creditPartyIdentifier: {
      account_number: customerReference.replace(/\s+/g, "")
    },
    beneficiaryMobileNumber: beneficiaryPhoneNumber,
    calculationMode: "DESTINATION_AMOUNT",
    destinationAmount: amount,
    destinationUnit: resolved.destination?.unit,
    destinationUnitType: resolved.destination?.unitType,
    externalId: reference
  })

  const rechargeCode = extractDTOneRechargeCode(transaction)

  return {
    status: String(transaction.status?.message || "SUBMITTED").toLowerCase(),
    mode: "live",
    transactionId: transaction.id,
    externalId: transaction.external_id,
    rechargeCode,
    transaction
  }
}

export async function executeSoutraliProviderPurchase(
  input: {
    product: SoutraliProduct
    customerReference: string
    recipientLabel: string
    beneficiaryPhoneNumber?: string
    amount: number
    reference: string
    selectedProvider: CoteDIvoireProvider
    selectedExecutionMode: "live" | "simulated"
    traceId: string
  },
  overrides: Partial<SoutraliDependencies> = {}
) {
  const deps = { ...defaultDependencies, ...overrides }

  if (input.selectedProvider === "reloadly" && input.selectedExecutionMode === "live") {
    return executeReloadlyOffer(input.product, input.customerReference, input.amount, input.reference, deps)
  }

  if (input.selectedProvider === "ding" && input.selectedExecutionMode === "live") {
    return executeDingOffer(input.product, input.customerReference, input.amount, input.reference, input.traceId, deps)
  }

  if (input.selectedProvider === "dtone" && input.selectedExecutionMode === "live" && input.product.category === "electricity" && input.product.brand === "CIE") {
    if (!input.beneficiaryPhoneNumber) {
      throw new Error("Beneficiary mobile number is required for CIE prepaid completion")
    }

    return executeDTOneOffer(
      input.product,
      input.customerReference,
      input.recipientLabel,
      input.beneficiaryPhoneNumber,
      input.amount,
      input.reference,
      deps
    )
  }

  return deps.simulateProviderExecution({
    provider: input.selectedProvider,
    product: input.product,
    amount: input.amount,
    customerReference: input.customerReference,
    recipientLabel: input.recipientLabel,
    reference: input.reference,
  })
}

export async function processSoutraliCheckout(
  body: unknown,
  overrides: Partial<SoutraliDependencies> = {}
) {
  const deps = { ...defaultDependencies, ...overrides }
  const request = typeof body === "object" && body !== null ? body as CheckoutInput : {}
  const productId = String(request.productId || "").trim()
  const customerReference = String(request.customerReference || "").trim()
  const recipientLabel = String(request.recipientLabel || "").trim()
  const beneficiaryPhoneNumber = String(request.beneficiaryPhoneNumber || "").trim()
  const recipientEmail = String(request.recipientEmail || "").trim()
  const amount = Number(request.amount)
  const senderName = String(request.senderName || "").trim() || undefined

  if (!productId) {
    return { status: 400, body: { success: false, error: "Soutrali product is required" } }
  }

  const product = getSoutraliProduct(productId)

  if (!product) {
    return { status: 404, body: { success: false, error: "Soutrali product not found" } }
  }

  if (!customerReference) {
    return { status: 400, body: { success: false, error: `${product.customerReferenceLabel} is required` } }
  }

  if (!recipientLabel) {
    return { status: 400, body: { success: false, error: `${product.recipientLabel} is required` } }
  }

  if (product.category === "electricity" && product.brand === "CIE" && !beneficiaryPhoneNumber) {
    return { status: 400, body: { success: false, error: "Beneficiary mobile number is required for CIE prepaid checkout" } }
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: 400, body: { success: false, error: "Amount must be a positive number" } }
  }

  const traceId = deps.createTraceId()
  const reference = deps.createReference()
  let order = createSoutraliOrder({
    id: reference,
    traceId,
    productId: product.id,
    productName: product.name,
    customerReference,
    recipientLabel,
    amount,
    currency: product.currency
  })

  deps.recordExecutionTelemetry({
    traceId,
    orderId: order.id,
    type: "order.created",
    metadata: {
      productId: product.id,
      amount
    }
  })

  try {
    const quote = await quoteSoutraliProduct({
      productId: product.id,
      amount,
      customerReference
    }, deps)

    if (product.category === "electricity" && product.brand === "CIE" && quote.bestOffer.executionMode !== "live") {
      return {
        status: 409,
        body: {
          success: false,
          error: "Live CIE prepaid checkout is blocked until a live provider is enabled for this amount."
        }
      }
    }

    order = transitionOrder(order, "quoted", deps, { quotedPrice: quote.bestOffer.customerPrice }, "Soutrali quote generated")
    order = transitionOrder(
      order,
      "provider_selected",
      deps,
      {
        quotedPrice: quote.bestOffer.customerPrice,
        selectedProvider: quote.bestOffer.provider,
        selectedExecutionMode: quote.bestOffer.executionMode
      },
      "JIT provider selected",
      quote.bestOffer.provider
    )

    deps.recordExecutionTelemetry({
      traceId,
      orderId: order.id,
      type: "provider.attempt.started",
      provider: quote.bestOffer.provider,
      metadata: {
        executionMode: quote.bestOffer.executionMode,
        productId: product.id,
        customerPrice: quote.bestOffer.customerPrice,
        providerCost: quote.bestOffer.providerCost,
        margin: quote.bestOffer.afrisendiqMargin
      }
    })

    order = transitionOrder(order, "executing", deps, {}, "Submitting through Soutrali engine", quote.bestOffer.provider)

    const transaction = await executeSoutraliProviderPurchase({
      product,
      customerReference,
      recipientLabel,
      beneficiaryPhoneNumber,
      amount,
      reference,
      selectedProvider: quote.bestOffer.provider,
      selectedExecutionMode: quote.bestOffer.executionMode,
      traceId,
    }, deps)

    order = transitionOrder(order, "completed", deps, {}, "Soutrali order completed", quote.bestOffer.provider)

    deps.recordExecutionTelemetry({
      traceId,
      orderId: order.id,
      type: "provider.attempt.succeeded",
      provider: quote.bestOffer.provider,
      metadata: {
        executionMode: quote.bestOffer.executionMode,
        productId: product.id
      }
    })

    deps.logTransaction({
      id: reference,
      traceId,
      phone: customerReference,
      operator: product.name,
      amount,
      status: String((transaction as Record<string, unknown>).status || "completed"),
      provider: quote.bestOffer.provider.toUpperCase(),
      quotedPrice: quote.bestOffer.customerPrice
    })

    deps.recordExecutionTelemetry({
      traceId,
      orderId: order.id,
      type: "purchase.completed",
      provider: quote.bestOffer.provider,
      metadata: {
        productId: product.id,
        quotedPrice: quote.bestOffer.customerPrice,
        margin: quote.bestOffer.afrisendiqMargin
      }
    })

    try {
      const rechargeCode = typeof (transaction as Record<string, unknown>).rechargeCode === "string"
        ? String((transaction as Record<string, unknown>).rechargeCode)
        : undefined
      const confirmation = await deps.sendPurchaseConfirmationSms({
        reference,
        productLabel: product.name,
        productCategory: product.category,
        productBrand: product.brand,
        amount,
        currency: product.currency,
        recipientPhoneCandidates: [beneficiaryPhoneNumber, customerReference],
        senderName,
        rechargeCode,
      })

      deps.recordExecutionTelemetry({
        traceId,
        orderId: order.id,
        type: confirmation.delivered ? "customer.notification.sent" : "customer.notification.skipped",
        provider: quote.bestOffer.provider,
        message: confirmation.delivered ? undefined : confirmation.reason,
        metadata: confirmation.delivered
          ? {
              channel: confirmation.whatsappSid ? "twilio_whatsapp" : "twilio_sms",
              sid: confirmation.sid,
              whatsappSid: confirmation.whatsappSid,
              to: confirmation.to,
            }
          : {
              channel: "twilio_sms",
              reason: confirmation.reason,
            }
      })
    } catch (error) {
      deps.recordExecutionTelemetry({
        traceId,
        orderId: order.id,
        type: "customer.notification.failed",
        provider: quote.bestOffer.provider,
        message: error instanceof Error ? error.message : "Unable to send purchase confirmation SMS",
        metadata: {
          channel: "twilio_sms",
        }
      })
    }

    return {
      status: 200,
      body: {
        success: true,
        traceId,
        reference,
        product,
        quotedPrice: quote.bestOffer.customerPrice,
        transaction: {
          reference,
          status: String((transaction as Record<string, unknown>).status || "completed"),
          pending: String((transaction as Record<string, unknown>).status || "").toLowerCase() === "created",
          rechargeCode: typeof (transaction as Record<string, unknown>).rechargeCode === "string"
            ? String((transaction as Record<string, unknown>).rechargeCode)
            : undefined,
          completedAt: typeof (transaction as Record<string, unknown>).completedAt === "string"
            ? String((transaction as Record<string, unknown>).completedAt)
            : new Date().toISOString(),
          beneficiaryPhoneNumber: beneficiaryPhoneNumber || undefined,
          recipientEmail: recipientEmail || undefined
        }
      }
    }
  } catch (error) {
    order = transitionOrder(
      order,
      "failed",
      deps,
      {
        failureReason: error instanceof Error ? error.message : "Soutrali checkout failed"
      },
      "Soutrali order failed"
    )

    deps.recordExecutionTelemetry({
      traceId,
      orderId: order.id,
      type: "purchase.failed",
      message: error instanceof Error ? error.message : "Soutrali checkout failed"
    })

    return {
      status: 500,
      body: {
        success: false,
        error: error instanceof Error ? error.message : "Soutrali checkout failed"
      }
    }
  }
}