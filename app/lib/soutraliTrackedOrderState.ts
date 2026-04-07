export type SoutraliTrackedCustomerStatus =
  | "awaiting_payment"
  | "payment_received"
  | "processing"
  | "completed"
  | "code_ready"
  | "refunded"
  | "failed"

export type SoutraliTrackedOrderStatus =
  | "created"
  | "payment_pending"
  | "payment_received"
  | "provider_processing"
  | "completed"
  | "code_ready"
  | "refunded"
  | "failed"

export type SoutraliTrackedOrder = {
  id: string
  traceId: string
  productId: string
  productName: string
  category: "airtime" | "data" | "electricity" | "gift-card"
  brand: "MTN" | "MOOV" | "ORANGE" | "CIE" | "JUMIA"
  amount: number
  quotedPrice: number
  currency: "XOF"
  customerReference: string
  recipientLabel: string
  senderName?: string
  beneficiaryPhoneNumber?: string
  recipientEmail?: string
  paymentSessionId?: string
  paymentStatus?: "pending" | "paid" | "refunded"
  selectedProvider: "reloadly" | "ding" | "dtone"
  selectedExecutionMode: "live" | "simulated"
  providerExternalId?: string
  providerStatus?: string
  rechargeCode?: string
  failureReason?: string
  returnPath: string
  createdAt: string
  updatedAt: string
  status: SoutraliTrackedOrderStatus
}

export function createSoutraliTrackedOrder(
  input: Omit<SoutraliTrackedOrder, "createdAt" | "updatedAt" | "status">
): SoutraliTrackedOrder {
  const now = new Date().toISOString()

  return {
    ...input,
    status: "created",
    createdAt: now,
    updatedAt: now,
  }
}

export function updateSoutraliTrackedOrder(
  order: SoutraliTrackedOrder,
  patch: Partial<Omit<SoutraliTrackedOrder, "id" | "traceId" | "createdAt">>
): SoutraliTrackedOrder {
  return {
    ...order,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
}