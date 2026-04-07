import { NextRequest, NextResponse } from "next/server"

type NominatimSearchResult = {
  display_name: string
  lat: string
  lon: string
  address?: {
    house_number?: string
    road?: string
    city?: string
    town?: string
    village?: string
    state?: string
    postcode?: string
    country_code?: string
  }
}

function buildLine1(address?: NominatimSearchResult["address"]) {
  if (!address) {
    return ""
  }

  return [address.house_number, address.road].filter(Boolean).join(" ")
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || ""
  const countryCode = request.nextUrl.searchParams.get("countryCode")?.trim().toLowerCase() || "us"

  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] })
  }

  const upstream = new URL("https://nominatim.openstreetmap.org/search")
  upstream.searchParams.set("q", query)
  upstream.searchParams.set("format", "jsonv2")
  upstream.searchParams.set("addressdetails", "1")
  upstream.searchParams.set("limit", "5")
  upstream.searchParams.set("countrycodes", countryCode)

  try {
    const response = await fetch(upstream, {
      headers: {
        "User-Agent": "AfriSendIQ Onboarding Address Lookup",
      },
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      throw new Error(`Address search failed with status ${response.status}`)
    }

    const results = (await response.json()) as NominatimSearchResult[]

    const suggestions = results.map((result) => ({
      label: result.display_name,
      line1: buildLine1(result.address),
      city: result.address?.city || result.address?.town || result.address?.village || "",
      region: result.address?.state || "",
      postalCode: result.address?.postcode || "",
      countryCode: result.address?.country_code?.toUpperCase() || countryCode.toUpperCase(),
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to search addresses right now",
      },
      { status: 502 }
    )
  }
}