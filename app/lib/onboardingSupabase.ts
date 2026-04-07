import { getSupabase } from "@/app/lib/supabase"
import { evaluateOnboardingDraft, type OnboardingDecision, type OnboardingDraftInput } from "@/app/lib/onboardingCompliance"
import { recordCaseAction, upsertSanctionsScreeningStub } from "@/app/lib/complianceSupabase"

type OnboardingDraftRow = {
  id: string
  customer_id: string | null
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected"
  current_step: number
  email: string | null
  phone: string | null
  legal_first_name: string | null
  legal_last_name: string | null
  country_of_residence: string
  date_of_birth: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  region: string | null
  postal_code: string | null
  country_code: string
  auth_preference: OnboardingDraftInput["authPreference"]
  enable_trusted_device: boolean
  draft_payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

type CustomerLimitRow = {
  onboarding_draft_id: string
  tier: string
  limit_currency: string
  per_transaction_limit: number
  daily_amount_limit: number
  monthly_amount_limit: number
  updated_at?: string
}

type CustomerRiskProfileRow = {
  onboarding_draft_id: string
  risk_level: string
  risk_score: number
  pep_hit: boolean
  sanctions_hit: boolean
  device_risk_score: number
  requires_step_up: boolean
  step_up_reason: string | null
  updated_at?: string
}

type ComplianceCaseRow = {
  id: string
  onboarding_draft_id: string | null
  reason: string
  status: string
  priority: string
  decision: string | null
  opened_at: string
  closed_at: string | null
  updated_at: string
}

export type OnboardingDraft = OnboardingDraftInput & {
  id: string
  customerId?: string
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected"
  createdAt: string
  updatedAt: string
}

export type PersistedOnboardingState = {
  draft: OnboardingDraft
  decision: OnboardingDecision
  customerId?: string
  caseId?: string
  caseStatus?: string
}

function mapDraftRowToModel(row: OnboardingDraftRow): OnboardingDraft {
  return {
    id: row.id,
    customerId: row.customer_id ?? undefined,
    status: row.status,
    currentStep: row.current_step,
    email: row.email ?? "",
    phone: row.phone ?? "",
    legalFirstName: row.legal_first_name ?? "",
    legalLastName: row.legal_last_name ?? "",
    countryOfResidence: row.country_of_residence,
    dateOfBirth: row.date_of_birth ?? "",
    addressLine1: row.address_line_1 ?? "",
    addressLine2: row.address_line_2 ?? "",
    city: row.city ?? "",
    region: row.region ?? "",
    postalCode: row.postal_code ?? "",
    countryCode: row.country_code,
    authPreference: row.auth_preference,
    enableTrustedDevice: row.enable_trusted_device,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDraftInputToRow(input: OnboardingDraftInput) {
  return {
    id: input.id,
    status: input.status ?? "draft",
    current_step: input.currentStep,
    email: input.email || null,
    phone: input.phone || null,
    legal_first_name: input.legalFirstName || null,
    legal_last_name: input.legalLastName || null,
    country_of_residence: input.countryOfResidence,
    date_of_birth: input.dateOfBirth || null,
    address_line_1: input.addressLine1 || null,
    address_line_2: input.addressLine2 || null,
    city: input.city || null,
    region: input.region || null,
    postal_code: input.postalCode || null,
    country_code: input.countryCode,
    auth_preference: input.authPreference,
    enable_trusted_device: input.enableTrustedDevice,
    draft_payload: {
      currentStep: input.currentStep,
    },
    updated_at: new Date().toISOString(),
  }
}

async function upsertCustomerLimitsForDraft(draftId: string, decision: OnboardingDecision) {
  const supabase = getSupabase()
  const row: CustomerLimitRow = {
    onboarding_draft_id: draftId,
    tier: decision.verificationTier,
    limit_currency: decision.recommendedLimits.currency,
    per_transaction_limit: decision.recommendedLimits.perTransaction,
    daily_amount_limit: decision.recommendedLimits.dailyAmount,
    monthly_amount_limit: decision.recommendedLimits.monthlyAmount,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("customer_limits").upsert(row, { onConflict: "onboarding_draft_id" })
  if (error) {
    console.error("[supabase] Failed to upsert customer limits:", error.message)
  }
}

async function upsertRiskProfileForDraft(draftId: string, decision: OnboardingDecision) {
  const supabase = getSupabase()
  const row: CustomerRiskProfileRow = {
    onboarding_draft_id: draftId,
    risk_level: decision.riskLevel,
    risk_score: decision.riskScore,
    pep_hit: false,
    sanctions_hit: false,
    device_risk_score: 0,
    requires_step_up: decision.requiresStepUp,
    step_up_reason: decision.stepUpReason ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("customer_risk_profiles").upsert(row, { onConflict: "onboarding_draft_id" })
  if (error) {
    console.error("[supabase] Failed to upsert customer risk profile:", error.message)
  }
}

async function upsertComplianceCaseForDraft(draftId: string, decision: OnboardingDecision) {
  const supabase = getSupabase()
  const { data: existing } = await supabase
    .from("compliance_cases")
    .select("id, onboarding_draft_id, reason, status, priority, decision, opened_at, closed_at, updated_at")
    .eq("onboarding_draft_id", draftId)
    .in("status", ["open", "pending_review", "needs_customer_action"])
    .order("opened_at", { ascending: false })
    .limit(1)

  const activeCase = (existing?.[0] as ComplianceCaseRow | undefined) ?? null

  if (!decision.requiresManualReview && activeCase) {
    const { error } = await supabase
      .from("compliance_cases")
      .update({
        status: "closed_no_issue",
        decision: "auto_closed_after_reassessment",
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeCase.id)

    if (error) {
      console.error("[supabase] Failed to close compliance case:", error.message)
    }

    await recordCaseAction({
      caseId: activeCase.id,
      actorType: "system",
      action: "compliance_case_auto_closed",
      notes: "Draft risk reassessment removed the need for manual review.",
      payload: { onboardingDraftId: draftId, decisionStatus: decision.status },
    })

    return { caseId: activeCase.id, caseStatus: "closed_no_issue" }
  }

  if (!decision.requiresManualReview) {
    return { caseId: undefined, caseStatus: undefined }
  }

  if (activeCase) {
    const nextStatus = decision.status === "needs_more_info" ? "needs_customer_action" : "pending_review"
    const { error } = await supabase
      .from("compliance_cases")
      .update({
        reason: decision.caseReason ?? activeCase.reason,
        status: nextStatus,
        priority: decision.riskLevel === "high" ? "high" : "medium",
        decision: decision.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeCase.id)

    if (error) {
      console.error("[supabase] Failed to update compliance case:", error.message)
    }

    await recordCaseAction({
      caseId: activeCase.id,
      actorType: "system",
      action: "compliance_case_reassessed",
      notes: "Draft changes updated the case review posture.",
      payload: { onboardingDraftId: draftId, decisionStatus: decision.status },
    })

    return { caseId: activeCase.id, caseStatus: nextStatus }
  }

  const row = {
    onboarding_draft_id: draftId,
    reason: decision.caseReason ?? "Manual onboarding review required",
    status: decision.status === "needs_more_info" ? "needs_customer_action" : "pending_review",
    priority: decision.riskLevel === "high" ? "high" : "medium",
    decision: decision.status,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("compliance_cases")
    .insert(row)
    .select("id, status")
    .single()

  if (error) {
    console.error("[supabase] Failed to create compliance case:", error.message)
    return { caseId: undefined, caseStatus: undefined }
  }

  if (data?.id) {
    await recordCaseAction({
      caseId: data.id as string,
      actorType: "system",
      action: "compliance_case_opened",
      notes: "Draft triggered manual compliance review.",
      payload: { onboardingDraftId: draftId, decisionStatus: decision.status },
    })
  }

  return { caseId: data?.id as string | undefined, caseStatus: data?.status as string | undefined }
}

export async function persistOnboardingDraft(input: OnboardingDraftInput): Promise<PersistedOnboardingState | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("onboarding_drafts")
    .upsert(mapDraftInputToRow(input), { onConflict: "id" })
    .select("*")
    .single()

  if (error || !data) {
    if (error) {
      console.error("[supabase] Failed to persist onboarding draft:", error.message)
    }
    return null
  }

  const draft = mapDraftRowToModel(data as OnboardingDraftRow)
  const decision = evaluateOnboardingDraft(draft)

  await upsertCustomerLimitsForDraft(draft.id, decision)
  await upsertRiskProfileForDraft(draft.id, decision)
  await upsertSanctionsScreeningStub({ onboardingDraftId: draft.id, customerId: draft.customerId, draft })
  const complianceCase = await upsertComplianceCaseForDraft(draft.id, decision)

  return {
    draft,
    decision,
    customerId: draft.customerId,
    ...complianceCase,
  }
}

export async function fetchOnboardingDraft(draftId: string): Promise<PersistedOnboardingState | null> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("onboarding_drafts")
      .select("*")
      .eq("id", draftId)
      .single()

    if (error || !data) {
      return null
    }

    const draft = mapDraftRowToModel(data as OnboardingDraftRow)
    const decision = evaluateOnboardingDraft(draft)

    const { data: activeCases, error: activeCaseError } = await supabase
      .from("compliance_cases")
      .select("id, status")
      .eq("onboarding_draft_id", draftId)
      .order("opened_at", { ascending: false })
      .limit(1)

    if (activeCaseError) {
      console.error("[supabase] Failed to fetch active compliance case:", activeCaseError.message)
    }

    const activeCase = activeCases?.[0] as { id?: string; status?: string } | undefined

    return {
      draft,
      decision,
      customerId: draft.customerId,
      caseId: activeCase?.id,
      caseStatus: activeCase?.status,
    }
  }

  async function upsertCustomerLimitsForCustomer(customerId: string, decision: OnboardingDecision) {
    const supabase = getSupabase()
    const row = {
      customer_id: customerId,
      tier: decision.verificationTier,
      limit_currency: decision.recommendedLimits.currency,
      per_transaction_limit: decision.recommendedLimits.perTransaction,
      daily_amount_limit: decision.recommendedLimits.dailyAmount,
      monthly_amount_limit: decision.recommendedLimits.monthlyAmount,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from("customer_limits").upsert(row, { onConflict: "customer_id" })
    if (error) {
      console.error("[supabase] Failed to upsert customer limits:", error.message)
    }
  }

  async function upsertRiskProfileForCustomer(customerId: string, decision: OnboardingDecision) {
    const supabase = getSupabase()
    const row = {
      customer_id: customerId,
      risk_level: decision.riskLevel,
      risk_score: decision.riskScore,
      pep_hit: false,
      sanctions_hit: false,
      device_risk_score: 0,
      requires_step_up: decision.requiresStepUp,
      step_up_reason: decision.stepUpReason ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from("customer_risk_profiles").upsert(row, { onConflict: "customer_id" })
    if (error) {
      console.error("[supabase] Failed to upsert customer risk profile:", error.message)
    }
  }

  export async function submitOnboardingDraft(draftId: string): Promise<PersistedOnboardingState | null> {
    const current = await fetchOnboardingDraft(draftId)
    if (!current) {
      return null
    }

    const nextStatus = current.decision.status === "approved"
      ? "approved"
      : current.decision.status === "under_review"
        ? "under_review"
        : current.decision.status === "blocked"
          ? "rejected"
          : "submitted"

    const persisted = await persistOnboardingDraft({
      ...current.draft,
      status: nextStatus,
    })

    if (!persisted) {
      return null
    }

    if (persisted.decision.status === "approved") {
      return materializeApprovedDraft(draftId)
    }

    return persisted
  }

  export async function materializeApprovedDraft(draftId: string): Promise<PersistedOnboardingState | null> {
    const current = await fetchOnboardingDraft(draftId)
    if (!current) {
      return null
    }

    if (current.decision.status !== "approved") {
      return current
    }

    const supabase = getSupabase()
    const now = new Date().toISOString()
    let customerId = current.draft.customerId

    if (!customerId) {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .upsert(
          {
            email: current.draft.email,
            phone_e164: current.draft.phone || null,
            status: "active",
            updated_at: now,
          },
          { onConflict: "email" }
        )
        .select("id")
        .single()

      if (customerError || !customer) {
        if (customerError) {
          console.error("[supabase] Failed to materialize customer from approved draft:", customerError.message)
        }
        return current
      }

      customerId = customer.id as string
    }

    const profileResult = await supabase.from("customer_profiles").upsert(
      {
        customer_id: customerId,
        legal_first_name: current.draft.legalFirstName,
        legal_last_name: current.draft.legalLastName,
        date_of_birth: current.draft.dateOfBirth || null,
        country_of_residence: current.draft.countryOfResidence,
        address_line_1: current.draft.addressLine1 || null,
        address_line_2: current.draft.addressLine2 || null,
        city: current.draft.city || null,
        region: current.draft.region || null,
        postal_code: current.draft.postalCode || null,
        country_code: current.draft.countryCode || null,
        address_source: "onboarding_draft",
        updated_at: now,
      },
      { onConflict: "customer_id" }
    )

    if (profileResult.error) {
      console.error("[supabase] Failed to upsert customer profile:", profileResult.error.message)
    }

    const contactRows = [
      {
        customer_id: customerId,
        type: "email",
        value: current.draft.email,
        verified: false,
      },
      ...(current.draft.phone
        ? [{ customer_id: customerId, type: "phone", value: current.draft.phone, verified: false }]
        : []),
    ]

    const contactsResult = await supabase
      .from("customer_contact_methods")
      .upsert(contactRows, { onConflict: "customer_id,type,value" })

    if (contactsResult.error) {
      console.error("[supabase] Failed to upsert customer contact methods:", contactsResult.error.message)
    }

    const authFactorResult = await supabase.from("auth_factors").upsert(
      {
        customer_id: customerId,
        factor_type: current.draft.authPreference,
        status: "pending",
      },
      { onConflict: "customer_id,factor_type" }
    )

    if (authFactorResult.error) {
      console.error("[supabase] Failed to upsert auth factor:", authFactorResult.error.message)
    }

    if (current.draft.enableTrustedDevice) {
      const trustedDeviceResult = await supabase.from("trusted_devices").insert({
        customer_id: customerId,
        device_label: "Onboarding draft trusted device",
        device_fingerprint: `draft:${current.draft.id}`,
      })

      if (trustedDeviceResult.error) {
        console.error("[supabase] Failed to insert trusted device:", trustedDeviceResult.error.message)
      }
    }

    await upsertCustomerLimitsForCustomer(customerId, current.decision)
    await upsertRiskProfileForCustomer(customerId, current.decision)
    await upsertSanctionsScreeningStub({
      onboardingDraftId: current.draft.id,
      customerId,
      draft: current.draft,
    })

    const { error: draftError } = await supabase
      .from("onboarding_drafts")
      .update({ customer_id: customerId, status: "approved", updated_at: now })
      .eq("id", current.draft.id)

    if (draftError) {
      console.error("[supabase] Failed to link approved draft to customer:", draftError.message)
    }

    const { data: activeCases } = await supabase
      .from("compliance_cases")
      .select("id")
      .eq("onboarding_draft_id", current.draft.id)
      .in("status", ["open", "pending_review", "needs_customer_action"])

    for (const complianceCase of activeCases || []) {
      await supabase
        .from("compliance_cases")
        .update({
          customer_id: customerId,
          status: "resolved",
          decision: "approved",
          closed_at: now,
          updated_at: now,
        })
        .eq("id", complianceCase.id)

      await recordCaseAction({
        caseId: complianceCase.id as string,
        actorType: "system",
        action: "draft_materialized_to_customer",
        notes: "Approved onboarding draft was materialized into a customer record.",
        payload: { draftId: current.draft.id, customerId },
      })
    }

    return fetchOnboardingDraft(draftId)
  }