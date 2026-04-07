export type CoteDIvoireProvider = "reloadly" | "ding" | "dtone"

export type CoteDIvoireProductCategory = "airtime" | "data" | "electricity" | "gift-card"

export type CoteDIvoireBrand = "MTN" | "MOOV" | "ORANGE" | "CIE" | "JUMIA"

export type CoteDIvoireCatalogProduct = {
  id: string
  provider: CoteDIvoireProvider
  providerLabel: string
  category: CoteDIvoireProductCategory
  brand: CoteDIvoireBrand
  name: string
  description: string
  countryCode: "CI"
  currency: "XOF"
  amountOptions: number[]
  minAmount: number
  maxAmount: number
  recipientLabel: string
  customerReferenceLabel: string
  serviceLogoPath: string
  liveCapable: boolean
  completionMode: "live" | "simulated"
  dataAllowance?: string
  validity?: string
}

const providerLabels: Record<CoteDIvoireProvider, string> = {
  reloadly: "Reloadly",
  ding: "Ding",
  dtone: "DT One"
}

const DEFAULT_SERVICE_LOGO = "/logos/afrisendiq-logo-96.png"

export function getCoteDIvoireServiceLogoPath(category: CoteDIvoireProductCategory, brand: CoteDIvoireBrand) {
  if (brand === "CIE") {
    return "/service-cards/CIE PREPAID.jpg"
  }

  if (brand === "JUMIA") {
    return "/service-cards/JUMIA CI.png"
  }

  if (brand === "MTN") {
    return category === "data"
      ? "/service-cards/MTN CI DATA.png"
      : "/service-cards/MTN CI CREDITS.png"
  }

  if (brand === "MOOV") {
    return category === "data"
      ? "/service-cards/MOOV CI DATA.png"
      : "/service-cards/MOOV CI CREDITS.png"
  }

  if (brand === "ORANGE") {
    return category === "data"
      ? "/service-cards/ORANGE CI DATA.png"
      : "/service-cards/ORANGE CI CREDITS.png"
  }

  return DEFAULT_SERVICE_LOGO
}

function getProviderMode(provider: CoteDIvoireProvider) {
  const mode = process.env[`${provider.toUpperCase()}_TRANSACTION_MODE`]

  if (mode === "live") {
    return "live"
  }

  if (mode === "simulated") {
    return "simulated"
  }

  if (provider === "reloadly") {
    return process.env.RELOADLY_LIVE_ENABLED === "true" ? "live" : "simulated"
  }

  return "simulated"
}

function createProduct(
  provider: CoteDIvoireProvider,
  category: CoteDIvoireProductCategory,
  brand: CoteDIvoireBrand,
  name: string,
  description: string,
  amountOptions: number[],
  recipientLabel: string,
  customerReferenceLabel: string,
  liveCapable: boolean
): CoteDIvoireCatalogProduct {
  return {
    id: `${provider}-${brand.toLowerCase()}-${category}`,
    provider,
    providerLabel: providerLabels[provider],
    category,
    brand,
    name,
    description,
    countryCode: "CI",
    currency: "XOF",
    amountOptions,
    minAmount: Math.min(...amountOptions),
    maxAmount: Math.max(...amountOptions),
    recipientLabel,
    customerReferenceLabel,
    serviceLogoPath: getCoteDIvoireServiceLogoPath(category, brand),
    liveCapable,
    completionMode: liveCapable ? getProviderMode(provider) : "simulated"
  }
}

type DataBundleTier = {
  allowance: string
  validity: string
  price: number
}

type DataBrand = Extract<CoteDIvoireBrand, "MTN" | "MOOV" | "ORANGE">

function createDataBundle(
  provider: CoteDIvoireProvider,
  brand: CoteDIvoireBrand,
  tier: DataBundleTier,
  liveCapable: boolean
): CoteDIvoireCatalogProduct {
  const allowanceSlug = tier.allowance.toLowerCase().replace(/\s+/g, "")
  const validitySlug = tier.validity.replace(/\s+/g, "")
  return {
    id: `${provider}-${brand.toLowerCase()}-data-${allowanceSlug}-${validitySlug}`,
    provider,
    providerLabel: providerLabels[provider],
    category: "data",
    brand,
    name: `${brand} ${tier.allowance} — ${tier.validity}`,
    description: `${tier.allowance} data bundle valid for ${tier.validity}.`,
    countryCode: "CI",
    currency: "XOF",
    amountOptions: [tier.price],
    minAmount: tier.price,
    maxAmount: tier.price,
    recipientLabel: "Recipient phone",
    customerReferenceLabel: "Sender reference",
    serviceLogoPath: getCoteDIvoireServiceLogoPath("data", brand),
    liveCapable,
    completionMode: liveCapable ? getProviderMode(provider) : "simulated",
    dataAllowance: tier.allowance,
    validity: tier.validity
  }
}

