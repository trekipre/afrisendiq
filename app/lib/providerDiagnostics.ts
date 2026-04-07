import { hasDingCredentials, getDingAccessToken } from "@/app/lib/dingAuth"
import { getDTOneProducts } from "@/app/lib/dtone"
import { getDtOneServiceCatalog, hasDTOneCredentials } from "@/app/lib/dtoneCatalog"
import { getDingProducts, getDingProviders, type DingProduct, type DingProvider } from "@/app/providers/ding"

type DiagnosticCoverage = {
  countryIso: string
  providerCount: number
  productCount: number
  providers: string[]
  categories: string[]
  highlights: string[]
}

export type ProviderDiagnosticResult = {
  provider: "ding" | "dtone"
  configured: boolean
  authOk: boolean
  apiReachable: boolean
  message?: string
  coverage?: DiagnosticCoverage
  details?: Record<string, unknown>
}

type DtOneCatalogProduct = Record<string, unknown>

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right))
}

function getDtOneText(product: DtOneCatalogProduct, path: string[]) {
  let current: unknown = product

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return ""
    }

    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === "string" ? current : ""
}

export function summarizeDingCoverage(providers: DingProvider[], products: DingProduct[]): DiagnosticCoverage {
  const providerNames = uniqueSorted(providers.map((provider) => provider.Name))
  const categories = uniqueSorted(products.flatMap((product) => product.Benefits || []))
  const highlights = uniqueSorted(
    providerNames.filter((name) => {
      const lowerName = name.toLowerCase()
      return lowerName.includes("mtn") || lowerName.includes("moov") || lowerName.includes("orange") || lowerName.includes("jumia") || lowerName.includes("cie")
    })
  )

  return {
    countryIso: "CI",
    providerCount: providers.length,
    productCount: products.length,
    providers: providerNames,
    categories,
    highlights
  }
}

export function summarizeDtOneCoverage(products: DtOneCatalogProduct[]): DiagnosticCoverage {
  const providers = uniqueSorted(products.map((product) => getDtOneText(product, ["operator", "name"]) || getDtOneText(product, ["name"])))
  const categories = uniqueSorted(products.map((product) => getDtOneText(product, ["service", "name"])))
  const highlights = uniqueSorted(
    providers.filter((name) => {
      const lowerName = name.toLowerCase()
      return lowerName.includes("mtn") || lowerName.includes("moov") || lowerName.includes("orange") || lowerName.includes("jumia") || lowerName.includes("cie")
    })
  )

  return {
    countryIso: "CI",
    providerCount: providers.length,
    productCount: products.length,
    providers,
    categories,
    highlights
  }
}

export async function getDingDiagnostics(): Promise<ProviderDiagnosticResult> {
  if (!hasDingCredentials()) {
    return {
      provider: "ding",
      configured: false,
      authOk: false,
      apiReachable: false,
      message: "Ding credentials are not configured."
    }
  }

  try {
    const token = await getDingAccessToken()

    try {
      const [providerResponse, productResponse] = await Promise.all([
        getDingProviders({ countryIsos: ["CI"] }),
        getDingProducts({ countryIsos: ["CI"] })
      ])

      const providers = providerResponse.Items || []
      const products = productResponse.Items || []

      return {
        provider: "ding",
        configured: true,
        authOk: true,
        apiReachable: true,
        coverage: summarizeDingCoverage(providers, products),
        details: {
          scope: (() => {
            const payload = JSON.parse(Buffer.from(token.split(".")[1] || "", "base64url").toString("utf8")) as { scope?: string[] }
            return payload.scope || []
          })(),
          resultCode: productResponse.ResultCode,
          hasMoreItems: productResponse.ThereAreMoreItems || false
        }
      }
    } catch (error) {
      return {
        provider: "ding",
        configured: true,
        authOk: true,
        apiReachable: false,
        message: error instanceof Error ? error.message : "Unable to reach Ding API.",
        details: {
          baseUrl: process.env.DING_BASE_URL || "https://www.dingconnect.com/api/V1"
        }
      }
    }
  } catch (error) {
    return {
      provider: "ding",
      configured: true,
      authOk: false,
      apiReachable: false,
      message: error instanceof Error ? error.message : "Unable to authenticate with Ding.",
      details: {
        tokenUrl: process.env.DING_TOKEN_URL || "https://idp.ding.com/connect/token"
      }
    }
  }
}

export async function getDtOneDiagnostics(): Promise<ProviderDiagnosticResult> {
  if (!hasDTOneCredentials()) {
    return {
      provider: "dtone",
      configured: false,
      authOk: false,
      apiReachable: false,
      message: "DT One credentials are not configured."
    }
  }

  try {
    const products = await getDTOneProducts()
    const productList = Array.isArray(products) ? products : []
    const [electricity, giftCards] = await Promise.all([
      getDtOneServiceCatalog("electricity"),
      getDtOneServiceCatalog("gift-cards")
    ])

    return {
      provider: "dtone",
      configured: true,
      authOk: true,
      apiReachable: true,
      coverage: summarizeDtOneCoverage(productList as DtOneCatalogProduct[]),
      details: {
        services: {
          electricity: electricity.products.length,
          giftCards: giftCards.products.length
        }
      }
    }
  } catch (error) {
    return {
      provider: "dtone",
      configured: true,
      authOk: false,
      apiReachable: false,
      message: error instanceof Error ? error.message : "Unable to reach DT One API."
    }
  }
}