import { dingRequest, type DingEnvelope } from "@/app/providers/ding/shared"

export type DingSettingDefinition = {
  Name: string
  Description: string
  IsMandatory: boolean
}

export type DingPrice = {
  CustomerFee: number
  DistributorFee: number
  ReceiveValue: number
  ReceiveCurrencyIso: string
  ReceiveValueExcludingTax?: number
  TaxRate?: number
  TaxName?: string
  TaxCalculation?: string
  SendValue: number
  SendCurrencyIso: string
}

export type DingProduct = {
  ProviderCode: string
  SkuCode: string
  LocalizationKey: string
  SettingDefinitions: DingSettingDefinition[]
  Maximum: DingPrice
  Minimum: DingPrice
  CommissionRate: number
  ProcessingMode: string
  RedemptionMechanism: string
  Benefits: string[]
  ValidityPeriodIso?: string
  UatNumber?: string
  AdditionalInformation?: string
  DefaultDisplayText?: string
  RegionCode?: string
  PaymentTypes?: string[]
  LookupBillsRequired: boolean
}

type GetDingProductsInput = {
  countryIsos?: string[]
  providerCodes?: string[]
  skuCodes?: string[]
  benefits?: string[]
  regionCodes?: string[]
  accountNumber?: string
  correlationId?: string
}

export async function getDingProducts(input: GetDingProductsInput = {}) {
  return dingRequest<DingProduct>("GetProducts", {
    query: {
      countryIsos: input.countryIsos,
      providerCodes: input.providerCodes,
      skuCodes: input.skuCodes,
      benefits: input.benefits,
      regionCodes: input.regionCodes,
      accountNumber: input.accountNumber
    },
    correlationId: input.correlationId
  }) as Promise<DingEnvelope<DingProduct>>
}