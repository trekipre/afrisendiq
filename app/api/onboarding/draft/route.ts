import { NextRequest, NextResponse } from "next/server"
import { fetchOnboardingDraft, persistOnboardingDraft } from "@/app/lib/onboardingSupabase"
import type { OnboardingDraftInput } from "@/app/lib/onboardingCompliance"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const draftId = request.nextUrl.searchParams.get("draftId")

  if (!draftId) {
    return NextResponse.json({ error: "draftId is required" }, { status: 400 })
  }

  const state = await fetchOnboardingDraft(draftId)
  if (!state) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 })
  }

  return NextResponse.json(state)
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<OnboardingDraftInput>

  const currentStep = Number(body.currentStep)
  if (!Number.isFinite(currentStep)) {
    return NextResponse.json({ error: "currentStep is required" }, { status: 400 })
  }

  const payload: OnboardingDraftInput = {
    id: body.id,
    status: body.status,
    currentStep,
    email: String(body.email || ""),
    phone: String(body.phone || ""),
    legalFirstName: String(body.legalFirstName || ""),
    legalLastName: String(body.legalLastName || ""),
    countryOfResidence: String(body.countryOfResidence || "United States"),
    dateOfBirth: String(body.dateOfBirth || ""),
    addressLine1: String(body.addressLine1 || ""),
    addressLine2: String(body.addressLine2 || ""),
    city: String(body.city || ""),
    region: String(body.region || ""),
    postalCode: String(body.postalCode || ""),
    countryCode: String(body.countryCode || "US"),
    authPreference: (body.authPreference as OnboardingDraftInput["authPreference"]) || "passkey",
    enableTrustedDevice: body.enableTrustedDevice !== false,
  }

  const state = await persistOnboardingDraft(payload)
  if (!state) {
    return NextResponse.json({ error: "Unable to persist onboarding draft" }, { status: 500 })
  }

  return NextResponse.json(state)
}