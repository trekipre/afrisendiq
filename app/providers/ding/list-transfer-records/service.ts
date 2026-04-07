import { dingRequest, type DingEnvelope } from "@/app/providers/ding/shared"
import type { DingTransferRecord } from "@/app/providers/ding/send-transfer/service"

type ListDingTransferRecordsInput = {
  transferRef?: string
  distributorRef?: string
  accountNumber?: string
  skip?: number
  take: number
  correlationId?: string
}

export type DingTransferRecordItem = {
  TransferRecord: DingTransferRecord
  ResultCode: number
  ErrorCodes: Array<{ Code: string; Context?: string }>
}

export async function listDingTransferRecords(input: ListDingTransferRecordsInput) {
  return dingRequest<DingTransferRecordItem>("ListTransferRecords", {
    method: "POST",
    body: {
      TransferRef: input.transferRef || undefined,
      DistributorRef: input.distributorRef || undefined,
      AccountNumber: input.accountNumber || undefined,
      Skip: input.skip || 0,
      Take: input.take
    },
    correlationId: input.correlationId
  }) as Promise<DingEnvelope<DingTransferRecordItem>>
}