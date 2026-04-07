import { listCoteDIvoireCatalog, listCoteDIvoireProviderSummaries, type CoteDIvoireProvider } from "@/app/lib/coteDivoireCatalog"

function isProvider(value: string): value is CoteDIvoireProvider {
  return value === "reloadly" || value === "ding" || value === "dtone"
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get("provider")

  if (provider && !isProvider(provider)) {
    return Response.json({ success: false, error: "Unknown provider" }, { status: 400 })
  }

  const validProvider: CoteDIvoireProvider | undefined = provider && isProvider(provider) ? provider : undefined

  return Response.json({
    success: true,
    provider: validProvider ?? null,
    providers: listCoteDIvoireProviderSummaries(),
    products: listCoteDIvoireCatalog(validProvider)
  })
}