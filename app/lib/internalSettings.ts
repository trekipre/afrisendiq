import {
  DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES,
  DEFAULT_STUCK_PAID_THRESHOLD_MINUTES,
  normalizeThresholdMinutes,
} from "@/app/lib/internalAlerts"
import { getSupabase } from "@/app/lib/supabase"

const MANUAL_BILLING_ALERT_SETTINGS_KEY = "manual_billing_alerts"

export const DEFAULT_WHATSAPP_FALLBACK_DELAY_MINUTES = 15
export const DEFAULT_TWILIO_SMS_FALLBACK_ENABLED = false
export const DEFAULT_ORANGE_FALLBACK_ENABLED = true
export const DEFAULT_MTN_FALLBACK_ENABLED = true
export const DEFAULT_AFRICAS_TALKING_FALLBACK_ENABLED = false
export const DEFAULT_TPE_CLOUD_FALLBACK_ENABLED = false
export const MANUAL_BILLING_SMS_PROVIDERS = ["mtn", "orange", "africasTalking", "twilio", "tpeCloud"] as const
export const MANUAL_BILLING_SMS_ROUTE_MESSAGE_TYPES = ["confirmation", "token", "receipt", "retry"] as const
export const MANUAL_BILLING_SMS_ROUTE_CARRIERS = ["mtn-ci", "orange-ci", "moov-ci", "unknown-ci"] as const

export type ManualBillingSmsProvider = (typeof MANUAL_BILLING_SMS_PROVIDERS)[number]
export type ManualBillingSmsRouteMessageType = (typeof MANUAL_BILLING_SMS_ROUTE_MESSAGE_TYPES)[number]
export type ManualBillingSmsRouteCarrier = (typeof MANUAL_BILLING_SMS_ROUTE_CARRIERS)[number]
export type ManualBillingSmsRoutingPolicy = Record<ManualBillingSmsRouteMessageType, Record<ManualBillingSmsRouteCarrier, ManualBillingSmsProvider[]>>

const DEFAULT_MANUAL_BILLING_SMS_ROUTING_POLICY: ManualBillingSmsRoutingPolicy = {
  confirmation: {
    "mtn-ci": ["mtn", "africasTalking", "orange", "twilio"],
    "orange-ci": ["orange", "africasTalking", "mtn", "twilio"],
    "moov-ci": ["twilio", "africasTalking", "orange", "mtn"],
    "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
  },
  token: {
    "mtn-ci": ["mtn", "africasTalking", "orange", "twilio"],
    "orange-ci": ["orange", "africasTalking", "mtn", "twilio"],
    "moov-ci": ["twilio", "africasTalking", "orange", "mtn"],
    "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
  },
  receipt: {
    "mtn-ci": ["mtn", "africasTalking", "orange", "twilio"],
    "orange-ci": ["orange", "africasTalking", "mtn", "twilio"],
    "moov-ci": ["twilio", "africasTalking", "orange", "mtn"],
    "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
  },
  retry: {
    "mtn-ci": ["africasTalking", "twilio", "mtn", "orange"],
    "orange-ci": ["africasTalking", "twilio", "orange", "mtn"],
    "moov-ci": ["twilio", "africasTalking", "orange", "mtn"],
    "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
  },
}

type InternalSettingsRow = {
  key: string
  value: Record<string, unknown> | null
  updated_at: string
}

type ManualBillingAlertSettingsRecord = {
  quoteRequestedThresholdMinutes: number
  stuckPaidThresholdMinutes: number
  whatsappFallbackDelayMinutes: number
  twilioSmsFallbackEnabled: boolean
  orangeFallbackEnabled: boolean
  mtnFallbackEnabled: boolean
  africasTalkingFallbackEnabled: boolean
  tpeCloudFallbackEnabled: boolean
  routingPolicy: ManualBillingSmsRoutingPolicy
  updatedAt: string
}

export type ManualBillingAlertSettings = ManualBillingAlertSettingsRecord & {
  source: "supabase" | "fallback"
}

