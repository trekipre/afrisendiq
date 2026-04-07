import { dingRequest, type DingEnvelope } from "@/app/providers/ding/shared"

export type DingSetting = {
  Name: string
  Value: string
}

export type DingBillLookupItem = {
  Price: {
    CustomerFee: number
    DistributorFee: number
    ReceiveValue: number
    ReceiveCurrencyIso: string
    SendValue: number
    SendCurrencyIso: string
  }
  BillRef: string
  AdditionalInfo?: Record<string, string>
}

type LookupDingBillsInput = {
  skuCode: string
  accountNumber: string
  settings?: DingSetting[]
  correlationId?: string
}

export async function lookupDingBills(input: LookupDingBillsInput) {
  return dingRequest<DingBillLookupItem>("LookupBills", {
    method: "POST",
    body: {
      SkuCode: input.skuCode,
      AccountNumber: input.accountNumber,
      Settings: input.settings || []
    },
    correlationId: input.correlationId
  }) as Promise<DingEnvelope<DingBillLookupItem>>
}