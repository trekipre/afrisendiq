import { NextRequest, NextResponse } from "next/server"
import { submitOnboardingDraft } from "@/app/lib/onboardingSupabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const draftId = String(body?.draftId || "")

  if (!draftId) {
    return NextResponse.json({ error: "draftId is required" }, { status: 400 })
  }

  const result = await submitOnboardingDraft(draftId)
  if (!result) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 })
  }

  return NextResponse.json(result)
}