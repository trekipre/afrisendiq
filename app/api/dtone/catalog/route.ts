import { getDtOneServiceCatalog, getSupportedDtOneServices, type DtOneServiceType } from "@/app/lib/dtoneCatalog"

function isServiceType(value: string): value is DtOneServiceType {
  return getSupportedDtOneServices().includes(value as DtOneServiceType)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const service = searchParams.get("service")

  if (!service || !isServiceType(service)) {
    return Response.json(
      {
        success: false,
        error: "A valid DT One service is required"
      },
      { status: 400 }
    )
  }

  const catalog = await getDtOneServiceCatalog(service)

  return Response.json({
    success: true,
    service,
    ...catalog
  })
}