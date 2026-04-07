import { recordCaseAction } from "@/app/lib/complianceSupabase"
import { materializeApprovedDraft } from "@/app/lib/onboardingSupabase"
import { getSupabase } from "@/app/lib/supabase"

type ReviewAction = "approve" | "request_info" | "reject"

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await context.params
  const body = await request.json()
  const action = String(body?.action || "") as ReviewAction
  const adminId = String(body?.adminId || "compliance_admin")
  const notes = typeof body?.notes === "string" ? body.notes : undefined

  if (!["approve", "request_info", "reject"].includes(action)) {
    return Response.json({ success: false, error: "action must be approve, request_info, or reject" }, { status: 400 })
  }

  const supabase = getSupabase()
  const { data: complianceCase, error } = await supabase
    .from("compliance_cases")
    .select("id, onboarding_draft_id")
    .eq("id", caseId)
    .single()

  if (error || !complianceCase) {
    return Response.json({ success: false, error: "Compliance case not found" }, { status: 404 })
  }

  const now = new Date().toISOString()
  const nextStatus = action === "request_info" ? "needs_customer_action" : "resolved"
  const nextDecision = action === "approve" ? "approved" : action === "request_info" ? "needs_more_info" : "rejected"

  const { error: updateError } = await supabase
    .from("compliance_cases")
    .update({
      status: nextStatus,
      decision: nextDecision,
      closed_at: action === "request_info" ? null : now,
      updated_at: now,
    })
    .eq("id", caseId)

  if (updateError) {
    return Response.json({ success: false, error: updateError.message }, { status: 500 })
  }

  await recordCaseAction({
    caseId,
    actorType: "admin",
    actorId: adminId,
    action: `compliance_review_${action}`,
    notes,
    payload: { reviewedAt: now },
  })

  if (complianceCase.onboarding_draft_id) {
    const draftStatus = action === "approve" ? "approved" : action === "request_info" ? "submitted" : "rejected"
    await supabase
      .from("onboarding_drafts")
      .update({ status: draftStatus, updated_at: now })
      .eq("id", complianceCase.onboarding_draft_id)

    if (action === "approve") {
      return Response.json({
        success: true,
        caseId,
        action,
        result: await materializeApprovedDraft(complianceCase.onboarding_draft_id as string),
      })
    }
  }

  return Response.json({ success: true, caseId, action })
}