import { getDTOneProducts } from "@/app/lib/dtone"

export type DtOneServiceType = "gift-cards" | "electricity"

type CatalogProduct = Record<string, unknown>

export type RawDtOneCatalogProduct = CatalogProduct

export type NormalizedDtOneProduct = {
  id: string
  name: string
  description: string
  country: string
  currency: string
  minAmount: number | null
  maxAmount: number | null
  priceLabel: string
}

export type DtOneServiceCatalogResult = {
  configured: boolean
  available: boolean
  reason?: string
  products: NormalizedDtOneProduct[]
}

const SERVICE_KEYWORDS: Record<DtOneServiceType, string[]> = {
  "gift-cards": ["gift", "jumia", "shopping", "retail"],
  electricity: ["electric", "electricity", "cie", "utility"]
}

const COTE_DIVOIRE_KEYWORDS = ["cote d'ivoire", "côte d'ivoire", "cote divoire", "côte divoire", "ivory coast"]

function getTextValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function getNestedTextValue(record: CatalogProduct, path: string[]): string {
  let current: unknown = record

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return ""
    }

    current = (current as Record<string, unknown>)[key]
  }

  return getTextValue(current)
}

function toProductArray(payload: unknown): CatalogProduct[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is CatalogProduct => typeof item === "object" && item !== null)
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>

    for (const collection of [record.items, record.products, record.data]) {
      if (Array.isArray(collection)) {
        return collection.filter((item): item is CatalogProduct => typeof item === "object" && item !== null)
      }
    }
  }

  return []
}

function getProductName(product: CatalogProduct): string {
  const candidates = [
    product.name,
    product.productName,
    product.product_name,
    product.description,
    product.shortDescription,
    product.displayName,
    getNestedTextValue(product, ["operator", "name"]),
    getNestedTextValue(product, ["service", "name"])
  ]

  return candidates.map(getTextValue).find(Boolean) || "Unnamed product"
}

function getProductId(product: CatalogProduct): string {
  const candidates = [product.id, product.sku, product.productId, product.code, product.product_id]

  return candidates.map((value) => (typeof value === "number" ? String(value) : getTextValue(value))).find(Boolean) || getProductName(product)
}

function getProductDescription(product: CatalogProduct): string {
  const candidates = [
    product.description,
    product.shortDescription,
    product.longDescription,
    getNestedTextValue(product, ["operator", "name"]),
    getNestedTextValue(product, ["service", "name"])
  ]

  return candidates.map(getTextValue).find(Boolean) || "Provider catalog item"
}

function getProductServiceName(product: CatalogProduct): string {
  const candidates = [
    getNestedTextValue(product, ["service", "name"]),
    getNestedTextValue(product, ["subservice", "name"]),
    getNestedTextValue(product, ["category", "name"])
  ]

  return candidates.find(Boolean) || ""
}

function getProductOperatorName(product: CatalogProduct): string {
  const candidates = [
    getNestedTextValue(product, ["operator", "name"]),
    getNestedTextValue(product, ["provider", "name"])
  ]

  return candidates.find(Boolean) || ""
}

function getProductTypeName(product: CatalogProduct): string {
  const candidates = [product.type, product.productType, product.product_type]

  return candidates.map(getTextValue).find(Boolean) || ""
}

function getProductCountry(product: CatalogProduct): string {
  const candidates = [
    getNestedTextValue(product, ["country", "name"]),
    getNestedTextValue(product, ["destination", "country"]),
    getNestedTextValue(product, ["geography", "country"]),
    getNestedTextValue(product, ["operator", "country", "name"])
  ]

  return candidates.find(Boolean) || "Cote d'Ivoire"
}

function getProductAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getProductPriceBand(product: CatalogProduct) {
  const minAmount = getProductAmount(product.minAmount ?? product.min_amount ?? product.minValue)
  const maxAmount = getProductAmount(product.maxAmount ?? product.max_amount ?? product.maxValue)
  const currency = getTextValue(product.currency) || getTextValue(product.currencyCode) || getTextValue(product.senderCurrencyCode) || ""

  let priceLabel = "Live pricing available at checkout when catalog is configured."

  if (minAmount !== null && maxAmount !== null) {
    priceLabel = `${minAmount} - ${maxAmount} ${currency}`.trim()
  } else if (minAmount !== null) {
    priceLabel = `From ${minAmount} ${currency}`.trim()
  } else if (maxAmount !== null) {
    priceLabel = `Up to ${maxAmount} ${currency}`.trim()
  }

  return {
    minAmount,
    maxAmount,
    currency,
    priceLabel
  }
}

export function hasDTOneCredentials() {
  return Boolean(process.env.DTONE_API_KEY && process.env.DTONE_API_SECRET && process.env.DTONE_BASE_URL)
}

