import { listCoteDIvoireCatalog } from "@/app/lib/coteDivoireCatalog"

function hasLiveCatalogProducts(category: string) {
  return listCoteDIvoireCatalog().some(
    (p) => p.category === category && p.liveCapable
  )
}

export async function GET() {
  const hasGiftCardCatalogProducts = hasLiveCatalogProducts("gift-card")

  return Response.json({
    success: true,
    services: {
      compare: { available: true },
      "phone-top-up": { available: true },
      "data-top-up": { available: true },
      sodeci: { available: true },
      "cie-postpaid": { available: true },
      "canal-plus": { available: true },
      "gift-cards": { available: hasGiftCardCatalogProducts },
      electricity: { available: true }
    }
  })
}