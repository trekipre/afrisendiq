import { getTransferProviders } from "@/app/lib/transferProviders"

export async function GET() {
  const result = await getTransferProviders()

  return Response.json({
    success: true,
    providers: result.providers,
    source: result.source,
    warning: result.warning
  })
}