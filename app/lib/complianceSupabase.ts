import type { OnboardingDraft } from "@/app/lib/onboardingSupabase"
import { getSupabase } from "@/app/lib/supabase"

export type ComplianceCaseSummary = {
  id: string
  onboardingDraftId?: string
  customerId?: string
  reason: string
  status: string
  priority: string
  decision?: string
  openedAt: string
  closedAt?: string
  updatedAt: string
}

export async function recordCaseAction(input: {
  caseId: string
  actorType: "system" | "admin" | "customer"
  actorId?: string
  action: string
  notes?: string
  payload?: Record<string, unknown>
}) {
  const supabase = getSupabase()
  const { error } = await supabase.from("case_actions").insert({
    case_id: input.caseId,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    action: input.action,
    notes: input.notes ?? null,
    payload: input.payload ?? null,
  })

  if (error) {
    console.error("[supabase] Failed to record case action:", error.message)
  }
}

export async function upsertSanctionsScreeningStub(input: {
  onboardingDraftId?: string
  customerId?: string
  draft: OnboardingDraft
}) {
  const supabase = getSupabase()
  const normalizedName = `${input.draft.legalFirstName} ${input.draft.legalLastName}`.trim().toLowerCase()
  const suspiciousKeywords = ["sanction", "blocked", "test match"]
  const hasPotentialMatch = suspiciousKeywords.some((keyword) => normalizedName.includes(keyword))
  const status = hasPotentialMatch ? "potential_match" : "clear"
  const matchScore = hasPotentialMatch ? 88 : 3

  const lookup = input.customerId
    ? await supabase
        .from("sanctions_screenings")
        .select("id")
        .eq("customer_id", input.customerId)
        .eq("screening_provider", "stub-internal")
        .eq("screening_type", "onboarding_name_screen")
        .limit(1)
    : await supabase
        .from("sanctions_screenings")
        .select("id")
        .eq("onboarding_draft_id", input.onboardingDraftId ?? "")
        .eq("screening_provider", "stub-internal")
        .eq("screening_type", "onboarding_name_screen")
        .limit(1)

  const existingId = lookup.data?.[0]?.id as string | undefined
  const payload = {
    onboarding_draft_id: input.onboardingDraftId ?? null,
    customer_id: input.customerId ?? null,
    screening_provider: "stub-internal",
    screening_type: "onboarding_name_screen",
    status,
    match_score: matchScore,
    raw_result: {
      mode: "stub",
      status,
      matchScore,
      screenedName: `${input.draft.legalFirstName} ${input.draft.legalLastName}`.trim(),
      evaluatedAt: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  }

  const result = existingId
    ? await supabase.from("sanctions_screenings").update(payload).eq("id", existingId)
    : await supabase.from("sanctions_screenings").insert(payload)

  if (result.error) {
    console.error("[supabase] Failed to upsert sanctions screening stub:", result.error.message)
  }
}

export async function listComplianceCases(status?: string): Promise<ComplianceCaseSummary[]> {
  const supabase = getSupabase()
  let query = supabase
    .from("compliance_cases")
    .select("id, onboarding_draft_id, customer_id, reason, status, priority, decision, opened_at, closed_at, updated_at")
    .order("opened_at", { ascending: false })

  if (status && status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query.limit(100)
  if (error || !data) {
    if (error) {
      console.error("[supabase] Failed to list compliance cases:", error.message)
    }
    return []
  }

  return data.map((row) => ({
    id: row.id as string,
    onboardingDraftId: (row.onboarding_draft_id as string | null) ?? undefined,
    customerId: (row.customer_id as string | null) ?? undefined,
    reason: row.reason as string,
    status: row.status as string,
    priority: row.priority as string,
    decision: (row.decision as string | null) ?? undefined,
    openedAt: row.opened_at as string,
    closedAt: (row.closed_at as string | null) ?? undefined,
    updatedAt: row.updated_at as string,
  }))
}