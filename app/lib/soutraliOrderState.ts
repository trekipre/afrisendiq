export type SoutraliOrderStatus =
  | "received"
  | "quoted"
  | "provider_selected"
  | "executing"
  | "completed"
  | "failed"

export type SoutraliOrderTransition = {
  from: SoutraliOrderStatus | null
  to: SoutraliOrderStatus
  changedAt: string
  note?: string
}

export type SoutraliOrder = {
  id: string
  traceId: string
  productId: string
  productName: string
  customerReference: string
  recipientLabel: string
  amount: number
  currency: string
  status: SoutraliOrderStatus
  quotedPrice?: number
  selectedProvider?: string
  selectedExecutionMode?: "live" | "simulated"
  failureReason?: string
  createdAt: string
  updatedAt: string
  transitions: SoutraliOrderTransition[]
}

const orderStore = new Map<string, SoutraliOrder>()

const allowedTransitions: Record<SoutraliOrderStatus, SoutraliOrderStatus[]> = {
  received: ["quoted", "failed"],
  quoted: ["provider_selected", "failed"],
  provider_selected: ["executing", "failed"],
  executing: ["completed", "failed"],
  completed: [],
  failed: []
}

function persistOrder(order: SoutraliOrder) {
  orderStore.set(order.id, order)
  return order
}

export function resetSoutraliOrders() {
  orderStore.clear()
}

export function listSoutraliOrders() {
  return [...orderStore.values()]
}

export function createSoutraliOrder(input: Omit<SoutraliOrder, "status" | "createdAt" | "updatedAt" | "transitions">) {
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

export function transitionSoutraliOrder(
  order: SoutraliOrder,
  nextStatus: SoutraliOrderStatus,
  patch: Partial<Omit<SoutraliOrder, "id" | "traceId" | "createdAt" | "transitions">> = {},
  note?: string
) {
  if (!allowedTransitions[order.status].includes(nextStatus)) {
    throw new Error(`Invalid Soutrali order transition from ${order.status} to ${nextStatus}`)
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