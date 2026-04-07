export type ProviderCatalogOrderStatus =
  | "received"
  | "validated"
  | "executing"
  | "completed"
  | "failed"

export type ProviderCatalogOrderTransition = {
  from: ProviderCatalogOrderStatus | null
  to: ProviderCatalogOrderStatus
  changedAt: string
  note?: string
}

export type ProviderCatalogOrder = {
  id: string
  traceId: string
  provider: string
  productId: string
  productName: string
  customerReference: string
  recipientLabel: string
  amount: number
  status: ProviderCatalogOrderStatus
  failureReason?: string
  completionMode: "live" | "simulated"
  createdAt: string
  updatedAt: string
  transitions: ProviderCatalogOrderTransition[]
}

const orderStore = new Map<string, ProviderCatalogOrder>()

const allowedTransitions: Record<ProviderCatalogOrderStatus, ProviderCatalogOrderStatus[]> = {
  received: ["validated", "failed"],
  validated: ["executing", "failed"],
  executing: ["completed", "failed"],
  completed: [],
  failed: []
}

function persistOrder(order: ProviderCatalogOrder) {
  orderStore.set(order.id, order)
  return order
}

export function resetProviderCatalogOrders() {
  orderStore.clear()
}

export function listProviderCatalogOrders() {
  return [...orderStore.values()]
}

export function createProviderCatalogOrder(input: Omit<ProviderCatalogOrder, "status" | "createdAt" | "updatedAt" | "transitions">) {
  const now = new Date().toISOString()
  return persistOrder({
    ...input,
    status: "received",
    createdAt: now,
    updatedAt: now,
    transitions: [
      {
        from: null,
        to: "received",
        changedAt: now,
        note: "Order created"
      }
    ]
  })
}

export function transitionProviderCatalogOrder(
  order: ProviderCatalogOrder,
  nextStatus: ProviderCatalogOrderStatus,
  patch: Partial<Omit<ProviderCatalogOrder, "id" | "traceId" | "createdAt" | "transitions">> = {},
  note?: string
) {
  if (!allowedTransitions[order.status].includes(nextStatus)) {
    throw new Error(`Invalid provider catalog order transition from ${order.status} to ${nextStatus}`)
  }

  const changedAt = new Date().toISOString()

  return persistOrder({
    ...order,
    ...patch,
    status: nextStatus,
    updatedAt: changedAt,
    transitions: [
      ...order.transitions,
      {
        from: order.status,
        to: nextStatus,
        changedAt,
        note
      }
    ]
  })
}