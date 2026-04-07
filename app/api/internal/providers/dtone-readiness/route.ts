import { listCoteDIvoireCatalog, getProviderTransactionMode } from "@/app/lib/coteDivoireCatalog"
import { getDtOneServiceCatalog, hasDTOneCredentials } from "@/app/lib/dtoneCatalog"

async function buildReadinessResponse() {
  const executionMode = getProviderTransactionMode("dtone")
  const credentialsLoaded = hasDTOneCredentials()
  const electricityCatalog = await getDtOneServiceCatalog("electricity")
  const cieElectricityProduct = listCoteDIvoireCatalog("dtone").find(
    (product) => product.brand === "CIE" && product.category === "electricity"
  )

  return {
    success: true,
    dtone: {
      credentialsLoaded,
      executionMode,
      electricityCatalogConfigured: electricityCatalog.configured,
      electricityCatalogAvailable: electricityCatalog.available,
      electricityCatalogReason: electricityCatalog.reason ?? null,
      cieElectricityProduct: cieElectricityProduct
        ? {
            id: cieElectricityProduct.id,
            name: cieElectricityProduct.name,
            completionMode: cieElectricityProduct.completionMode,
            liveCapable: cieElectricityProduct.liveCapable
          }
        : null,
      safeForLiveCiePrepaid:
        credentialsLoaded &&
        executionMode === "live" &&
        electricityCatalog.available &&
        cieElectricityProduct?.completionMode === "live"
    }
  }
}

export async function GET() {
  return Response.json(await buildReadinessResponse())
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { mode?: string }

  if (body.mode !== "live" && body.mode !== "simulated") {
    return Response.json({ success: false, error: "mode must be 'live' or 'simulated'" }, { status: 400 })
  }

  if (!hasDTOneCredentials()) {
    return Response.json({ success: false, error: "DT One credentials are not loaded in the current runtime." }, { status: 409 })
  }

  process.env.DTONE_TRANSACTION_MODE = body.mode

  return Response.json(await buildReadinessResponse())
}