import {
  getDefaultProfitEngineConfig,
  type LocationMarginProfile,
  type ProfitEngineConfig
} from "@/app/lib/profitEngine"
import {
  listProfitabilityReportingRows,
  type ProfitabilityReportingRow
} from "@/app/lib/supabaseOrders"

const LEARNED_PROFILE_CACHE_TTL_MS = 10 * 60 * 1000

let cachedLocationProfiles: { expiresAt: number; profiles: Record<string, LocationMarginProfile> } | null = null

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeCountryCode(countryCode?: string) {
  const normalized = countryCode?.trim().toUpperCase()
  return normalized && normalized.length >= 2 ? normalized.slice(0, 2) : undefined
}

function resolveBaseProfile(countryCode: string, profiles: Record<string, LocationMarginProfile>) {
  const matched = Object.values(profiles).find((profile) => profile.countryCodes.includes(countryCode))

  return matched ?? profiles.rest_of_world ?? {
    cluster: "rest_of_world",
    countryCodes: [],
    marginAdjustmentPercent: 0,
    maxMarginAdjustmentPercent: 0,
    demandMultiplierBoost: 1,
    competitorPressureMultiplier: 1,
    source: "static"
  }
}

function extractCountryCode(row: ProfitabilityReportingRow) {
  return normalizeCountryCode(row.userCountryCode ?? row.pricingDecision?.aiOptimization?.userCountryCode)
}

function cloneLocationProfiles(profiles: Record<string, LocationMarginProfile>) {
  return Object.fromEntries(
    Object.entries(profiles).map(([key, profile]) => [
      key,
      {
        ...profile,
        countryCodes: [...profile.countryCodes],
        source: profile.source ?? "static"
      }
    ])
  )
}

export function buildLearnedLocationProfiles(
  rows: ProfitabilityReportingRow[],
  baseProfiles: Record<string, LocationMarginProfile> = getDefaultProfitEngineConfig().locationProfiles
) {
  const seededBaseProfiles = cloneLocationProfiles(baseProfiles)
  const eligibleRows = rows.filter((row) => row.realized && typeof row.netMarginPercent === "number")

  if (eligibleRows.length === 0) {
    return seededBaseProfiles
  }

  const globalAverageMarginPercent =
    eligibleRows.reduce((total, row) => total + (row.netMarginPercent ?? 0), 0) / eligibleRows.length

  const aggregates = new Map<string, { count: number; marginPercentTotal: number }>()

  for (const row of eligibleRows) {
    const countryCode = extractCountryCode(row)
    if (!countryCode || typeof row.netMarginPercent !== "number") {
      continue
    }

    const aggregate = aggregates.get(countryCode) ?? { count: 0, marginPercentTotal: 0 }
    aggregate.count += 1
    aggregate.marginPercentTotal += row.netMarginPercent
    aggregates.set(countryCode, aggregate)
  }

  const learnedProfiles = [...aggregates.entries()]
    .filter(([, aggregate]) => aggregate.count >= 3)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([countryCode, aggregate]) => {
      const baseProfile = resolveBaseProfile(countryCode, seededBaseProfiles)
      const averageMarginPercent = aggregate.marginPercentTotal / aggregate.count
      const delta = averageMarginPercent - globalAverageMarginPercent
      const confidence = clamp(aggregate.count / 12, 0.3, 1)
      const marginAdjustmentPercent = roundToTwo(
        clamp(baseProfile.marginAdjustmentPercent + delta * 0.18 * confidence, -1, 1.6)
      )
      const maxMarginAdjustmentPercent = roundToTwo(
        clamp(baseProfile.maxMarginAdjustmentPercent + delta * 0.24 * confidence, -0.6, 1.9)
      )
      const demandMultiplierBoost = roundToTwo(
        clamp(baseProfile.demandMultiplierBoost + delta * 0.004 * confidence, 0.985, 1.03)
      )
      const competitorPressureMultiplier = roundToTwo(
        clamp(baseProfile.competitorPressureMultiplier - delta * 0.015 * confidence, 0.9, 1.08)
      )

      return [
        `learned_${countryCode.toLowerCase()}`,
        {
          cluster: `${baseProfile.cluster}_learned`,
          countryCodes: [countryCode],
          marginAdjustmentPercent,
          maxMarginAdjustmentPercent,
          demandMultiplierBoost,
          competitorPressureMultiplier,
          source: "learned" as const,
          sampleSize: aggregate.count
        }
      ]
    })

  return Object.fromEntries([...learnedProfiles, ...Object.entries(seededBaseProfiles)])
}

export async function getLearnedProfitEngineConfigOverride(
  baseConfig?: Partial<ProfitEngineConfig>
): Promise<Partial<ProfitEngineConfig> | undefined> {
  const now = Date.now()

  if (cachedLocationProfiles && cachedLocationProfiles.expiresAt > now) {
    return { ...baseConfig, locationProfiles: cloneLocationProfiles(cachedLocationProfiles.profiles) }
  }

  try {
    const rows = await listProfitabilityReportingRows(1000)
    const locationProfiles = buildLearnedLocationProfiles(
      rows,
      baseConfig?.locationProfiles ?? getDefaultProfitEngineConfig().locationProfiles
    )

    cachedLocationProfiles = {
      expiresAt: now + LEARNED_PROFILE_CACHE_TTL_MS,
      profiles: locationProfiles
    }

    return { ...baseConfig, locationProfiles: cloneLocationProfiles(locationProfiles) }
  } catch {
    return baseConfig
  }
}

export function resetLearnedLocationProfileCache() {
  cachedLocationProfiles = null
}