const fallbackSettings = new Map<string, ManualBillingAlertSettingsRecord>([
  [
    MANUAL_BILLING_ALERT_SETTINGS_KEY,
    {
      quoteRequestedThresholdMinutes: DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES,
      stuckPaidThresholdMinutes: DEFAULT_STUCK_PAID_THRESHOLD_MINUTES,
      whatsappFallbackDelayMinutes: DEFAULT_WHATSAPP_FALLBACK_DELAY_MINUTES,
      twilioSmsFallbackEnabled: DEFAULT_TWILIO_SMS_FALLBACK_ENABLED,
      orangeFallbackEnabled: DEFAULT_ORANGE_FALLBACK_ENABLED,
      mtnFallbackEnabled: DEFAULT_MTN_FALLBACK_ENABLED,
      africasTalkingFallbackEnabled: DEFAULT_AFRICAS_TALKING_FALLBACK_ENABLED,
      tpeCloudFallbackEnabled: DEFAULT_TPE_CLOUD_FALLBACK_ENABLED,
      routingPolicy: getDefaultManualBillingSmsRoutingPolicy(),
      updatedAt: new Date(0).toISOString()
    }
  ]
])

function cloneManualBillingSmsRoutingPolicy(policy: ManualBillingSmsRoutingPolicy): ManualBillingSmsRoutingPolicy {
  return MANUAL_BILLING_SMS_ROUTE_MESSAGE_TYPES.reduce<ManualBillingSmsRoutingPolicy>((messageTypeAccumulator, messageType) => {
    messageTypeAccumulator[messageType] = MANUAL_BILLING_SMS_ROUTE_CARRIERS.reduce<ManualBillingSmsRoutingPolicy[ManualBillingSmsRouteMessageType]>((carrierAccumulator, carrier) => {
      carrierAccumulator[carrier] = [...policy[messageType][carrier]]
      return carrierAccumulator
    }, {} as ManualBillingSmsRoutingPolicy[ManualBillingSmsRouteMessageType])

    return messageTypeAccumulator
  }, {} as ManualBillingSmsRoutingPolicy)
}

export function getDefaultManualBillingSmsRoutingPolicy(): ManualBillingSmsRoutingPolicy {
  return cloneManualBillingSmsRoutingPolicy(DEFAULT_MANUAL_BILLING_SMS_ROUTING_POLICY)
}

function isManualBillingSmsProvider(value: unknown): value is ManualBillingSmsProvider {
  return typeof value === "string" && MANUAL_BILLING_SMS_PROVIDERS.includes(value as ManualBillingSmsProvider)
}

function parseManualBillingSmsRoute(rawValue: unknown): ManualBillingSmsProvider[] | null {
  const rawEntries = Array.isArray(rawValue)
    ? rawValue
    : typeof rawValue === "string"
      ? rawValue.split(",")
      : null

  if (!rawEntries) {
    return null
  }

  const normalized = rawEntries.reduce<ManualBillingSmsProvider[]>((providers, entry) => {
    const candidate = typeof entry === "string" ? entry.trim() : entry

    if (isManualBillingSmsProvider(candidate) && !providers.includes(candidate)) {
      providers.push(candidate)
    }

    return providers
  }, [])

  return normalized.length > 0 ? normalized : null
}

export function parseManualBillingSmsRoutingPolicy(rawValue: unknown): ManualBillingSmsRoutingPolicy | null {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null
  }

  const record = rawValue as Record<string, unknown>
  const nextPolicy = getDefaultManualBillingSmsRoutingPolicy()

  for (const messageType of MANUAL_BILLING_SMS_ROUTE_MESSAGE_TYPES) {
    const rawCarrierConfig = record[messageType]

    if (rawCarrierConfig === undefined) {
      continue
    }

    if (!rawCarrierConfig || typeof rawCarrierConfig !== "object" || Array.isArray(rawCarrierConfig)) {
      return null
    }

    const carrierConfig = rawCarrierConfig as Record<string, unknown>

    for (const carrier of MANUAL_BILLING_SMS_ROUTE_CARRIERS) {
      const rawRoute = carrierConfig[carrier]

      if (rawRoute === undefined) {
        continue
      }

      const parsedRoute = parseManualBillingSmsRoute(rawRoute)

      if (!parsedRoute) {
        return null
      }

      nextPolicy[messageType][carrier] = parsedRoute
    }
  }

  return nextPolicy
}

export function normalizeManualBillingSmsRoutingPolicy(rawValue: unknown): ManualBillingSmsRoutingPolicy {
  return parseManualBillingSmsRoutingPolicy(rawValue) ?? getDefaultManualBillingSmsRoutingPolicy()
}

