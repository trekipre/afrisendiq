import { getSupabase } from "@/app/lib/supabase"
import { normalizeManualBillingAccountReference, normalizeManualBillingPhone } from "@/app/lib/manualBillingIntelligence"
import type { ManualBillingDeliveryChannel, ManualBillingService } from "@/app/lib/manualBillingState"

type ManualBillingRecipientProfileRow = {
  id: string
  owner_email: string
  service: ManualBillingService
  country_code: "CI"
  recipient_name: string
  account_reference: string
  normalized_account_reference: string
  phone: string | null
  normalized_phone: string | null
  preferred_delivery_channel: ManualBillingDeliveryChannel
  created_at: string
  updated_at: string
}

export type SavedManualBillingRecipient = {
  id: string
  ownerEmail: string
  service: ManualBillingService
  countryCode: "CI"
  recipientName: string
  accountReference: string
  normalizedAccountReference: string
  phone?: string
  normalizedPhone?: string
  preferredDeliveryChannel: ManualBillingDeliveryChannel
  createdAt: string
  updatedAt: string
}

type UpsertSavedManualBillingRecipientInput = {
  ownerEmail: string
  service: ManualBillingService
  countryCode: "CI"
  recipientName: string
  accountReference: string
  phone?: string
  preferredDeliveryChannel?: ManualBillingDeliveryChannel
}

type ResolveManualBillingDeliveryTargetInput = {
  ownerEmail: string
  service: ManualBillingService
  countryCode: "CI"
  accountReference: string
  phone?: string
}

const recipientProfileCache = new Map<string, SavedManualBillingRecipient>()

function normalizeOwnerEmail(value: string) {
  return value.trim().toLowerCase()
}

function createRecipientProfileId(input: {
  ownerEmail: string
  service: ManualBillingService
  countryCode: "CI"
  normalizedAccountReference: string
  normalizedPhone?: string
}) {
  const phonePart = input.normalizedPhone ?? "no-phone"
  return [
    "recipient",
    input.countryCode.toLowerCase(),
    input.service,
    input.ownerEmail.replace(/[^a-z0-9]/g, "-"),
    input.normalizedAccountReference.toLowerCase(),
    phonePart.replace(/[^a-z0-9+]/gi, "-").toLowerCase(),
  ].join("-")
}

