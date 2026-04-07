export type SoutraliTrackedCustomerStatus =
  | "awaiting_payment"
  | "payment_received"
  | "processing"
  | "completed"
  | "code_ready"
  | "refunded"
  | "failed"

export type SoutraliTrackedCheckoutResponse = {
  success: boolean
  error?: string
  orderId?: string
  checkoutUrl?: string
  quotedPrice?: number
}

export type SoutraliTrackedOrderCustomerView = {
  id: string
  productId: string
  productName: string
  category: "airtime" | "data" | "electricity" | "gift-card"
  brand?: string
  amount: number
  quotedPrice: number
  currency: string
  customerReference: string
  recipientLabel: string
  beneficiaryPhoneNumber: string | null
  recipientEmail: string | null
  createdAt: string
  updatedAt: string
  customerStatus: SoutraliTrackedCustomerStatus
  reference: string | null
  rechargeCode: string | null
  showReference: boolean
}

export type SoutraliTrackedOrderLookupResponse = {
  success: boolean
  error?: string
  order?: SoutraliTrackedOrderCustomerView
}

export const SOUTRALI_TRACKED_POLLING_BASE_DELAY_MS = 15000
export const SOUTRALI_TRACKED_POLLING_MAX_DELAY_MS = 180000

export function isSoutraliTrackedSuccessStatus(status: SoutraliTrackedCustomerStatus) {
  return status === "completed" || status === "code_ready"
}

export function isSoutraliTrackedTerminalStatus(status: SoutraliTrackedCustomerStatus) {
  return isSoutraliTrackedSuccessStatus(status) || status === "refunded" || status === "failed"
}