function normalizeThresholdInput(value: unknown) {
  return typeof value === "string" || typeof value === "number" || value == null
    ? value
    : undefined
}

function readFallbackSettings() {
  return fallbackSettings.get(MANUAL_BILLING_ALERT_SETTINGS_KEY) ?? {
    quoteRequestedThresholdMinutes: DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES,
    stuckPaidThresholdMinutes: DEFAULT_STUCK_PAID_THRESHOLD_MINUTES,
    whatsappFallbackDelayMinutes: DEFAULT_WHATSAPP_FALLBACK_DELAY_MINUTES,
    twilioSmsFallbackEnabled: DEFAULT_TWILIO_SMS_FALLBACK_ENABLED,
    orangeFallbackEnabled: DEFAULT_ORANGE_FALLBACK_ENABLED,
    mtnFallbackEnabled: DEFAULT_MTN_FALLBACK_ENABLED,
    africasTalkingFallbackEnabled: DEFAULT_AFRICAS_TALKING_FALLBACK_ENABLED,
    tpeCloudFallbackEnabled: DEFAULT_TPE_CLOUD_FALLBACK_ENABLED,
    routingPolicy: getDefaultManualBillingSmsRoutingPolicy(),
    updatedAt: new Date(0).toISOString()
  }
}

function mapSettingsRow(row: InternalSettingsRow | null | undefined): ManualBillingAlertSettingsRecord {
  const quoteThresholdValue = row?.value?.quoteRequestedThresholdMinutes
  const thresholdValue = row?.value?.stuckPaidThresholdMinutes
  const fallbackDelayValue = row?.value?.whatsappFallbackDelayMinutes
  const twilioSmsFallbackEnabledValue = row?.value?.twilioSmsFallbackEnabled
  const orangeFallbackEnabledValue = row?.value?.orangeFallbackEnabled
  const mtnFallbackEnabledValue = row?.value?.mtnFallbackEnabled
  const africasTalkingFallbackEnabledValue = row?.value?.africasTalkingFallbackEnabled
  const tpeCloudFallbackEnabledValue = row?.value?.tpeCloudFallbackEnabled
  const routingPolicyValue = row?.value?.routingPolicy

  return {
    quoteRequestedThresholdMinutes: normalizeThresholdMinutes(normalizeThresholdInput(quoteThresholdValue), DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES),
    stuckPaidThresholdMinutes: normalizeThresholdMinutes(normalizeThresholdInput(thresholdValue), DEFAULT_STUCK_PAID_THRESHOLD_MINUTES),
    whatsappFallbackDelayMinutes: normalizeThresholdMinutes(normalizeThresholdInput(fallbackDelayValue), DEFAULT_WHATSAPP_FALLBACK_DELAY_MINUTES),
    twilioSmsFallbackEnabled: typeof twilioSmsFallbackEnabledValue === "boolean" ? twilioSmsFallbackEnabledValue : DEFAULT_TWILIO_SMS_FALLBACK_ENABLED,
    orangeFallbackEnabled: typeof orangeFallbackEnabledValue === "boolean" ? orangeFallbackEnabledValue : DEFAULT_ORANGE_FALLBACK_ENABLED,
    mtnFallbackEnabled: typeof mtnFallbackEnabledValue === "boolean" ? mtnFallbackEnabledValue : DEFAULT_MTN_FALLBACK_ENABLED,
    africasTalkingFallbackEnabled: typeof africasTalkingFallbackEnabledValue === "boolean" ? africasTalkingFallbackEnabledValue : DEFAULT_AFRICAS_TALKING_FALLBACK_ENABLED,
    tpeCloudFallbackEnabled: typeof tpeCloudFallbackEnabledValue === "boolean" ? tpeCloudFallbackEnabledValue : DEFAULT_TPE_CLOUD_FALLBACK_ENABLED,
    routingPolicy: normalizeManualBillingSmsRoutingPolicy(routingPolicyValue),
    updatedAt: row?.updated_at || new Date().toISOString()
  }
}

function cacheFallbackSettings(settings: ManualBillingAlertSettingsRecord) {
  fallbackSettings.set(MANUAL_BILLING_ALERT_SETTINGS_KEY, settings)
  return settings
}