function matchesCoteDIvoire(product: CatalogProduct) {
  const haystack = JSON.stringify(product).toLowerCase()
  return COTE_DIVOIRE_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

function matchesService(product: CatalogProduct, service: DtOneServiceType) {
  const haystack = JSON.stringify(product).toLowerCase()
  const serviceName = getProductServiceName(product).toLowerCase()
  const operatorName = getProductOperatorName(product).toLowerCase()
  const productName = getProductName(product).toLowerCase()
  const productType = getProductTypeName(product).toLowerCase()

  if (service === "electricity") {
    return (
      serviceName.includes("utilit") ||
      productType.includes("payment") ||
      operatorName.includes("cie") ||
      SERVICE_KEYWORDS[service].some((keyword) => haystack.includes(keyword.toLowerCase()))
    )
  }

  if (service === "gift-cards") {
    const looksLikeUtility =
      serviceName.includes("utilit") ||
      productType.includes("payment") ||
      operatorName.includes("cie") ||
      haystack.includes("electric")

    return (
      !looksLikeUtility &&
      (
        productType.includes("pin_purchase") ||
        serviceName.includes("gift") ||
        operatorName.includes("jumia") ||
        SERVICE_KEYWORDS[service].some((keyword) => productName.includes(keyword.toLowerCase()) || operatorName.includes(keyword.toLowerCase()))
      )
    )
  }

  return false
}

function normalizeProduct(product: CatalogProduct): NormalizedDtOneProduct {
  const { minAmount, maxAmount, currency, priceLabel } = getProductPriceBand(product)

  return {
    id: getProductId(product),
    name: getProductName(product),
    description: getProductDescription(product),
    country: getProductCountry(product),
    currency,
    minAmount,
    maxAmount,
    priceLabel
  }
}

export async function getDtOneServiceCatalog(service: DtOneServiceType): Promise<DtOneServiceCatalogResult> {
  if (!hasDTOneCredentials()) {
    return {
      configured: false,
      available: false,
      reason: "DT One environment variables are missing.",
      products: []
    }
  }

  try {
    const payload = await getDTOneProducts()
    const products = toProductArray(payload)
      .filter((product) => matchesCoteDIvoire(product) && matchesService(product, service))
      .map(normalizeProduct)

    return {
      configured: true,
      available: products.length > 0,
      reason: products.length > 0 ? undefined : "No matching Côte d'Ivoire products were returned by the current DT One catalog.",
      products
    }
  } catch (error) {
    return {
      configured: true,
      available: false,
      reason: error instanceof Error ? error.message : "Unable to load the DT One catalog.",
      products: []
    }
  }
}

export async function resolveDtOneProductIdForAmount(service: DtOneServiceType, amount: number) {
  const catalog = await getDtOneServiceCatalog(service)
  const rawProducts = await getRawDtOneServiceProducts(service)

  if (!catalog.available) {
    throw new Error(catalog.reason || `DT One ${service} catalog is unavailable.`)
  }

  const matched = catalog.products.find((product) => {
    const min = product.minAmount
    const max = product.maxAmount

    if (min !== null && amount < min) {
      return false
    }

    if (max !== null && amount > max) {
      return false
    }

    return true
  })

  if (!matched) {
    throw new Error(`No DT One ${service} product matches ${amount} XOF.`)
  }

  const numericId = Number(matched.id)

  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error(`Matched DT One ${service} product id is invalid: ${matched.id}`)
  }

  const rawProduct = rawProducts.find((product) => Number(product.id) === numericId || String(product.id) === matched.id)
  const rawSource = rawProduct?.source as Record<string, unknown> | undefined
  const rawDestination = rawProduct?.destination as Record<string, unknown> | undefined

  return {
    id: numericId,
    product: matched,
    source: rawSource
      ? {
          unit: typeof rawSource.unit === "string" ? rawSource.unit : undefined,
          unitType: typeof rawSource.unit_type === "string" ? rawSource.unit_type : undefined
        }
      : undefined,
    destination: rawDestination
      ? {
          unit: typeof rawDestination.unit === "string" ? rawDestination.unit : undefined,
          unitType: typeof rawDestination.unit_type === "string" ? rawDestination.unit_type : undefined
        }
      : undefined
  }
}

export function getSupportedDtOneServices() {
  return Object.keys(SERVICE_KEYWORDS) as DtOneServiceType[]
}

export async function getRawDtOneServiceProducts(service: DtOneServiceType): Promise<RawDtOneCatalogProduct[]> {
  if (!hasDTOneCredentials()) {
    return []
  }

  const payload = await getDTOneProducts()

  return toProductArray(payload).filter((product) => matchesCoteDIvoire(product) && matchesService(product, service))
}