const defaultDataBundleTiers: DataBundleTier[] = [
  { allowance: "100 Mo", validity: "1 jour", price: 200 },
  { allowance: "500 Mo", validity: "3 jours", price: 500 },
  { allowance: "1 Go", validity: "7 jours", price: 1000 },
  { allowance: "3 Go", validity: "30 jours", price: 2500 },
  { allowance: "5 Go", validity: "30 jours", price: 5000 }
]

const dataBundleTiersByBrand: Record<DataBrand, DataBundleTier[]> = {
  MTN: [
    { allowance: "7400 MB Data", validity: "30 jours", price: 5000 },
    { allowance: "20000 MB Data", validity: "30 jours", price: 10000 },
    { allowance: "3700 MB Data", validity: "30 jours", price: 2500 },
    { allowance: "500min + 500 SMS + 6.5Gb", validity: "30 jours", price: 5000 },
    { allowance: "250min + 250 SMS + 2.5Gb", validity: "30 jours", price: 2500 },
    { allowance: "2200 Mb Data", validity: "10 jours", price: 1500 },
    { allowance: "70mins + 100 SMS+ 700 Mb", validity: "4 jours", price: 700 }
  ],
  MOOV: [
    { allowance: "400 mins + 500 SMS + 2.5 Gb", validity: "30 jours", price: 5000 },
    { allowance: "20000 MB Data", validity: "30 jours", price: 10000 },
    { allowance: "7400 MB Data", validity: "30 jours", price: 5000 },
    { allowance: "1660 mins + 1000 SMS + 20 Gb", validity: "30 jours", price: 20000 },
    { allowance: "45000 MB Data", validity: "30 jours", price: 20000 },
    { allowance: "830 mins + 500 SMS + 8 Gb", validity: "30 jours", price: 10000 },
    { allowance: "200 mins + 200 SMS + 2 Gb", validity: "30 jours", price: 2500 },
    { allowance: "120 mins + 130 SMS + 1 Gb", validity: "15 jours", price: 1500 },
    { allowance: "80 mins + 500 SMS + 500 MB", validity: "10 jours", price: 1000 },
    { allowance: "40 mins + 250 SMS + 250 Mb", validity: "7 jours", price: 500 }
  ],
  ORANGE: [
    { allowance: "7.2 GB", validity: "30 jours", price: 5000 },
    { allowance: "15 GB", validity: "30 jours", price: 10000 },
    { allowance: "3.5 GB", validity: "30 jours", price: 2500 },
    { allowance: "36 GB", validity: "30 jours", price: 20000 }
  ]
}

const dataBrands: DataBrand[] = ["MTN", "MOOV", "ORANGE"]

const dataProviders: { provider: CoteDIvoireProvider; liveCapable: boolean }[] = [
  { provider: "reloadly", liveCapable: true },
  { provider: "ding", liveCapable: true },
  { provider: "dtone", liveCapable: true }
]

function generateDataBundles(): CoteDIvoireCatalogProduct[] {
  return dataProviders.flatMap(({ provider, liveCapable }) =>
    dataBrands.flatMap((brand) =>
      dataBundleTiersByBrand[brand].map((tier) => createDataBundle(provider, brand, tier, liveCapable))
    )
  )
}

