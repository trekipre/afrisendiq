import { getTransferProviders, updateTransferProvider } from "@/app/lib/transferProviders"

export async function GET() {
  const result = await getTransferProviders({ includeInactive: true })

  return Response.json({
    success: true,
    providers: result.providers,
    source: result.source,
    warning: result.warning
  })
}

export async function POST(request: Request) {
  const body = await request.json()

  try {
    const result = await updateTransferProvider(body)

    return Response.json({
      success: true,
      provider: result.provider,
      source: result.source,
      warning: result.warning
    })
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to save transfer provider"
      },
      { status: 400 }
    )
  }
}