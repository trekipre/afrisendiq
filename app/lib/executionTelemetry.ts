export type ExecutionTelemetryType =
  | "order.created"
  | "order.transitioned"
  | "provider.attempt.started"
  | "provider.attempt.failed"
  | "provider.attempt.succeeded"
  | "purchase.completed"
  | "customer.notification.sent"
  | "customer.notification.skipped"
  | "customer.notification.failed"
  | "purchase.failed"

export type ExecutionTelemetryEvent = {
  id: string
  traceId: string
  orderId: string
  type: ExecutionTelemetryType
  createdAt: string
  provider?: string
  message?: string
  metadata?: Record<string, unknown>
}

const executionEvents: ExecutionTelemetryEvent[] = []

function createTelemetryId() {
  return `evt_${Date.now()}_${executionEvents.length + 1}`
}

export function resetExecutionTelemetry() {
  executionEvents.length = 0
}

export function listExecutionTelemetry(traceId?: string) {
  if (!traceId) {
    return [...executionEvents]
  }

  return executionEvents.filter((event) => event.traceId === traceId)
}

export function recordExecutionTelemetry(
  event: Omit<ExecutionTelemetryEvent, "id" | "createdAt">
) {
  const record: ExecutionTelemetryEvent = {
    ...event,
    id: createTelemetryId(),
    createdAt: new Date().toISOString()
  }

  executionEvents.push(record)
  return record
}