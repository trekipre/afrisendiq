import { NextRequest, NextResponse } from "next/server"

type NominatimReverseResult = {
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

function buildLine1(address?: NominatimReverseResult["address"]) {
  if (!address) {
    return ""
  }

  return [address.house_number, address.road].filter(Boolean).join(" ")
}

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"))
  const lon = Number(request.nextUrl.searchParams.get("lon"))

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Valid lat and lon are required" }, { status: 400 })
  }

  const upstream = new URL("https://nominatim.openstreetmap.org/reverse")
  upstream.searchParams.set("lat", String(lat))
  upstream.searchParams.set("lon", String(lon))
  upstream.searchParams.set("format", "jsonv2")
  upstream.searchParams.set("addressdetails", "1")

  try {
    const response = await fetch(upstream, {
      headers: {
        "User-Agent": "AfriSendIQ Onboarding Address Reverse Lookup",
      },
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      throw new Error(`Address reverse lookup failed with status ${response.status}`)
    }

    const result = (await response.json()) as NominatimReverseResult

    return NextResponse.json({
      suggestion: {
        label: result.display_name,
        line1: buildLine1(result.address),
        city: result.address?.city || result.address?.town || result.address?.village || "",
        region: result.address?.state || "",
        postalCode: result.address?.postcode || "",
        countryCode: result.address?.country_code?.toUpperCase() || "US",
        latitude: Number(result.lat),
        longitude: Number(result.lon),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to detect your address right now",
      },
      { status: 502 }
    )
  }
}