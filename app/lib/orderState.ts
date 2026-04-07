export type AirtimeOrderStatus =
  | "received"
  | "operator_resolved"
  | "risk_checked"
  | "executing"
  | "submitted"
  | "failed"

export type AirtimeOrderTransition = {
  from: AirtimeOrderStatus | null
  to: AirtimeOrderStatus
  changedAt: string
  note?: string
}

export type AirtimeOrder = {
  id: string
  traceId: string
  phone: string
  amount: number
  countryCode: string
  status: AirtimeOrderStatus
  operatorId?: number
  operatorName?: string
  provider?: string
  reference?: string
  quotedPrice?: number
  riskScore?: number
  failureReason?: string
  createdAt: string
  updatedAt: string
  transitions: AirtimeOrderTransition[]
}

const orderStore = new Map<string, AirtimeOrder>()

const allowedTransitions: Record<AirtimeOrderStatus, AirtimeOrderStatus[]> = {
  received: ["operator_resolved", "failed"],
  operator_resolved: ["risk_checked", "failed"],
  risk_checked: ["executing", "failed"],
  executing: ["submitted", "failed"],
  submitted: [],
  failed: []
}

function persistOrder(order: AirtimeOrder) {
  orderStore.set(order.id, order)
  return order
}

export function resetAirtimeOrders() {
  orderStore.clear()
}

export function getAirtimeOrder(orderId: string) {
  return orderStore.get(orderId)
}

export function listAirtimeOrders() {
  return [...orderStore.values()]
}

export function createAirtimeOrder(input: {
  id: string
  traceId: string
  phone: string
  amount: number
  countryCode: string
}) {
  const now = new Date().toISOString()
  const order: AirtimeOrder = {
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
  }

  return persistOrder(order)
}

export function transitionAirtimeOrder(
  order: AirtimeOrder,
  nextStatus: AirtimeOrderStatus,
  patch: Partial<Omit<AirtimeOrder, "id" | "traceId" | "createdAt" | "transitions">> = {},
  note?: string
) {
  if (!allowedTransitions[order.status].includes(nextStatus)) {
    throw new Error(`Invalid order transition from ${order.status} to ${nextStatus}`)
  }

  const changedAt = new Date().toISOString()
  const updatedOrder: AirtimeOrder = {
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
  }

  return persistOrder(updatedOrder)
}