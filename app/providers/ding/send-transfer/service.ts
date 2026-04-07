import { dingRequest, type DingEnvelope } from "@/app/providers/ding/shared"
import type { DingSetting } from "@/app/providers/ding/lookup-bills/service"

export type DingTransferRecord = {
  TransferId?: {
    TransferRef?: string
    DistributorRef?: string
  }
  SkuCode?: string
  Price?: {
    CustomerFee: number
    DistributorFee: number
    ReceiveValue: number
    ReceiveCurrencyIso: string
    SendValue: number
    SendCurrencyIso: string
  }
  CommissionApplied?: number
  StartedUtc?: string
  CompletedUtc?: string
  ProcessingState?: string
  ReceiptText?: string
  ReceiptParams?: Record<string, string>
  AccountNumber?: string
}

type SendDingTransferInput = {
  skuCode: string
  sendValue: number
  sendCurrencyIso?: string
  accountNumber: string
  distributorRef: string
  settings?: DingSetting[]
  validateOnly?: boolean
  billRef?: string
  correlationId?: string
}

export async function sendDingTransfer(input: SendDingTransferInput) {
  return dingRequest<DingTransferRecord>("SendTransfer", {
    method: "POST",
    body: {
      SkuCode: input.skuCode,
      SendValue: input.sendValue,
      SendCurrencyIso: input.sendCurrencyIso || undefined,
      AccountNumber: input.accountNumber,
      DistributorRef: input.distributorRef,
      Settings: input.settings || [],
      ValidateOnly: input.validateOnly ?? false,
      BillRef: input.billRef || undefined
    },
    correlationId: input.correlationId
  }) as Promise<DingEnvelope<DingTransferRecord>>
}