function mapRowToSavedRecipient(row: ManualBillingRecipientProfileRow): SavedManualBillingRecipient {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    service: row.service,
    countryCode: row.country_code,
    recipientName: row.recipient_name,
    accountReference: row.account_reference,
    normalizedAccountReference: row.normalized_account_reference,
    phone: row.phone ?? undefined,
    normalizedPhone: row.normalized_phone ?? undefined,
    preferredDeliveryChannel: row.preferred_delivery_channel,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSavedRecipientToRow(profile: SavedManualBillingRecipient): ManualBillingRecipientProfileRow {
  return {
    id: profile.id,
    owner_email: profile.ownerEmail,
    service: profile.service,
    country_code: profile.countryCode,
    recipient_name: profile.recipientName,
    account_reference: profile.accountReference,
    normalized_account_reference: profile.normalizedAccountReference,
    phone: profile.phone ?? null,
    normalized_phone: profile.normalizedPhone ?? null,
    preferred_delivery_channel: profile.preferredDeliveryChannel,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  }
}

function cacheProfiles(profiles: SavedManualBillingRecipient[]) {
  for (const profile of profiles) {
    recipientProfileCache.set(profile.id, profile)
  }
}

export async function listSavedManualBillingRecipients(input: {
  ownerEmail: string
  service?: ManualBillingService
}) {
  const ownerEmail = normalizeOwnerEmail(input.ownerEmail)

  try {
    const supabase = getSupabase()
    let query = supabase
      .from("manual_billing_recipient_profiles")
      .select("*")
      .eq("owner_email", ownerEmail)
      .order("updated_at", { ascending: false })

    if (input.service) {
      query = query.eq("service", input.service)
    }

    const { data, error } = await query
    if (!error && data) {
      const profiles = (data as ManualBillingRecipientProfileRow[]).map(mapRowToSavedRecipient)
      cacheProfiles(profiles)
      return profiles
    }
  } catch {
    // Fall back to the in-memory cache used by local tests and degraded environments.
  }

  return [...recipientProfileCache.values()]
    .filter((profile) => profile.ownerEmail === ownerEmail)
    .filter((profile) => !input.service || profile.service === input.service)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function upsertSavedManualBillingRecipient(input: UpsertSavedManualBillingRecipientInput) {
  const ownerEmail = normalizeOwnerEmail(input.ownerEmail)
  const normalizedAccountReference = normalizeManualBillingAccountReference(input.service, input.accountReference)
  const normalizedPhone = normalizeManualBillingPhone(input.phone)
  const existingProfiles = await listSavedManualBillingRecipients({ ownerEmail, service: input.service })
  const existing = existingProfiles.find((profile) =>
    profile.normalizedAccountReference === normalizedAccountReference
    && (normalizedPhone ? profile.normalizedPhone === normalizedPhone : true)
  )
  const now = new Date().toISOString()

  const profile: SavedManualBillingRecipient = {
    id: existing?.id ?? createRecipientProfileId({
      ownerEmail,
      service: input.service,
      countryCode: input.countryCode,
      normalizedAccountReference,
      normalizedPhone,
    }),
    ownerEmail,
    service: input.service,
    countryCode: input.countryCode,
    recipientName: input.recipientName.trim(),
    accountReference: normalizedAccountReference,
    normalizedAccountReference,
    phone: normalizedPhone,
    normalizedPhone,
    preferredDeliveryChannel: input.preferredDeliveryChannel ?? existing?.preferredDeliveryChannel ?? "sms",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  recipientProfileCache.set(profile.id, profile)

  try {
    const supabase = getSupabase()
    await supabase
      .from("manual_billing_recipient_profiles")
      .upsert(mapSavedRecipientToRow(profile), { onConflict: "id" })
  } catch {
    // In degraded environments we keep the cache as the source of truth for the current runtime.
  }

  return profile
}

export async function findSavedManualBillingRecipientForDelivery(input: ResolveManualBillingDeliveryTargetInput) {
  const ownerEmail = normalizeOwnerEmail(input.ownerEmail)
  const normalizedAccountReference = normalizeManualBillingAccountReference(input.service, input.accountReference)
  const normalizedPhone = normalizeManualBillingPhone(input.phone)
  const profiles = await listSavedManualBillingRecipients({ ownerEmail, service: input.service })

  return profiles.find((profile) =>
    profile.normalizedAccountReference === normalizedAccountReference
    && (!normalizedPhone || profile.normalizedPhone === normalizedPhone)
  )
}

export async function resolveManualBillingDeliveryTarget(input: ResolveManualBillingDeliveryTargetInput) {
  const matchedProfile = await findSavedManualBillingRecipientForDelivery(input)
  const resolvedAt = new Date().toISOString()

  if (matchedProfile?.preferredDeliveryChannel === "in_app") {
    return {
      channel: "in_app" as const,
      reason: "Matched an existing saved recipient profile configured for in-app delivery.",
      recipientProfileId: matchedProfile.id,
      resolvedAt,
      matchedProfile,
    }
  }

  if (matchedProfile?.preferredDeliveryChannel === "whatsapp") {
    return {
      channel: "whatsapp" as const,
      reason: "Matched an existing saved recipient profile configured for WhatsApp-first delivery.",
      recipientProfileId: matchedProfile.id,
      resolvedAt,
      matchedProfile,
    }
  }

  return {
    channel: "sms" as const,
    reason: matchedProfile
      ? "Matched a saved recipient profile, but delivery preference remains SMS."
      : "No saved in-app recipient profile matched; defaulting to SMS delivery.",
    recipientProfileId: matchedProfile?.id,
    resolvedAt,
    matchedProfile,
  }
}