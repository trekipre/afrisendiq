import { dingRequest, type DingEnvelope } from "@/app/providers/ding/shared"

export type DingProvider = {
  ProviderCode: string
  CountryIso: string
  Name: string
  ShortName?: string
  ValidationRegex?: string
  CustomerCareNumber?: string
  RegionCodes?: string[]
  PaymentTypes?: string[]
  LogoUrl?: string
}

type GetDingProvidersInput = {
  providerCodes?: string[]
  countryIsos?: string[]
  regionCodes?: string[]
  accountNumber?: string
  correlationId?: string
}

export async function getDingProviders(input: GetDingProvidersInput = {}) {
  return dingRequest<DingProvider>("GetProviders", {
    query: {
      providerCodes: input.providerCodes,
      countryIsos: input.countryIsos,
      regionCodes: input.regionCodes,
      accountNumber: input.accountNumber
    },
    correlationId: input.correlationId
  }) as Promise<DingEnvelope<DingProvider>>
}