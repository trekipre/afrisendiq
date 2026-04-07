export type PayoutProvider = "pawapay"

export type PayoutStatus =
  | "created"
  | "queued"
  | "submitted"
  | "pending_partner"
  | "paid"
  | "failed"
  | "reversed"
  | "manual_review"

export type PayoutRequestInput = {
  orderId: string
  amount: number
  currency: string
  beneficiaryReference: string
  beneficiaryName?: string
  corridor?: string
  metadata?: Record<string, string>
}

export type CanonicalPayout = {
  provider: PayoutProvider
  payoutId: string
  status: PayoutStatus
  amount: number
  currency: string
  beneficiaryReference: string
  providerReference?: string
  raw?: unknown
}

export type PayoutWebhookInput = {
  signature?: string
  payload: string
  headers?: Record<string, string>
}

export type CanonicalPayoutWebhook = {
  provider: PayoutProvider
  eventId: string
  eventType: string
  payoutId?: string
  orderId?: string
  raw: unknown
}

export interface PayoutService {
  readonly provider: PayoutProvider
  createPayout(input: PayoutRequestInput): Promise<CanonicalPayout>
  getPayout(payoutId: string): Promise<CanonicalPayout>
  cancelPayout(payoutId: string): Promise<CanonicalPayout>
  verifyWebhook(input: PayoutWebhookInput): Promise<CanonicalPayoutWebhook>
}

export const pawapayPayoutService: PayoutService = {
  provider: "pawapay",

  async createPayout() {
    throw new Error("PawaPay adapter is scaffolded but not implemented yet")
  },

  async getPayout() {
    throw new Error("PawaPay adapter is scaffolded but not implemented yet")
  },

  async cancelPayout() {
    throw new Error("PawaPay adapter is scaffolded but not implemented yet")
  },

  async verifyWebhook() {
    throw new Error("PawaPay adapter is scaffolded but not implemented yet")
  },
}

export function getPayoutService(provider: PayoutProvider): PayoutService {
  switch (provider) {
    case "pawapay":
      return pawapayPayoutService
    default:
      throw new Error(`Unsupported payout provider: ${provider satisfies never}`)
  }
}