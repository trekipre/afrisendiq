import { getSupabase } from "@/app/lib/supabase"
import { transferProvidersSeed } from "@/app/lib/transferProvidersSeed"

export type TransferProvider = {
  id: string
  name: string
  logo_url: string
  tagline: string
  best_for: string
  availability_summary: string
  corridor_focus: string
  payout_networks: string[]
  strengths: string[]
  exchange_rate_score: number
  exchange_rate: number
  fee_score: number
  speed_score: number
  ease_score: number
  efficiency_score: number
  mobile_wallet_speed: number
  bank_deposit_speed: number
  referral_link: string
  sort_order: number
  active: boolean
  created_at?: string
  updated_at?: string
}

export type TransferProviderStore = {
  providers: TransferProvider[]
  source: "supabase" | "fallback"
  warning?: string
}

const fallbackProviderCache = new Map<string, TransferProvider>(
  transferProvidersSeed.map((provider) => [provider.id, mapTransferProvider({ ...provider })])
)

function mapTextArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function mapTransferProvider(row: Record<string, unknown>): TransferProvider {
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    logo_url: String(row.logo_url || ""),
    tagline: String(row.tagline || ""),
    best_for: String(row.best_for || ""),
    availability_summary: String(row.availability_summary || ""),
    corridor_focus: String(row.corridor_focus || ""),
    payout_networks: mapTextArray(row.payout_networks),
    strengths: mapTextArray(row.strengths),
    exchange_rate_score: Number(row.exchange_rate_score || 0),
    exchange_rate: Number(row.exchange_rate || 0),
    fee_score: Number(row.fee_score || 0),
    speed_score: Number(row.speed_score || 0),
    ease_score: Number(row.ease_score || 0),
    efficiency_score: Number(row.efficiency_score || 0),
    mobile_wallet_speed: Number(row.mobile_wallet_speed || 0),
    bank_deposit_speed: Number(row.bank_deposit_speed || 0),
    referral_link: String(row.referral_link || ""),
    sort_order: Number(row.sort_order || 100),
    active: Boolean(row.active ?? true),
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined
  }
}

function sortProviders(providers: TransferProvider[]) {
  return [...providers].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order
    }

    return left.name.localeCompare(right.name)
  })
}

function readFallbackProviders() {
  return sortProviders(Array.from(fallbackProviderCache.values()))
}

function cacheFallbackProvider(provider: TransferProvider) {
  fallbackProviderCache.set(provider.id, provider)
  return provider
}

export async function getTransferProviders(options?: { includeInactive?: boolean }): Promise<TransferProviderStore> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("transfer_providers")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })

    if (error) {
      throw error
    }

    if (data && data.length > 0) {
      const providers = data.map((row) => mapTransferProvider(row as Record<string, unknown>))
      providers.forEach((provider) => {
        cacheFallbackProvider(provider)
      })

      const visibleProviders = options?.includeInactive ? providers : providers.filter((provider) => provider.active)

      return {
        providers: sortProviders(visibleProviders),
        source: "supabase"
      }
    }

    return {
      providers: options?.includeInactive ? readFallbackProviders() : readFallbackProviders().filter((provider) => provider.active),
      source: "fallback",
      warning: "Provider rankings are using fallback data because the live provider table is empty."
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[transfer-providers] Falling back to seeded provider data:", message)

    return {
      providers: options?.includeInactive ? readFallbackProviders() : readFallbackProviders().filter((provider) => provider.active),
      source: "fallback",
      warning: "Provider rankings are using fallback data because the live provider request failed."
    }
  }
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

function normalizeNumber(value: unknown, fallback = 0) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

function normalizeBoolean(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback
}

function normalizeArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim())
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/) 
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return []
}

export type TransferProviderInput = {
  id: string
  name: string
  logo_url?: string
  tagline?: string
  best_for?: string
  availability_summary?: string
  corridor_focus?: string
  payout_networks?: string[] | string
  strengths?: string[] | string
  exchange_rate_score?: number
  exchange_rate?: number
  fee_score?: number
  speed_score?: number
  ease_score?: number
  efficiency_score?: number
  mobile_wallet_speed?: number
  bank_deposit_speed?: number
  referral_link?: string
  sort_order?: number
  active?: boolean
}

function normalizeProviderInput(input: TransferProviderInput): TransferProvider {
  return mapTransferProvider({
    id: normalizeString(input.id),
    name: normalizeString(input.name),
    logo_url: normalizeString(input.logo_url),
    tagline: normalizeString(input.tagline),
    best_for: normalizeString(input.best_for),
    availability_summary: normalizeString(input.availability_summary),
    corridor_focus: normalizeString(input.corridor_focus),
    payout_networks: normalizeArray(input.payout_networks),
    strengths: normalizeArray(input.strengths),
    exchange_rate_score: normalizeNumber(input.exchange_rate_score),
    exchange_rate: normalizeNumber(input.exchange_rate),
    fee_score: normalizeNumber(input.fee_score),
    speed_score: normalizeNumber(input.speed_score),
    ease_score: normalizeNumber(input.ease_score),
    efficiency_score: normalizeNumber(input.efficiency_score),
    mobile_wallet_speed: normalizeNumber(input.mobile_wallet_speed),
    bank_deposit_speed: normalizeNumber(input.bank_deposit_speed),
    referral_link: normalizeString(input.referral_link),
    sort_order: Math.floor(normalizeNumber(input.sort_order, 100)),
    active: normalizeBoolean(input.active, true),
    updated_at: new Date().toISOString()
  })
}

export async function updateTransferProvider(input: TransferProviderInput) {
  const provider = normalizeProviderInput(input)

  if (!provider.id || !provider.name) {
    throw new Error("Provider id and name are required")
  }

  cacheFallbackProvider(provider)

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("transfer_providers")
      .upsert(provider, { onConflict: "id" })
      .select("*")
      .single()

    if (error) {
      throw error
    }

    const persistedProvider = mapTransferProvider(data as Record<string, unknown>)
    cacheFallbackProvider(persistedProvider)

    return {
      provider: persistedProvider,
      source: "supabase" as const
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[transfer-providers] Persist failed, using fallback provider data:", message)

    return {
      provider,
      source: "fallback" as const,
      warning: "Provider rankings were saved to fallback memory because Supabase is not configured."
    }
  }
}