const localCatalog: CoteDIvoireCatalogProduct[] = [
  createProduct(
    "reloadly",
    "airtime",
    "MTN",
    "Reloadly MTN CI Airtime",
    "Direct airtime completion path for MTN Côte d'Ivoire numbers.",
    [1000, 2000, 5000, 10000, 20000],
    "Recipient phone",
    "Sender reference",
    true
  ),
  createProduct(
    "reloadly",
    "airtime",
    "MOOV",
    "Reloadly Moov CI Airtime",
    "Direct airtime completion path for Moov Côte d'Ivoire numbers.",
    [1000, 2000, 5000, 10000, 20000],
    "Recipient phone",
    "Sender reference",
    true
  ),
  createProduct(
    "reloadly",
    "airtime",
    "ORANGE",
    "Reloadly Orange CI Airtime",
    "Direct airtime completion path for Orange Côte d'Ivoire numbers.",
    [1000, 2000, 5000, 10000, 20000],
    "Recipient phone",
    "Sender reference",
    true
  ),
  createProduct(
    "ding",
    "airtime",
    "MTN",
    "Ding MTN CI Airtime",
    "Seeded local CI catalog entry for MTN airtime through Ding.",
    [1000, 2000, 5000, 10000, 20000],
    "Recipient phone",
    "Sender reference",
    true
  ),
  createProduct(
    "ding",
    "airtime",
    "MOOV",
    "Ding Moov CI Airtime",
    "Seeded local CI catalog entry for Moov airtime through Ding.",
    [1000, 2000, 5000, 10000, 20000],
    "Recipient phone",
    "Sender reference",
    true
  ),
  createProduct(
    "ding",
    "airtime",
    "ORANGE",
    "Ding Orange CI Airtime",
    "Seeded local CI catalog entry for Orange airtime through Ding.",
    [1000, 2000, 5000, 10000, 20000],
    "Recipient phone",
    "Sender reference",
    true
  ),
  createProduct(
    "ding",
    "gift-card",
    "JUMIA",
    "Ding Jumia Gift Card",
    "Jumia Côte d'Ivoire digital gift card through Ding.",
    [5000, 10000, 25000, 50000],
    "Recipient name or email",
    "Customer reference",
    true
  ),
  createProduct(
    "dtone",
    "gift-card",
    "JUMIA",
    "DT One Jumia Voucher",
    "Seeded local CI digital gift card catalog entry for Jumia.",
    [5000, 10000, 25000, 50000],
    "Recipient name or email",
    "Customer reference",
    true
  ),
  createProduct(
    "dtone",
    "airtime",
    "MTN",
    "DT One MTN CI Airtime",
    "Seeded local CI airtime catalog entry for MTN through DT One.",
    [1000, 2000, 5000, 10000, 20000],
    "Recipient phone",
    "Sender reference",
    true
  ),
  createProduct(
    "dtone",
    "airtime",
    "MOOV",
    "DT One Moov CI Airtime",
    "Seeded local CI airtime catalog entry for Moov through DT One.",
    [1000, 2000, 5000, 10000, 20000],
    "Recipient phone",
    "Sender reference",
    true
  ),
  createProduct(
    "dtone",
    "airtime",
    "ORANGE",
    "DT One Orange CI Airtime",
    "Seeded local CI airtime catalog entry for Orange through DT One.",
    [1000, 2000, 5000, 10000, 20000],
    "Recipient phone",
    "Sender reference",
    true
  ),
  // ---------- Tiered data bundles ----------
  ...generateDataBundles()
]

function resolveRuntimeCompletionMode(product: CoteDIvoireCatalogProduct): CoteDIvoireCatalogProduct {
  if (!product.liveCapable) {
    return product
  }

  return {
    ...product,
    completionMode: getProviderMode(product.provider)
  }
}

export function listCoteDIvoireCatalog(provider?: CoteDIvoireProvider) {
  const catalog = provider ? localCatalog.filter((product) => product.provider === provider) : [...localCatalog]
  return catalog.map(resolveRuntimeCompletionMode)
}

export function getCoteDIvoireCatalogProduct(productId: string) {
  const product = localCatalog.find((candidate) => candidate.id === productId)
  return product ? resolveRuntimeCompletionMode(product) : undefined
}

export function listCoteDIvoireProviderSummaries() {
  return (Object.keys(providerLabels) as CoteDIvoireProvider[]).map((provider) => {
    const products = listCoteDIvoireCatalog(provider)

    return {
      provider,
      providerLabel: providerLabels[provider],
      productCount: products.length,
      brands: [...new Set(products.map((product) => product.brand))],
      categories: [...new Set(products.map((product) => product.category))],
      hasLiveCompletion: products.some((product) => product.completionMode === "live")
    }
  })
}

export function getProviderTransactionMode(provider: CoteDIvoireProvider) {
  return getProviderMode(provider)
}

export function inferCiBrandFromPhone(phone: string) {
  const normalized = phone.replace(/\D/g, "")

  if (normalized.startsWith("22505") || normalized.startsWith("05")) {
    return "MTN"
  }

  if (normalized.startsWith("22507") || normalized.startsWith("07")) {
    return "ORANGE"
  }

  if (normalized.startsWith("22501") || normalized.startsWith("01")) {
    return "MOOV"
  }

  return null
}