export async function getManualBillingAlertSettings(): Promise<ManualBillingAlertSettings> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("internal_settings")
      .select("key, value, updated_at")
      .eq("key", MANUAL_BILLING_ALERT_SETTINGS_KEY)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (data) {
      const settings = mapSettingsRow(data as InternalSettingsRow)
      cacheFallbackSettings(settings)
      return {
        ...settings,
        source: "supabase"
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[internal-settings] Falling back to in-memory manual billing alert settings:", message)
  }

  return {
    ...readFallbackSettings(),
    source: "fallback"
  }
}

export async function updateManualBillingAlertSettings(input: {
  quoteRequestedThresholdMinutes?: number
  stuckPaidThresholdMinutes?: number
  whatsappFallbackDelayMinutes?: number
  twilioSmsFallbackEnabled?: boolean
  orangeFallbackEnabled?: boolean
  mtnFallbackEnabled?: boolean
  africasTalkingFallbackEnabled?: boolean
  tpeCloudFallbackEnabled?: boolean
  routingPolicy?: ManualBillingSmsRoutingPolicy
}): Promise<ManualBillingAlertSettings> {
  const previousSettings = readFallbackSettings()
  const nextSettings = cacheFallbackSettings({
    quoteRequestedThresholdMinutes: normalizeThresholdMinutes(input.quoteRequestedThresholdMinutes, previousSettings.quoteRequestedThresholdMinutes),
    stuckPaidThresholdMinutes: normalizeThresholdMinutes(input.stuckPaidThresholdMinutes, previousSettings.stuckPaidThresholdMinutes),
    whatsappFallbackDelayMinutes: normalizeThresholdMinutes(input.whatsappFallbackDelayMinutes, previousSettings.whatsappFallbackDelayMinutes),
    twilioSmsFallbackEnabled: typeof input.twilioSmsFallbackEnabled === "boolean" ? input.twilioSmsFallbackEnabled : previousSettings.twilioSmsFallbackEnabled,
    orangeFallbackEnabled: typeof input.orangeFallbackEnabled === "boolean" ? input.orangeFallbackEnabled : previousSettings.orangeFallbackEnabled,
    mtnFallbackEnabled: typeof input.mtnFallbackEnabled === "boolean" ? input.mtnFallbackEnabled : previousSettings.mtnFallbackEnabled,
    africasTalkingFallbackEnabled: typeof input.africasTalkingFallbackEnabled === "boolean" ? input.africasTalkingFallbackEnabled : previousSettings.africasTalkingFallbackEnabled,
    tpeCloudFallbackEnabled: typeof input.tpeCloudFallbackEnabled === "boolean" ? input.tpeCloudFallbackEnabled : previousSettings.tpeCloudFallbackEnabled,
    routingPolicy: input.routingPolicy ? cloneManualBillingSmsRoutingPolicy(input.routingPolicy) : cloneManualBillingSmsRoutingPolicy(previousSettings.routingPolicy),
    updatedAt: new Date().toISOString()
  })

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("internal_settings")
      .upsert(
        {
          key: MANUAL_BILLING_ALERT_SETTINGS_KEY,
          value: {
            quoteRequestedThresholdMinutes: nextSettings.quoteRequestedThresholdMinutes,
            stuckPaidThresholdMinutes: nextSettings.stuckPaidThresholdMinutes,
            whatsappFallbackDelayMinutes: nextSettings.whatsappFallbackDelayMinutes,
            twilioSmsFallbackEnabled: nextSettings.twilioSmsFallbackEnabled,
            orangeFallbackEnabled: nextSettings.orangeFallbackEnabled,
            mtnFallbackEnabled: nextSettings.mtnFallbackEnabled,
            africasTalkingFallbackEnabled: nextSettings.africasTalkingFallbackEnabled,
            tpeCloudFallbackEnabled: nextSettings.tpeCloudFallbackEnabled,
            routingPolicy: nextSettings.routingPolicy
          },
          updated_at: nextSettings.updatedAt
        },
        { onConflict: "key" }
      )
      .select("key, value, updated_at")
      .single()

    if (error) {
      throw error
    }

    const persistedSettings = mapSettingsRow(data as InternalSettingsRow)
    cacheFallbackSettings(persistedSettings)
    return {
      ...persistedSettings,
      source: "supabase"
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[internal-settings] Persist failed, using in-memory manual billing alert settings:", message)

    return {
      ...nextSettings,
      source: "fallback"
    }
  }
}